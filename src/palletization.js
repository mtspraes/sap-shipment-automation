// Turn delivery quantities (in boxes) into pallets and weight, using the support
// table (boxes per pallet and kg per box per SKU).

import { PALLET_WEIGHT_KG } from "./config.js";

export function enrichItems(items, supportTable) {
  return items.map((it) => {
    const s = supportTable[it.sku];
    if (!s) return { ...it, pallets: null, weight: null, missingSupport: true };
    const pallets = Math.ceil(it.qty / s.ppd);
    const weight = it.qty * s.weightPerBox + pallets * PALLET_WEIGHT_KG;
    return { ...it, pallets, weight };
  });
}

// Sum weight per SKU across a truck's items (a split SKU may appear once per truck).
export function weightBySku(bin) {
  const map = {};
  for (const it of bin.items) map[it.sku] = (map[it.sku] || 0) + it.weight;
  return map;
}

export const toLineItems = (bin) => bin.items.map((it) => ({ sku: it.sku, qty: it.qty }));
