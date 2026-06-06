# SAP Shipment Automation

A chat-driven RPA engine for SAP export logistics. A planner types a short
command in a **Microsoft Teams** channel; **Power Automate** turns it into jobs; a
local watcher executes them against SAP by driving the **SAP GUI** — creating
deliveries and shipment documents, changing carriers, and splitting oversized
deliveries into balanced two-truck **convoys**.

> **Context.** This is a sanitized, self-contained distillation of a system I
> built and run in production for a real export operation. The original drives a
> live SAP GUI via SAP GUI Scripting (which can't run without SAP), so here the
> SAP layer is replaced by an in-memory `MockSapDriver` behind the same
> interface — **the entire pipeline runs and is demonstrable with `node demo.js`**.
> All carriers, codes, SAP identifiers and documents are fictional; no real data.

## The problem

Creating SAP shipping paperwork is repetitive, rigid, and error-prone. For each
load a planner has to: create the delivery, set weights, release it, create the
shipment document (DT), assign the right carrier with the right shipment type —
across four SAP transactions. And when a load is too big for one truck, they have
to split it into two **by hand**, balancing pallets and weight across both. Doing
this dozens of times a day, by hand, is slow and mistakes are costly.

This system lets a planner trigger the whole thing from a Teams message.

## Architecture

```
 Microsoft Teams                Power Automate              Local watcher            SAP GUI
 (planner @mentions     →   (parses the table into   →   (routes each job to   →   (VL10B / VL02N /
  the bot + a table          a JSON job queue)            the right handler)        VT01N / VT02N)
  with a #command)                                              │
        ▲                                                       ▼
        └───────────────  result posted back to Teams  ◀── result JSON
```

The original wiring: Teams → Power Automate (HTML table → JSON) → a OneDrive queue
folder → a local Node/WSH watcher → SAP GUI Scripting → result file → Power
Automate posts the outcome back to the thread. This repo reproduces every part
**except** the GUI scripting itself, which sits behind a driver interface.

### Key design choice — dependency inversion

Handlers never touch SAP directly; they talk to a `SapDriver` interface. The real
backend implements it with SAP GUI Scripting; the `MockSapDriver` implements it
in memory and records every step. That decoupling is what makes the brittle UI
automation **testable** and the business logic reusable.

```
job → handler → SapDriver (interface) → [ MockSapDriver | real GUI-scripting driver ]
```

## What it does

| Command (in Teams) | Flow | SAP transactions |
| --- | --- | --- |
| `#convoy` | split an oversized delivery into a balanced 2-truck convoy + 2 DTs | VL02N, VL10B, VT01N |
| `#createdt` | release a delivery and create its shipment document | VL02N, VT01N |
| `#changecarrier` | change the carrier on an existing DT | VT02N |
| `#unlinkdt` | detach a delivery from a DT | VT02N |

### The convoy split optimizer (the flagship)

A delivery over one truck's limits ships as two trucks. Each truck has two hard
limits — **28 pallet positions** and a **payload weight cap** — and the two
trucks should be **balanced**. The optimizer:

1. keeps every SKU whole except the heaviest one, which may be split;
2. brute-forces every way to split that heavy SKU across the two trucks;
3. greedily places the remaining whole SKUs into the lighter truck;
4. keeps the most balanced feasible arrangement (pallet balance first, weight
   balance to break ties), honoring a per-country weight override.

In the demo, a 40-pallet delivery is split into a clean **20 + 20**.

### Robustness built in (anti-human-error)

- **Field auto-correction** — operators paste table columns out of order, so each
  cell is classified by its shape (order / delivery / DT / carrier) and assigned
  to the right field regardless of position.
- **Carrier `x`/`v` suffix** — a trailing letter on the carrier name forces the
  shipment type to ZA09, an operator shorthand for a different lane.
- **One failed job never aborts the batch.**

## Run it

```bash
node demo.js
```

It plays all four commands against the in-memory SAP and prints, for each: the
Teams message, what Power Automate parsed, the exact SAP steps performed, and the
message posted back to Teams.

## Project layout

```
src/config.js              Carriers, SAP identifiers, convoy limits, doc patterns
src/carriers.js            Carrier resolution + the x/v suffix rule
src/jobParser.js           Teams message -> jobs (the Power Automate role) + auto-correct
src/convoySplit.js         The weight-balanced 28+28 split optimizer
src/palletization.js       Quantities -> pallets + weight (support table)
src/sap/SapDriver.js       The driver interface (the contract)
src/sap/MockSapDriver.js   In-memory SAP used by the demo/tests
src/handlers/*.js          createDt, convoy, changeCarrier, unlinkDt
src/watcher.js             Job routing + the result message
src/sampleData.js          Synthetic SAP world + product support table
demo.js                    End-to-end run
```

## Tech & concepts

JavaScript (ES modules, zero dependencies) · RPA / SAP GUI automation (modelled) ·
dependency inversion (driver interface + mock) · chat-ops via Microsoft Teams +
Power Automate · job-queue orchestration · constrained bin-packing (convoy split) ·
fault-tolerant batch processing.

## Notes

- The real system runs on Windows via SAP GUI Scripting (WSH/JScript) and a
  OneDrive-backed file queue; a real `SapGuiDriver` would implement `SapDriver`
  against the live GUI. The handlers, parser, optimizer and routing are unchanged.

## License

MIT
