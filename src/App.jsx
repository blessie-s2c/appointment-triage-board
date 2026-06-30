import React, { useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCenter,
} from "@dnd-kit/core";
import {
  SOURCE_STYLES,
  TIME_SLOTS,
  timeToSlotKey,
  loadAppointments,
} from "./data.js";

// One initial load: live (?d=) if present, else seed.
const INITIAL = loadAppointments();

// Estimator columns come from the load: real HubSpot users in live mode, seed
// users standalone. Unassigned is always element 0 (guaranteed by withUnassigned).
const ESTIMATORS = INITIAL.estimators;
const ESTIMATOR_BY_ID = Object.fromEntries(ESTIMATORS.map((e) => [e.id, e]));

// ── Source tag pill ─────────────────────────────────────────────────────────
function SourceTag({ source }) {
  const s = SOURCE_STYLES[source] || { bg: "#EEE", fg: "#444" };
  return (
    <span className="tag" style={{ background: s.bg, color: s.fg }}>
      {source}
    </span>
  );
}

// ── A single appointment card ───────────────────────────────────────────────
function Card({ appt, estimator, onOpen, dragging }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: appt.id });
  const color = estimator.isPlaceholder ? "#64748B" : estimator.color;

  return (
    <article
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(appt.id)}
      className={[
        "card",
        estimator.isPlaceholder ? "card--unassigned" : "card--assigned",
        appt.isRecord ? "card--record" : "",
        isDragging || dragging ? "card--ghost" : "",
      ].join(" ")}
      style={{ "--accent": color }}
    >
      {appt.isRecord && <span className="card__triage">Triage</span>}
      <div className="card__name">{appt.customerName}</div>
      <div className="card__addr">{appt.address}</div>
      <div className="card__meta">
        <SourceTag source={appt.source} />
        {appt.zip && (
          <span className="card__zip">
            {appt.zip}
            {typeof appt.milesFromHQ === "number" ? ` · ${appt.milesFromHQ} mi` : ""}
          </span>
        )}
      </div>
    </article>
  );
}

// ── An estimator column (droppable). The WHOLE column is the drop target, so a
//    card always lands in this estimator at its own time row — the time never
//    changes on assignment, exactly per the brief. ───────────────────────────
function Lane({ estimator, cardsBySlot, onOpen, activeId }) {
  const { setNodeRef, isOver } = useDroppable({ id: estimator.id });
  const count = Object.values(cardsBySlot).reduce((n, arr) => n + arr.length, 0);

  return (
    <div
      ref={setNodeRef}
      className={[
        "lane",
        estimator.isPlaceholder ? "lane--placeholder" : "",
        isOver ? "lane--over" : "",
      ].join(" ")}
      style={{ "--accent": estimator.color }}
    >
      <div className="lane__head">
        <span className="lane__dot" />
        <span className="lane__name">{estimator.name}</span>
        <span className="lane__count">{count}</span>
      </div>
      <div className="lane__body">
        {TIME_SLOTS.map((slot) => (
          <div className="slot" key={slot.key}>
            {(cardsBySlot[slot.key] || []).map((appt) => (
              <Card
                key={appt.id}
                appt={appt}
                estimator={estimator}
                onOpen={onOpen}
                dragging={activeId === appt.id}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Side panel: "context at the point of triage" ────────────────────────────
function SidePanel({ appt, onClose }) {
  if (!appt) return null;
  const estimator = appt.assignedTo ? ESTIMATOR_BY_ID[appt.assignedTo] : null;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="panel" role="dialog" aria-label="Appointment details">
        <button className="panel__close" onClick={onClose} aria-label="Close">×</button>
        <div className="panel__name">{appt.customerName}</div>
        <SourceTag source={appt.source} />

        <dl className="panel__grid">
          <dt>Job site</dt>
          <dd>{appt.address}<br />{appt.zip}{typeof appt.milesFromHQ === "number" ? ` · ${appt.milesFromHQ} mi from HQ` : ""}</dd>
          <dt>Requested</dt>
          <dd>{appt.requestedTime}</dd>
          <dt>Assigned to</dt>
          <dd>{estimator ? estimator.name : "— Unassigned —"}</dd>
          <dt>Warranty</dt>
          <dd>{appt.warrantyStatus}</dd>
          <dt>History</dt>
          <dd>{appt.historyNote}</dd>
        </dl>

        <p className="panel__hint">Drag the card onto an estimator to assign.</p>
      </aside>
    </>
  );
}

// ── Date stepper ────────────────────────────────────────────────────────────
function shiftDate(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function prettyDate(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });
}

// ── Board ───────────────────────────────────────────────────────────────────
export default function App() {
  const [appointments, setAppointments] = useState(INITIAL.appointments);
  const [currentDate, setCurrentDate] = useState(INITIAL.date);
  const [selectedId, setSelectedId] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [toast, setToast] = useState(null);
  const justDragged = useRef(false);

  const sensors = useSensors(
    // distance:6 → a click (no real movement) opens the panel; a drag moves the card.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const todays = useMemo(
    () => appointments.filter((a) => a.date === currentDate),
    [appointments, currentDate]
  );

  // Group: laneId -> slotKey -> [appts]
  const byLane = useMemo(() => {
    const map = {};
    ESTIMATORS.forEach((e) => (map[e.id] = {}));
    todays.forEach((a) => {
      const laneId = a.assignedTo || "unassigned";
      const slotKey = timeToSlotKey(a.requestedTime);
      (map[laneId][slotKey] ||= []).push(a);
    });
    return map;
  }, [todays]);

  const activeAppt = activeId ? appointments.find((a) => a.id === activeId) : null;
  const selectedAppt = selectedId ? appointments.find((a) => a.id === selectedId) : null;

  function openPanel(id) {
    if (justDragged.current) return; // ignore the click that ends a drag
    setSelectedId(id);
  }

  function onDragStart(e) {
    setActiveId(e.active.id);
    setSelectedId(null);
  }

  function onDragEnd(e) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const laneId = over.id;
    const newAssignee = laneId === "unassigned" ? null : laneId;

    setAppointments((prev) =>
      prev.map((a) => (a.id === active.id ? { ...a, assignedTo: newAssignee } : a))
    );

    const appt = appointments.find((a) => a.id === active.id);
    const estName = laneId === "unassigned" ? "Unassigned" : ESTIMATOR_BY_ID[laneId]?.name;
    setToast(
      laneId === "unassigned"
        ? `${appt?.customerName} moved back to Unassigned`
        : `Assigned to ${estName}`
    );
    window.clearTimeout(onDragEnd._t);
    onDragEnd._t = window.setTimeout(() => setToast(null), 2200);

    justDragged.current = true;
    window.setTimeout(() => (justDragged.current = false), 0);
  }

  return (
    <div className="board">
      <header className="topbar">
        <div className="topbar__left">
          <h1 className="topbar__title">Appointment Triage</h1>
          <span className={`srcbadge srcbadge--${INITIAL.source}`}>
            {INITIAL.source === "live" ? "Live data" : "Demo data"}
          </span>
        </div>

        <div className="datestep">
          <button onClick={() => setCurrentDate((d) => shiftDate(d, -1))} aria-label="Previous day">‹</button>
          <span className="datestep__label">{prettyDate(currentDate)}</span>
          <button onClick={() => setCurrentDate((d) => shiftDate(d, 1))} aria-label="Next day">›</button>
        </div>

        <div className="legend">
          {Object.keys(SOURCE_STYLES).map((s) => (
            <span key={s} className="legend__item"><SourceTag source={s} /></span>
          ))}
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="gridscroll">
          <div className="grid" style={{ "--lane-count": ESTIMATORS.length }}>
            {/* time gutter */}
            <div className="gutter">
              <div className="gutter__head" />
              <div className="gutter__body">
                {TIME_SLOTS.map((s) => (
                  <div className="gutter__cell" key={s.key}>{s.label}</div>
                ))}
              </div>
            </div>

            {/* estimator columns */}
            {ESTIMATORS.map((e) => (
              <Lane
                key={e.id}
                estimator={e}
                cardsBySlot={byLane[e.id]}
                onOpen={openPanel}
                activeId={activeId}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeAppt ? (
            <Card
              appt={activeAppt}
              estimator={activeAppt.assignedTo ? ESTIMATOR_BY_ID[activeAppt.assignedTo] : ESTIMATOR_BY_ID.unassigned}
              onOpen={() => {}}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <SidePanel appt={selectedAppt} onClose={() => setSelectedId(null)} />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}