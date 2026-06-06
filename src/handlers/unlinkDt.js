// Unlink a delivery from a shipment document (DT). SAP: VT02N.

export async function unlinkDt(driver, job) {
  if (!job.shipmentDoc || !job.delivery) throw new Error("unlink needs shipment doc and delivery");
  await driver.unlinkDelivery(job.shipmentDoc, job.delivery);
  return { shipmentDoc: job.shipmentDoc, delivery: job.delivery, unlinked: true };
}
