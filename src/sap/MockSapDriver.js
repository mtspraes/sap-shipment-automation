// MockSapDriver - an in-memory SAP stand-in.
//
// Keeps a small world of deliveries, orders and shipment documents, mutating it
// exactly as the real SAP transactions would, and records every "SAP action" so
// the demo can print the sequence of steps the bot would perform on the GUI.
// Implements the same SapDriver contract the real GUI-scripting backend would.

import { SapDriver } from "./SapDriver.js";

export class MockSapDriver extends SapDriver {
  constructor(seed = {}) {
    super();
    // delivery number -> { items:[{sku,qty}], order, weightBySku, palletCount, released }
    this.deliveries = new Map();
    // order number -> [{ sku, qty }]  (what VL10B would create)
    this.orders = new Map();
    // shipment doc -> { carrierCode, deliveries:Set }
    this.shipmentDocs = new Map();
    this.actions = [];
    this._deliverySeq = 800000100; // new deliveries start above the seeded range
    this._dtSeq = 17000100; // new DTs start above the seeded range

    for (const [delivery, data] of Object.entries(seed.deliveries || {})) {
      this.deliveries.set(delivery, {
        items: data.items.map((i) => ({ ...i })),
        order: data.order,
        weightBySku: {},
        palletCount: 0,
        released: false,
      });
      if (data.order) this.orders.set(data.order, data.items.map((i) => ({ ...i })));
    }
    for (const [dt, data] of Object.entries(seed.shipmentDocs || {})) {
      this.shipmentDocs.set(dt, {
        carrierCode: data.carrierCode || "",
        deliveries: new Set(data.deliveries || []),
      });
    }
  }

  _log(txn, message) {
    this.actions.push({ txn, message });
  }

  async connect() {
    this._log("LOGON", "attach to SAP session (PRD - ECC Production)");
  }

  async readDeliveryItems(delivery) {
    const d = this.deliveries.get(delivery);
    if (!d) throw new Error(`delivery ${delivery} not found`);
    this._log("VL02N", `read ${d.items.length} items from delivery ${delivery}`);
    return d.items.map((i) => ({ ...i }));
  }

  async createDeliveryFromOrder(order) {
    const items = this.orders.get(order);
    if (!items) throw new Error(`order ${order} has no items`);
    const delivery = String(++this._deliverySeq);
    this.deliveries.set(delivery, {
      items: items.map((i) => ({ ...i })),
      order,
      weightBySku: {},
      palletCount: 0,
      released: false,
    });
    this._log("VL10B", `create delivery ${delivery} from order ${order}`);
    return delivery;
  }

  async applyItems(delivery, items) {
    const d = this.deliveries.get(delivery);
    if (!d) throw new Error(`delivery ${delivery} not found`);
    const keepBySku = new Map(items.map((i) => [i.sku, i.qty]));
    const removed = d.items.filter((i) => !keepBySku.has(i.sku)).length;
    d.items = items.map((i) => ({ sku: i.sku, qty: i.qty }));
    this._log("VL02N", `delivery ${delivery}: keep ${items.length} SKUs, delete ${removed}, adjust quantities`);
  }

  async setWeights(delivery, weightBySku, palletCount) {
    const d = this.deliveries.get(delivery);
    if (!d) throw new Error(`delivery ${delivery} not found`);
    d.weightBySku = { ...weightBySku };
    if (palletCount != null) d.palletCount = palletCount;
    this._log("VL02N", `delivery ${delivery}: set weights for ${Object.keys(weightBySku).length} SKUs, packages=${palletCount}`);
  }

  async releaseDelivery(delivery) {
    const d = this.deliveries.get(delivery);
    if (!d) throw new Error(`delivery ${delivery} not found`);
    d.released = true;
    this._log("VL02N", `delivery ${delivery}: post goods issue + clear shipment block`);
  }

  async createShipmentDoc(delivery, carrier) {
    const d = this.deliveries.get(delivery);
    if (!d) throw new Error(`delivery ${delivery} not found`);
    const dt = String(++this._dtSeq);
    this.shipmentDocs.set(dt, { carrierCode: carrier.code, deliveries: new Set([delivery]) });
    this._log(
      "VT01N",
      `create shipment doc ${dt} for delivery ${delivery} (carrier ${carrier.code}, ${carrier.shipmentType})`
    );
    return dt;
  }

  async changeCarrier(shipmentDoc, carrierCode) {
    const s = this.shipmentDocs.get(shipmentDoc);
    if (!s) throw new Error(`shipment doc ${shipmentDoc} not found`);
    s.carrierCode = carrierCode;
    this._log("VT02N", `shipment doc ${shipmentDoc}: change carrier to ${carrierCode}`);
  }

  async unlinkDelivery(shipmentDoc, delivery) {
    const s = this.shipmentDocs.get(shipmentDoc);
    if (!s) throw new Error(`shipment doc ${shipmentDoc} not found`);
    s.deliveries.delete(delivery);
    this._log("VT02N", `shipment doc ${shipmentDoc}: unlink delivery ${delivery}`);
  }
}
