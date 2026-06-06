// End-to-end demo. Simulates the Teams -> Power Automate -> watcher -> SAP flow
// for each command, running against an in-memory SAP. Run with: `node demo.js`

import { MockSapDriver } from "./src/sap/MockSapDriver.js";
import { parseMessage } from "./src/jobParser.js";
import { processJobs } from "./src/watcher.js";
import { SAP_SEED, SUPPORT_TABLE } from "./src/sampleData.js";

const driver = new MockSapDriver(SAP_SEED);
await driver.connect();
const ctx = { supportTable: SUPPORT_TABLE };

const bar = (n = 70) => "=".repeat(n);

async function scenario(title, message) {
  console.log("\n" + bar());
  console.log(title);
  console.log(bar());
  console.log("Teams message:");
  console.log(message.trim().split("\n").map((l) => "  " + l).join("\n"));

  const before = driver.actions.length;
  const parsed = parseMessage(message);
  console.log(`\nPower Automate parsed -> action="${parsed.action}", ${parsed.jobs.length} job(s)`);

  const result = await processJobs(driver, parsed, ctx);

  const sapSteps = driver.actions.slice(before);
  console.log(`\nSAP steps performed (${sapSteps.length}):`);
  for (const a of sapSteps) console.log(`  [${a.txn}] ${a.message}`);

  console.log("\nPosted back to Teams:");
  console.log(result.teamsMessage.split("\n").map((l) => "  " + l).join("\n"));
}

console.log("SAP Shipment Automation - end-to-end demo (in-memory SAP)");

// 1. Convoy: one big delivery split into a balanced two-truck convoy.
await scenario(
  "1) CONVOY  - split an oversized delivery into two balanced trucks",
  `@ShipmentBot #convoy
| Order | Delivery | Carrier |
| --- | --- | --- |
| 4500000001 | 800000001 | andes cargo |`
);

// 2. Create DT - note the columns are pasted OUT OF ORDER, and the carrier has
//    the "x" suffix that forces shipment type ZA09.
await scenario(
  "2) CREATE DT - field auto-correction + carrier 'x' suffix (forces ZA09)",
  `@ShipmentBot #createdt
| Order | Delivery | Carrier |
| --- | --- | --- |
| 4500000002 | delta transportesx | 800000002 |`
);

// 3. Change carrier on an existing shipment document.
await scenario(
  "3) CHANGE CARRIER - on an existing DT",
  `@ShipmentBot #changecarrier
| DT | Carrier |
| --- | --- |
| 17000900 | norte express |`
);

// 4. Unlink a delivery from a shipment document.
await scenario(
  "4) UNLINK DT - detach a delivery from a DT",
  `@ShipmentBot #unlinkdt
| DT | Delivery |
| --- | --- |
| 17000900 | 800000003 |`
);

console.log("\n" + bar());
console.log("Done. The same handlers run against a real SAP GUI driver in production.");
console.log(bar());
