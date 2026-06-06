// Watcher - the job processor.
//
// In production a local Node/WSH watcher polls a queue folder that Power Automate
// fills, runs the matching handler per job against SAP, and writes a result that
// Power Automate posts back to Teams. Here the same routing and result-building
// is exposed as pure functions so it runs end to end against any SapDriver.

import { parseMessage } from "./jobParser.js";
import { createDt } from "./handlers/createDt.js";
import { convoy } from "./handlers/convoy.js";
import { changeCarrier } from "./handlers/changeCarrier.js";
import { unlinkDt } from "./handlers/unlinkDt.js";

const HANDLERS = {
  create_dt: createDt,
  convoy,
  change_carrier: changeCarrier,
  unlink_dt: unlinkDt,
};

// Process a parsed batch of jobs. One failed job never aborts the others.
export async function processJobs(driver, { action, jobs }, ctx = {}) {
  const handler = HANDLERS[action];
  if (!handler) return { action, error: `unknown action: ${action}`, results: [] };

  const results = [];
  for (const job of jobs) {
    try {
      const data = await handler(driver, job, ctx);
      results.push({ ok: true, row: job._row, data });
    } catch (err) {
      results.push({ ok: false, row: job._row, error: err.message, job });
    }
  }

  const successes = results.filter((r) => r.ok).length;
  return {
    action,
    total: results.length,
    successes,
    errors: results.length - successes,
    results,
    teamsMessage: buildTeamsMessage(action, results),
  };
}

// Parse a Teams message and process it in one call.
export async function runFromTeamsMessage(driver, message, ctx = {}) {
  const parsed = parseMessage(message);
  if (!parsed.action) return { error: parsed.error, results: [] };
  return processJobs(driver, parsed, ctx);
}

// Build the summary that gets posted back to the Teams thread.
function buildTeamsMessage(action, results) {
  const lines = [`Result for ${action}: ${results.filter((r) => r.ok).length}/${results.length} ok`];
  for (const r of results) {
    if (!r.ok) {
      lines.push(`  row ${r.row}: ERROR - ${r.error}`);
      continue;
    }
    const d = r.data;
    if (action === "convoy" && d.deliveryR2) {
      lines.push(`  row ${r.row}: convoy -> R1 ${d.deliveryR1}/DT ${d.dtR1} (${d.r1.pallets}p), R2 ${d.deliveryR2}/DT ${d.dtR2} (${d.r2.pallets}p)`);
    } else if (action === "create_dt" || (action === "convoy" && d.single)) {
      lines.push(`  row ${r.row}: delivery ${d.delivery} -> DT ${d.dt} (${d.carrier})`);
    } else if (action === "change_carrier") {
      lines.push(`  row ${r.row}: DT ${d.shipmentDoc} -> carrier ${d.carrier} (${d.code})`);
    } else if (action === "unlink_dt") {
      lines.push(`  row ${r.row}: DT ${d.shipmentDoc} unlinked from delivery ${d.delivery}`);
    }
  }
  return lines.join("\n");
}
