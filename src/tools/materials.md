---
layout: layouts/tool.njk
permalink: /tools/materials/
toolSlug: materials
title: Materials
metaTitle: "Electrode materials as tanks: dQ/dV and OCV | Charge Tanks"
heading: One material, one tank
lead: Fill one electrode material with lithium and watch where the level moves fast and where it barely moves.
controls:
  - group: Material
    items:
      - { type: select, name: material, label: Material, options: all, value: Ideal Anode, primary: true }
      - { type: slider, name: sol, label: SoL, min: 0, max: 1, step: 0.01, value: 0.5, primary: true }
tryThis:
  - { query: "material=nca&sol=0.6", label: "NCA at SoL 0.6:", text: "a real cathode. Where the tank is wide, the voltage curve is flat." }
  - { query: "sol=0.2", label: "Ideal anode at SoL 0.2:", text: "a tank of constant width, so the voltage changes linearly with the fill level." }
readMore: { url: "/blog/lithium-balance/#voltage-window", title: "The lithium balance: two tanks on one ceiling" }
charts:
  - { id: dqdv, title: Electrode dQ/dV tank }
  - { id: voltage, title: Voltage vs. SoL }
---

## How to read the charts

- **Tank:** the width at each voltage is the material's dQ/dV. The filling is the lithium at the current state of lithiation (SoL).
- **Voltage:** the same state as a dot on the voltage curve.
