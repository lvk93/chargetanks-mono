---
layout: layouts/tool.njk
permalink: /tools/cell-reconstruction/
toolSlug: cell-reconstruction
title: Cell Reconstruction
metaTitle: "Full-cell OCV from two electrode tanks | Charge Tanks"
heading: Two tanks, one cell
lead: Hang an anode and a cathode tank from one ceiling, and the cell voltage is the gap between their levels. Voltage window, N/P and lithium inventory decide how much of the tanks you actually use.
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
      - { type: slider, name: np, label: N/P ratio, min: 0.8, max: 1.5, step: 0.01, value: 1 }
      - { type: slider, name: lip, label: Li/P ratio, min: 0.5, max: 1.5, step: 0.01, value: 1 }
tryThis:
  - { query: "anode=graphite&cathode=nmc&soc=1&vmin=2.8&vmax=4.2&np=1.1&lip=0.95", label: "Graphite/NMC at 100 % SoC:", text: "at 4.2 V the cathode tank is almost empty (Q_cath = 0.01 Ah)." }
  - { query: "anode=graphite&cathode=nmc&soc=1&vmin=2.8&vmax=4&np=1.1&lip=0.95", label: "Upper limit 4.0 V instead of 4.2 V:", text: "only 0.72 Ah instead of 0.94 Ah reach the anode. Capacity depends on the voltage window." }
  - { query: "anode=graphite&cathode=nmc&soc=1&vmin=2.8&vmax=4.2&np=0.9&lip=0.95", label: "N/P 0.9:", text: "the anode is smaller than the cathode and is almost full at 100 % SoC." }
readMore: { url: "/blog/lithium-balance/#voltage-window", title: "The lithium balance: the voltage window" }
charts:
  - { id: dqdv, title: Electrode dQ/dV tanks }
  - { id: voltage, title: Voltage vs. SoC }
---

## How to read the charts

- **Tanks:** anode (green) and cathode (orange) on one voltage axis, with the ceiling (Li/Li⁺, 0 V) on top. The arrow is the cell voltage, Q<sub>an</sub> and Q<sub>cath</sub> the lithium in each tank right now.
- **Voltage:** the full-cell OCV between Vmin and Vmax. The dot marks the current SoC.
- **Li/P ratio:** the lithium in play relative to the cathode, the way the lithium balance counts it. N/Li is N/P divided by Li/P.
