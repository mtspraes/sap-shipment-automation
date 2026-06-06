// Carrier resolution.
//
// Operators type the carrier name by hand in Teams, so the lookup is tolerant:
// it strips accents and case, and supports an operator convention where a
// trailing "x" or "v" on the name forces the shipment type to ZA09 regardless
// of the carrier's default (used when the same carrier runs a different lane).

import { CARRIERS } from "./config.js";

export function removeAccents(text) {
  return String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Resolve a typed carrier name into its SAP configuration.
// Returns { name, code, equipType, shipmentType, forcedZA09 } or null.
export function resolveCarrier(typedName) {
  if (!typedName) return null;
  let key = removeAccents(typedName);

  // Suffix convention: "<carrier>x" / "<carrier>v" -> force ZA09.
  let forceZA09 = false;
  const suffixMatch = key.match(/^(.*?)[xv]$/);
  if (suffixMatch && !CARRIERS[key] && CARRIERS[suffixMatch[1].trim()]) {
    key = suffixMatch[1].trim();
    forceZA09 = true;
  }

  let entry = CARRIERS[key];
  if (!entry) {
    // Fallback: partial match (handles minor typos / extra words).
    const found = Object.keys(CARRIERS).find((name) => key.includes(name) || name.includes(key));
    if (found) entry = CARRIERS[found];
    if (found) key = found;
  }
  if (!entry) return null;

  return {
    name: key,
    code: entry.code,
    equipType: entry.equipType,
    shipmentType: forceZA09 ? "ZA09" : entry.shipmentType,
    forcedZA09: forceZA09,
  };
}
