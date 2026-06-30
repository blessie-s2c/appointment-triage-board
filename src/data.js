// ───────────────────────────────────────────────────────────────────────────
// data.js — single source of truth for the board's shape + seed data
// ───────────────────────────────────────────────────────────────────────────
// Everything the board renders comes from one of two places:
//   1. LIVE  — the HubSpot card encodes real Appointment records into the
//              iframe URL as ?d=<base64 json>. loadAppointments() decodes them.
//   2. SEED  — if no ?d= param is present (local dev, or a fallback so the
//              board is NEVER empty on stage), we use SEED_APPOINTMENTS below.
// The board itself doesn't care which it got — same shape either way.

// ── Estimators = the X-axis columns ─────────────────────────────────────────
// LIVE: the estimator columns are real HubSpot users. The card resolves the
// Owner (HubSpot-user) property to owner records and sends them in the ?d=
// payload as { id: ownerId, name, color }. The board renders columns from that.
// SEED: when running standalone (no payload), we use SEED_ESTIMATORS below.
//
// In both cases the board guarantees a fixed "Unassigned" column at the far left
// (see withUnassigned + UNASSIGNED_LANE), so the card never has to send it.

export const UNASSIGNED_LANE = {
  id: "unassigned",
  name: "Unassigned",
  color: "#94A3B8",
  isPlaceholder: true,
};

// Brand-aligned palette the card cycles through when coloring estimator columns.
export const ESTIMATOR_PALETTE = [
  "#0C447C", // S2C deep blue
  "#378ADD", // S2C accent
  "#0E7C6B", // teal
  "#B45309", // amber
  "#7C3AED", // violet
  "#BE185D", // magenta
];
export const colorFor = (i) => ESTIMATOR_PALETTE[i % ESTIMATOR_PALETTE.length];

// Seed estimators use ownerId-style string ids; the seed appointments' assignedTo
// values match these. In LIVE mode these ids are real HubSpot owner IDs.
export const SEED_ESTIMATORS = [
  { id: "brad",  name: "Brad Sutter",  color: colorFor(0) },
  { id: "glenn", name: "Glenn Park",   color: colorFor(1) },
  { id: "jeff",  name: "Jeff Romero",  color: colorFor(2) },
  { id: "dana",  name: "Dana Whitfield", color: colorFor(3) },
];

// Always-present Unassigned column, de-duped, in front of the estimator columns.
export function withUnassigned(estimators) {
  const real = (estimators || []).filter((e) => e && e.id !== "unassigned");
  return [UNASSIGNED_LANE, ...real];
}

// ── Booking-source styling (the "three sources" point, color-coded) ─────────
export const SOURCE_STYLES = {
  "Office":            { bg: "#E8F0FB", fg: "#0C447C" },
  "Customer":          { bg: "#E7F6F1", fg: "#0E7C6B" },
  "Answering Service": { bg: "#FEF3E2", fg: "#B45309" },
};

// ── Time grid (Y-axis) ──────────────────────────────────────────────────────
// One row per slot. Hourly keeps the grid readable for a demo; drop SLOT_MINUTES
// to 30 for half-hourly rows.
export const DAY_START_HOUR = 7;   // 7:00 AM
export const DAY_END_HOUR   = 18;  // 6:00 PM (last row label)
export const SLOT_MINUTES   = 60;

function buildSlots() {
  const slots = [];
  const startMin = DAY_START_HOUR * 60;
  const endMin = DAY_END_HOUR * 60;
  for (let m = startMin; m <= endMin; m += SLOT_MINUTES) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const key = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    const ampm = h < 12 ? "AM" : "PM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const label = min === 0 ? `${h12}:00 ${ampm}` : `${h12}:${String(min).padStart(2, "0")} ${ampm}`;
    slots.push({ key, label, minutes: m });
  }
  return slots;
}
export const TIME_SLOTS = buildSlots();

// Snap any "HH:MM" requestedTime to the nearest grid row key (clamped in range).
// Keeps the board happy-path-safe if a record's time is slightly off-grid.
export function timeToSlotKey(requestedTime) {
  if (!requestedTime) return TIME_SLOTS[0].key;
  const [h, m] = requestedTime.split(":").map(Number);
  const mins = h * 60 + (m || 0);
  let best = TIME_SLOTS[0];
  let bestDelta = Infinity;
  for (const s of TIME_SLOTS) {
    const d = Math.abs(s.minutes - mins);
    if (d < bestDelta) { bestDelta = d; best = s; }
  }
  return best.key;
}

// ── Seed day (a monsoon-season Tuesday — Scott Roofing's rush) ───────────────
export const DEMO_DATE = "2026-07-14";

// Card shape: { id, customerName, address, zip, requestedTime, source,
//               assignedTo (null = unassigned), historyNote, warrantyStatus,
//               milesFromHQ, date, isRecord }
export const SEED_APPOINTMENTS = [
  // The record the module was opened from — sits in Unassigned, highlighted.
  { id: "a1", customerName: "Maria Alvarez", address: "4127 E Indian School Rd", zip: "85018",
    requestedTime: "07:00", source: "Answering Service", assignedTo: null,
    historyNote: "Called in at 11pm after last night's storm — active leak over the garage.",
    warrantyStatus: "Under warranty · roof installed 2021", milesFromHQ: 6, date: DEMO_DATE, isRecord: true },

  // A couple more waiting in Unassigned (the triage queue).
  { id: "a2", customerName: "Greg Tran", address: "910 W Bethany Home Rd", zip: "85013",
    requestedTime: "09:00", source: "Customer", assignedTo: null,
    historyNote: "Self-booked online. Wants a quote on a full re-roof.",
    warrantyStatus: "No warranty on file", milesFromHQ: 9, date: DEMO_DATE },
  { id: "a3", customerName: "Priya Nair", address: "2238 N 44th St", zip: "85008",
    requestedTime: "13:00", source: "Office", assignedTo: null,
    historyNote: "Front-desk booked. Repeat customer, prefers afternoon visits.",
    warrantyStatus: "Under warranty · roof installed 2019", milesFromHQ: 4, date: DEMO_DATE },

  // Already-assigned cards so the grid reads as a live day, not an empty board.
  { id: "b1", customerName: "Doug Hill", address: "1500 E Camelback Rd", zip: "85014",
    requestedTime: "08:00", source: "Office", assignedTo: "brad",
    historyNote: "Annual inspection. Easy in-and-out.",
    warrantyStatus: "Under warranty · roof installed 2022", milesFromHQ: 5, date: DEMO_DATE },
  { id: "b2", customerName: "Sandra Cole", address: "7001 N Scottsdale Rd", zip: "85253",
    requestedTime: "11:00", source: "Customer", assignedTo: "brad",
    historyNote: "Hail damage claim — bring the drone.",
    warrantyStatus: "No warranty on file", milesFromHQ: 14, date: DEMO_DATE },
  { id: "g1", customerName: "Tom & Lisa Webb", address: "3320 W Cactus Rd", zip: "85029",
    requestedTime: "08:00", source: "Answering Service", assignedTo: "glenn",
    historyNote: "After-hours call. Shingles down after wind.",
    warrantyStatus: "Under warranty · roof installed 2020", milesFromHQ: 12, date: DEMO_DATE },
  { id: "g2", customerName: "Erin Foley", address: "455 E Thunderbird Rd", zip: "85022",
    requestedTime: "14:00", source: "Office", assignedTo: "glenn",
    historyNote: "Follow-up on last month's repair.",
    warrantyStatus: "Under warranty · roof installed 2018", milesFromHQ: 11, date: DEMO_DATE },
  { id: "j1", customerName: "Marcus Reed", address: "8800 S 48th St", zip: "85044",
    requestedTime: "10:00", source: "Customer", assignedTo: "jeff",
    historyNote: "Self-booked. New build, wants warranty transfer info.",
    warrantyStatus: "Warranty transfer pending", milesFromHQ: 18, date: DEMO_DATE },
  { id: "j2", customerName: "Helen Ortiz", address: "1201 S Alma School Rd", zip: "85210",
    requestedTime: "15:00", source: "Office", assignedTo: "jeff",
    historyNote: "Tile slip after storm. Bring matching tile samples.",
    warrantyStatus: "Under warranty · roof installed 2023", milesFromHQ: 21, date: DEMO_DATE },
];

// ── Live-data loader ────────────────────────────────────────────────────────
// Decodes the ?d= payload the HubSpot card built. UTF-8-safe base64 decode.
function decodePayload(b64) {
  const json = decodeURIComponent(
    atob(b64).split("").map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join("")
  );
  return JSON.parse(json);
}

export function loadAppointments() {
  try {
    const d = new URLSearchParams(window.location.search).get("d");
    if (d) {
      const payload = decodePayload(d);
      if (Array.isArray(payload?.appointments) && payload.appointments.length) {
        return {
          appointments: payload.appointments,
          estimators: withUnassigned(payload.estimators || SEED_ESTIMATORS),
          recordId: payload.recordId ?? null,
          date: payload.date ?? payload.appointments[0].date,
          source: "live",
        };
      }
    }
  } catch (err) {
    // Bad/oversized payload → fall through to seed so the demo never breaks.
    console.warn("[triage] live payload failed, using seed data:", err);
  }
  return {
    appointments: SEED_APPOINTMENTS,
    estimators: withUnassigned(SEED_ESTIMATORS),
    recordId: "a1",
    date: DEMO_DATE,
    source: "seed",
  };
}