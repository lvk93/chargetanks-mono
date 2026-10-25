---
layout: layouts/tool.njk
permalink: /tools/cell-reconstruction/
toolSlug: cell-reconstruction
title: Cell Reconstruction
metaTitle: "Full-cell OCV from two electrode tanks | Charge Tanks"
heading: Understand Batteries with the Tank Analogy
lead: Combine an anode and a cathode tank into a full cell and see how voltage limits, NP ratio and lithium inventory shape its OCV.
controls:
  - group: Cell settings
    items:
      - { type: select, name: anode, label: Anode, options: anode, value: Ideal Anode }
      - { type: select, name: cathode, label: Cathode, options: cathode, value: Ideal Cathode }
      - { type: slider, name: soc, label: SoC, min: 0, max: 1, step: 0.01, value: 0.5, primary: true }
  - group: Cutoff voltages
    items:
      - { type: slider, name: vmin, label: "V min [V]", min: 2, max: 3.5, step: 0.01, value: 2 }
      - { type: slider, name: vmax, label: "V max [V]", min: 3.5, max: 4.5, step: 0.01, value: 4 }
  - group: Capacity ratios
    items:
      - { type: slider, name: np, label: NP Ratio, min: 0.8, max: 1.5, step: 0.01, value: 1 }
      - { type: slider, name: lip, label: LiP Ratio, min: 0.5, max: 1.5, step: 0.01, value: 1 }
tryThis:
  - { query: "anode=graphite&cathode=nmc&soc=1&vmin=2.8&vmax=4.2&np=1.1&lip=0.95", label: "Graphite/NMC at 100 % SoC:", text: "at 4.2 V the cathode tank is almost empty (Q_cath = 0.01 Ah)." }
  - { query: "anode=graphite&cathode=nmc&soc=1&vmin=2.8&vmax=4&np=1.1&lip=0.95", label: "Upper limit 4.0 V instead of 4.2 V:", text: "only 0.72 Ah instead of 0.94 Ah reach the anode. Capacity depends on the voltage window." }
  - { query: "anode=graphite&cathode=nmc&soc=1&vmin=2.8&vmax=4.2&np=0.9&lip=0.95", label: "NP ratio 0.9:", text: "the anode is smaller than the cathode and is almost full at 100 % SoC." }
readMore: { url: "/learn/lithium-balance/#voltage-window", title: "The lithium balance: the voltage window" }
charts:
  - { id: dqdv, title: Electrode dQ/dV tanks }
  - { id: voltage, title: Voltage vs. SoC }
---

## What does this tool show?

Think of a battery like **two water tanks** that share the same water.

- One tank is the **anode**, the other is the **cathode**.
- The **water** is like the lithium that moves back and forth.

When you **charge** the battery, you **pump water uphill** into the anode tank. When you **use** the battery, the water flows **downhill** back to the cathode.

The **height difference** between the two tanks is the **voltage** of the battery. That's how much "push" the battery can give.

Each tank has its own **shape**. Some parts are wide (can hold a lot of water), some are narrow (hold less). This shape is shown in the **dQ/dV plot**.

If we keep track of the height difference as the tanks fill and empty, we get the **OCV curve**, the battery's special fingerprint.

## The knobs you can play with

- **SoC**: how full the tanks are right now
- **Vmin & Vmax**: the lowest and highest "water levels" we allow
- **NP ratio**: how big one tank is compared to the other
- **LiP ratio**: how much total water (lithium) is in the system

Turn the knobs and watch how the tanks and the voltage curve change.
