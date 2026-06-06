// Convoy split optimizer.
//
// When a delivery is too big for one trailer it ships as a "convoy" of two
// trucks (R1 + R2). The split has to respect two hard limits per truck - pallet
// positions (28) and payload weight - while keeping the two trucks as balanced
// as possible (so neither runs heavy while the other runs light).
//
// Strategy: keep every SKU whole except the single heaviest one, which may be
// split across the two trucks. Brute-force every way to split that heavy SKU,
// greedily place the remaining whole SKUs into the lighter truck, and keep the
// most balanced feasible arrangement.

import { PALLETS_PER_TRUCK, WEIGHT_LIMIT_KG, WEIGHT_LIMIT_BY_COUNTRY } from "./config.js";

const weightLimitFor = (country) => WEIGHT_LIMIT_BY_COUNTRY[country] ?? WEIGHT_LIMIT_KG;

const emptyBin = () => ({ items: [], pallets: 0, weight: 0 });

function fits(bin, item, limit) {
  return bin.pallets + item.pallets <= PALLETS_PER_TRUCK && bin.weight + item.weight <= limit;
}

function add(bin, item) {
  bin.items.push(item);
  bin.pallets += item.pallets;
  bin.weight += item.weight;
}

function totals(items) {
  return items.reduce(
    (acc, it) => ({ pallets: acc.pallets + it.pallets, weight: acc.weight + it.weight }),
    { pallets: 0, weight: 0 }
  );
}

// Split one delivery's items into one or two trucks.
//
// items: [{ sku, qty, pallets, weight }]
// returns {
//   trucks: [bin] | [bin, bin],
//   split: boolean,             // was a second truck needed?
//   method: 'single' | 'weight-balanced' | 'linear-fallback',
//   balanceGap: { pallets, weight }
// }
export function splitConvoy(items, { country } = {}) {
  const limit = weightLimitFor(country);
  const grand = totals(items);

  // Fits in a single trailer - no convoy needed.
  if (grand.pallets <= PALLETS_PER_TRUCK && grand.weight <= limit) {
    const only = emptyBin();
    items.forEach((it) => add(only, it));
    return { trucks: [only], split: false, method: "single", balanceGap: { pallets: 0, weight: 0 } };
  }

  // The heaviest SKU (most pallets) is the one we allow to be split.
  const heavy = items.reduce((a, b) => (b.pallets > a.pallets ? b : a));
  const others = items.filter((it) => it !== heavy);
  const wpp = heavy.weight / heavy.pallets; // weight per pallet
  const qpp = heavy.qty / heavy.pallets; // boxes per pallet

  let best = null;
  for (let k = 0; k <= heavy.pallets; k++) {
    const part1 =
      k > 0 ? { sku: heavy.sku, pallets: k, weight: Math.round(k * wpp), qty: Math.round(k * qpp), split: true } : null;
    const rest = heavy.pallets - k;
    const part2 =
      rest > 0
        ? {
            sku: heavy.sku,
            pallets: rest,
            weight: heavy.weight - (part1 ? part1.weight : 0),
            qty: heavy.qty - (part1 ? part1.qty : 0),
            split: true,
          }
        : null;

    const r1 = emptyBin();
    const r2 = emptyBin();
    if (part1) add(r1, part1);
    if (part2) add(r2, part2);
    if (r1.pallets > PALLETS_PER_TRUCK || r1.weight > limit) continue;
    if (r2.pallets > PALLETS_PER_TRUCK || r2.weight > limit) continue;

    // Place remaining whole SKUs, largest first, into the lighter truck that fits.
    const sorted = [...others].sort((a, b) => b.pallets - a.pallets);
    let feasible = true;
    for (const it of sorted) {
      const f1 = fits(r1, it, limit);
      const f2 = fits(r2, it, limit);
      if (f1 && f2) add(r1.weight <= r2.weight ? r1 : r2, it);
      else if (f1) add(r1, it);
      else if (f2) add(r2, it);
      else {
        feasible = false;
        break;
      }
    }
    if (!feasible || r1.pallets === 0 || r2.pallets === 0) continue;

    // Most balanced wins: pallet balance dominates, weight balance breaks ties.
    const score = -Math.abs(r1.pallets - r2.pallets) * 1000 - Math.abs(r1.weight - r2.weight);
    if (!best || score > best.score) best = { score, r1, r2 };
  }

  if (best) {
    return {
      trucks: [best.r1, best.r2],
      split: true,
      method: "weight-balanced",
      balanceGap: {
        pallets: Math.abs(best.r1.pallets - best.r2.pallets),
        weight: Math.abs(best.r1.weight - best.r2.weight),
      },
    };
  }

  return linearFallback(items, limit);
}

// Linear fallback: fill the first truck until the next item no longer fits, then
// overflow into the second. Used only when no balanced split is feasible.
function linearFallback(items, limit) {
  const r1 = emptyBin();
  const r2 = emptyBin();
  for (const it of [...items].sort((a, b) => b.pallets - a.pallets)) {
    if (fits(r1, it, limit)) add(r1, it);
    else add(r2, it);
  }
  return {
    trucks: r2.pallets > 0 ? [r1, r2] : [r1],
    split: r2.pallets > 0,
    method: "linear-fallback",
    balanceGap: { pallets: Math.abs(r1.pallets - r2.pallets), weight: Math.abs(r1.weight - r2.weight) },
  };
}
