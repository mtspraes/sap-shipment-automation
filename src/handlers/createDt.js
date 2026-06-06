// Create a shipment document (DT) for an existing delivery.
// SAP: release the delivery (VL02N), then create the DT (VT01N) with the carrier.

import { resolveCarrier } from "../carriers.js";

export async function createDt(driver, job) {
  if (!job.delivery) throw new Error("missing delivery");
  const carrier = resolveCarrier(job.carrier);
  if (!carrier) throw new Error(`unknown carrier: "${job.carrier}"`);

  await driver.releaseDelivery(job.delivery);
  const dt = await driver.createShipmentDoc(job.delivery, carrier);

  return {
    order: job.order,
    delivery: job.delivery,
    carrier: carrier.name,
    shipmentType: carrier.shipmentType,
    dt,
  };
}
