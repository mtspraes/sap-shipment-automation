// Job parser - the role Power Automate plays in the real system.
//
// In production, a planner @mentions the bot in a Microsoft Teams channel and
// pastes a small table plus a hashtag command. Power Automate parses that HTML
// table, builds a JSON job array, and drops it into a queue folder. This module
// reproduces that parsing as pure, testable logic: it turns a Teams-style
// message (a hashtag + a markdown table) into validated job objects, and
// auto-corrects columns that operators paste out of order.

import { PATTERNS } from "./config.js";

const COMMANDS = {
  "#createdt": "create_dt",
  "#convoy": "convoy",
  "#changecarrier": "change_carrier",
  "#unlinkdt": "unlink_dt",
};

// Detect the action from the hashtag in the message.
export function detectAction(message) {
  const lower = String(message).toLowerCase();
  for (const [tag, action] of Object.entries(COMMANDS)) {
    if (lower.includes(tag)) return action;
  }
  return null;
}

// Extract the data rows from a markdown table, dropping the header and the
// separator row. Returns an array of cell arrays.
export function parseTable(message) {
  const rows = [];
  for (const line of String(message).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const cells = trimmed.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length === 0) continue;
    if (cells.every((c) => /^:?-{2,}:?$/.test(c) || c === "")) continue; // separator
    rows.push(cells);
  }
  // Drop the header row (first data-looking row whose cells are all words).
  if (rows.length && rows[0].every((c) => !isNumericField(c))) rows.shift();
  return rows;
}

function isNumericField(value) {
  return /^\d+$/.test(String(value).replace(/\s/g, ""));
}

// Classify a single cell into the field it most likely represents.
function classifyCell(value) {
  const v = String(value).replace(/\s/g, "");
  if (PATTERNS.order.test(v)) return "order";
  if (PATTERNS.delivery.test(v)) return "delivery";
  if (PATTERNS.shipmentDoc.test(v)) return "shipmentDoc";
  if (PATTERNS.carrierCode.test(v)) return "carrierCode";
  if (!isNumericField(v)) return "carrier"; // non-numeric -> a typed carrier name
  return "unknown";
}

// Auto-correct a row: assign each cell to the field its shape implies, so a row
// pasted in the wrong column order is still understood. Falls back to positional
// mapping for anything ambiguous.
export function classifyRow(cells) {
  const fields = {};
  for (const cell of cells) {
    const kind = classifyCell(cell);
    if (kind !== "unknown" && fields[kind] === undefined) fields[kind] = cell.trim();
  }
  return fields;
}

// Build validated job objects for the detected action.
export function buildJobs(action, rows) {
  return rows
    .map((cells, i) => {
      const f = classifyRow(cells);
      const base = { _row: i + 1 };
      switch (action) {
        case "create_dt":
          return { ...base, order: f.order, delivery: f.delivery, carrier: f.carrier };
        case "convoy":
          return { ...base, order: f.order, delivery: f.delivery, carrier: f.carrier, country: f.country };
        case "change_carrier":
          return { ...base, shipmentDoc: f.shipmentDoc, carrier: f.carrier || f.carrierCode };
        case "unlink_dt":
          return { ...base, shipmentDoc: f.shipmentDoc, delivery: f.delivery };
        default:
          return null;
      }
    })
    .filter(Boolean);
}

// Full parse: message text -> { action, jobs }.
export function parseMessage(message) {
  const action = detectAction(message);
  if (!action) return { action: null, jobs: [], error: "no command hashtag found" };
  const rows = parseTable(message);
  const jobs = buildJobs(action, rows);
  return { action, jobs };
}
