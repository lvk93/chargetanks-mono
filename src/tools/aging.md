---
layout: layouts/tool.njk
permalink: /tools/aging/
toolSlug: aging
title: Aging
metaTitle: "Aging modes LLI and LAM in the tank model | Charge Tanks"
heading: Three things a cell can lose
lead: Take away lithium or active material and see which loss the capacity actually notices.
controls:
  - group: Cell settings
    items:
      - { type: select, name: anode, label: Anode, options: anode, value: Ideal Anode }
      - { type: select, name: cathode, label: Cathode, options: cathode, value: Ideal Cathode }
      - { type: slider, name: soc, label: SoC, min: 0, max: 1, step: 0.01, value: 0.5, primary: true }
  - group: Aging modes
    items:
      - { type: slider, name: lampe, label: Cathode loss (LAM), min: 0, max: 0.5, step: 0.01, value: 0 }
      - { type: slider, name: lamne, label: Anode loss (LAM), min: 0, max: 0.5, step: 0.01, value: 0 }
      - { type: slider, name: lli, label: Lithium loss (LLI), min: 0, max: 0.5, step: 0.01, value: 0 }
tryThis:
  - { query: "anode=graphite&cathode=nmc&lli=0.2", label: "Graphite/NMC with 20 % lithium loss:", text: "SoH drops to 79.79 %." }
  - { query: "anode=graphite&cathode=nmc&lamne=0.1", label: "10 % anode loss:", text: "SoH only drops to 98.84 %, because the anode has headroom (N/P 1.1)." }
  - { query: "anode=graphite&cathode=nmc&lamne=0.3", label: "30 % anode loss:", text: "now the anode costs capacity, SoH falls to 83.66 %." }
  - { query: "anode=graphite&cathode=nmc&lampe=0.2", label: "20 % cathode loss:", text: "SoH falls to 84.41 %." }
readMore: { url: "/blog/lithium-balance/#aging", title: "The lithium balance: aging modes" }
charts:
  - { id: tank, title: Electrode dQ/dV tanks }
  - { id: ocv, title: Voltage vs. SoC }
  - { id: caps, title: Capacities (relative to cathode), wide: true, short: true, readout: soh }
---

## How to read the charts

- **Tanks:** the dashed outlines show the electrodes at beginning of life (BOL), the solid outlines the aged electrodes, the blue filling the lithium at the current SoC. The dotted lines mark the electrode potentials at 0 % and 100 % SoC of the fresh cell; they stay fixed as a BOL reference.
- **Voltage:** the dashed curve is the OCV at BOL, the solid curve the OCV of the aged cell.
- **Capacities:** the bars show lithium, anode and cathode capacity relative to the cathode at BOL; the dashed marks show the BOL values. The dotted white line marks the smallest reservoir. SoH is the usable capacity relative to BOL.
- **Cell settings:** with ideal anode and ideal cathode the cell uses an N/P ratio of 1.0, a Li/P ratio of 1.0 and a 2.0 to 4.0 V window; every other material pair uses N/P 1.1, Li/P 0.95 and 2.8 to 4.2 V.
