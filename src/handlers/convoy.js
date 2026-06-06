// Convoy: split one oversized delivery into a balanced two-truck convoy and
// create both shipment documents in one shot - the project's flagship flow.
//
// Phases (each maps to SAP transactions via the driver):
//   1. read the delivery's items                         (VL02N)
//   2. enrich with pallets/weight from the support table (local)
//   3. compute the balanced 28+28 split                  (local optimizer)
//   4. edit the original delivery down to truck R1        (VL02N)
//   5. create a new delivery for truck R2 from the order  (VL10B)
//   6. reduce R2 to its items and set weights            (VL02N)
//   7. release both deliveries                            (VL02N)
//   8. create a DT for each                               (VT01N)

import { resolveCarrier } from "../carriers.js";
import { splitConvoy } from "../convoySplit.js";
import { enrichItems, weightBySku, toLineItems } from "../palletization.js";

export async function convoy(driver, job, { supportTable }) {
  if (!job.delivery || !job.order) throw new Error("convoy needs both order and delivery");
  const carrier = resolveCarrier(job.carrier);
  if (!carrier) throw new Error(`unknown carrier: "${job.carrier}"`);

  // 1-2. read + enrich
  const raw = await driver.readDeliveryItems(job.delivery);
  const items = enrichItems(raw, supportTable);
  const missing = items.filter((i) => i.missingSupport).map((i) => i.sku);
  if (missing.length) throw new Error(`support table missing SKUs: ${missing.join(", ")}`);

  // 3. split
  const split = splitConvoy(items, { country: job.country });

  // Single truck after all - just make one DT.
  if (!split.split) {
    const [only] = split.trucks;
    await driver.setWeights(job.delivery, weightBySku(only), only.pallets);
    await driver.releaseDelivery(job.delivery);
    const dt = await driver.createShipmentDoc(job.delivery, carrier);
    return { order: job.order, single: true, delivery: job.delivery, dt, carrier: carrier.name };
  }

  const [r1, r2] = split.trucks;

  // 4. original delivery -> R1
  await driver.applyItems(job.delivery, toLineItems(r1));
  await driver.setWeights(job.delivery, weightBySku(r1), r1.pallets);

  // 5-6. new delivery -> R2
  const deliveryR2 = await driver.createDeliveryFromOrder(job.order);
  await driver.applyItems(deliveryR2, toLineItems(r2));
  await driver.setWeights(deliveryR2, weightBySku(r2), r2.pallets);

  // 7. release both
  await driver.releaseDelivery(job.delivery);
  await driver.releaseDelivery(deliveryR2);

  // 8. create both DTs
  const dtR1 = await driver.createShipmentDoc(job.delivery, carrier);
  const dtR2 = await driver.createShipmentDoc(deliveryR2, carrier);

  return {
    order: job.order,
    carrier: carrier.name,
    method: split.method,
    deliveryR1: job.delivery,
    deliveryR2,
    dtR1,
    dtR2,
    r1: { pallets: r1.pallets, weight: r1.weight },
    r2: { pallets: r2.pallets, weight: r2.weight },
    balanceGap: split.balanceGap,
  };
}
