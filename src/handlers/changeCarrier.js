// Change the carrier on an existing shipment document (DT). SAP: VT02N.
// The job's carrier field may arrive as a name or already as an SAP code.

import { resolveCarrier } from "../carriers.js";

export async function changeCarrier(driver, job) {
  if (!job.shipmentDoc) throw new Error("missing shipment document");
  const resolved = resolveCarrier(job.carrier);
  const code = resolved ? resolved.code : String(job.carrier || "").trim();
  if (!code) throw new Error(`unknown carrier: "${job.carrier}"`);

  await driver.changeCarrier(job.shipmentDoc, code);
  return { shipmentDoc: job.shipmentDoc, carrier: resolved ? resolved.name : code, code };
}
