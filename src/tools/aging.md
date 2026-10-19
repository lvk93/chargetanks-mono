---
layout: layouts/tool.njk
permalink: /tools/aging/
toolSlug: aging
title: Aging
metaTitle: "Aging modes LLI and LAM in the tank model | Charge Tanks"
heading: Understand Aging Modes with the Tank Analogy
lead: Shrink the anode or cathode tank or remove lithium and see which reservoir limits the usable capacity.
controls:
  - group: Cell settings
    items:
      - { type: select, name: anode, label: Anode, options: anode, value: Ideal Anode }
      - { type: select, name: cathode, label: Cathode, options: cathode, value: Ideal Cathode }
      - { type: slider, name: soc, label: SoC, min: 0, max: 1, step: 0.01, value: 0.5, primary: true }
  - group: Aging modes
    items:
      - { type: slider, name: lampe, label: Cathode LAM (lampe), min: 0, max: 0.5, step: 0.01, value: 0 }
      - { type: slider, name: lamne, label: Anode LAM (lamne), min: 0, max: 0.5, step: 0.01, value: 0 }
      - { type: slider, name: lli, label: LLI (lithium loss), min: 0, max: 0.5, step: 0.01, value: 0 }
tryThis:
  - { query: "anode=graphite&cathode=nmc&lli=0.2", label: "Graphite/NMC with 20 % lithium loss:", text: "SoH drops to 79.79 %." }
  - { query: "anode=graphite&cathode=nmc&lamne=0.1", label: "10 % anode loss:", text: "SoH only drops to 98.84 %, because the anode has headroom (NP ratio 1.1)." }
  - { query: "anode=graphite&cathode=nmc&lamne=0.3", label: "30 % anode loss:", text: "now the anode costs capacity, SoH falls to 83.66 %." }
  - { query: "anode=graphite&cathode=nmc&lampe=0.2", label: "20 % cathode loss:", text: "SoH falls to 84.41 %." }
readMore: { url: "/blog/two-tank-battery-model/#how-do-aging-modes-change-usable-capacity", title: "How do aging modes change usable capacity?" }
charts:
  - { id: tank, title: Electrode dQ/dV tanks }
  - { id: ocv, title: Voltage vs. SoC }
  - { id: caps, title: Capacities (relative to cathode), wide: true, short: true, readout: soh }
---

## What does this tool show?

Think of a battery like **two water tanks** that share the same water.

- One tank is the **anode**, the other is the **cathode**.
- The **water** is like the lithium that moves back and forth.

When you **charge** the battery, you **pump water uphill** into the anode tank. When you **use** the battery, the water flows **downhill** back to the cathode.

The **height difference** between the tanks is the **voltage** of the battery. Each tank has its own **shape** (shown in the **dQ/dV plot**) that tells how much water it can hold at each level.

Over time, the tanks don't stay the same: this is **aging**.

- **Anode aging (LAM-Anode)**: the anode tank shrinks.
- **Cathode aging (LAM-Cathode)**: the cathode tank shrinks.
- **Lithium loss (LLI)**: there's simply less water to move around.

These changes shift the tank levels and make the **OCV curve** look different.

## The knobs you can play with

- **LAM-Anode**: shrink the anode tank
- **LAM-Cathode**: shrink the cathode tank
- **LLI**: reduce the total water

Try the sliders and watch how the tanks, voltage, and battery health change.

## How to read the charts

- **Tanks:** the dashed outlines show the electrodes at beginning of life (BOL), the solid outlines the aged electrodes, the blue filling the lithium at the current SoC. The dotted lines mark the electrode potentials at 0 % and 100 % SoC of the fresh cell; they stay fixed as a BOL reference.
- **Voltage:** the dashed curve is the OCV at BOL, the solid curve the OCV of the aged cell.
- **Capacities:** the bars show lithium, anode and cathode capacity relative to the cathode at BOL; the dashed marks show the BOL values. The dotted white line marks the smallest reservoir. SoH is the usable capacity relative to BOL.
- **Cell settings:** with ideal anode and ideal cathode the cell uses an NP ratio of 1.0, a LiP ratio of 1.0 and a 2.0 to 4.0 V window; every other material pair uses NP 1.1, LiP 0.95 and 2.8 to 4.2 V.
