---
layout: layouts/tool.njk
permalink: /tools/materials/
toolSlug: materials
title: Materials
metaTitle: "Electrode materials as tanks: dQ/dV and OCV | Charge Tanks"
heading: Understand Materials with the Tank Analogy
lead: Pick an electrode material and fill it with lithium to see how the tank shape and the voltage curve belong together.
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

## What does this tool show?

This tool shows how a **single electrode material** behaves inside a battery, using the **tank analogy**.

- Think of the material as a tank that can be filled with lithium, just like filling water into a container.
- The **curve shape** of the tank tells us how much lithium fits at each "height".
- The **steep parts** of the curve (big dQ/dV) mean the material can take in a lot of lithium without much change in voltage, like a wide part of the tank.
- The **flat parts** mean even a small amount of lithium changes the voltage a lot, like a narrow neck of the tank.

The **tank view** shows the dQ/dV shape of the tank, the **voltage chart** shows how the voltage changes as the tank fills (the OCV curve). Observe how peaks in the dQ/dV show up as plateaus in the OCV curve.

By moving the **SoL** slider (state of lithiation), you can explore how the lithium filling level relates to both views at the same time.
