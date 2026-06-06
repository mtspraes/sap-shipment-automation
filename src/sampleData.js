// Synthetic SAP world + product support table.
//
// Fictional deliveries, orders and shipment documents to seed the MockSapDriver,
// plus a support table mapping each SKU to its boxes-per-pallet and weight, used
// to turn delivery quantities into pallets and kilograms. No real data.

// SKU -> { ppd: boxes per pallet, weightPerBox: kg }
export const SUPPORT_TABLE = {
  "64900001": { ppd: 50, weightPerBox: 22 }, // dense: ~1100 kg/pallet
  "64900002": { ppd: 60, weightPerBox: 15 },
  "64900003": { ppd: 120, weightPerBox: 7 }, // bulky/light
  "64900004": { ppd: 48, weightPerBox: 25 }, // very dense
  "64900005": { ppd: 90, weightPerBox: 9 },
  "64900006": { ppd: 70, weightPerBox: 13 },
  "64900007": { ppd: 100, weightPerBox: 6 },
};

// Seed for the MockSapDriver.
export const SAP_SEED = {
  deliveries: {
    // Big delivery (~40 pallets) - needs a two-truck convoy.
    "800000001": {
      order: "4500000001",
      items: [
        { sku: "64900001", qty: 500 }, // 10 pallets
        { sku: "64900004", qty: 384 }, // 8 pallets
        { sku: "64900003", qty: 1440 }, // 12 pallets (heaviest by pallets -> splittable)
        { sku: "64900007", qty: 1000 }, // 10 pallets
      ],
    },
    // Small delivery (~9 pallets) - fits one truck, used for a simple DT.
    "800000002": {
      order: "4500000002",
      items: [
        { sku: "64900002", qty: 300 }, // 5 pallets
        { sku: "64900005", qty: 360 }, // 4 pallets
      ],
    },
    // A delivery already linked to a shipment document (for unlink demo).
    "800000003": {
      order: "4500000003",
      items: [{ sku: "64900006", qty: 350 }],
    },
  },
  // Pre-existing shipment documents (for change-carrier / unlink demos).
  shipmentDocs: {
    "17000900": { carrierCode: "10000022", deliveries: ["800000003"] },
  },
};
