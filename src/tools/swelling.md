---
layout: layouts/tool.njk
permalink: /tools/swelling/
toolSlug: swelling
title: Swelling
metaTitle: "Battery swelling: breathing, SEI growth and compression | Charge Tanks"
heading: Why cells get thicker
lead: A silicon/NMC stack breathes with the state of charge, grows with its SEI and pushes back when you clamp it.
controls:
  - group: Swelling conditions
    items:
      - { type: slider, name: soc, label: SoC, min: 0, max: 1, step: 0.01, value: 0.5, primary: true }
      - { type: slider, name: soh, label: State of health, min: 0.8, max: 1, step: 0.01, value: 1 }
      - { type: checkbox, name: cylindrical, label: "Cylindrical can", value: false }
      - { type: slider, name: compression, label: "Compression [MPa]", min: 0, max: 60, step: 1, value: 0, decimals: 0 }
tryThis:
  - { query: "soh=0.8", label: "SoH 0.80:", text: "the SEI layer adds permanent thickness, the total grows from 1.051 to 1.123." }
  - { query: "soc=1", label: "SoC 1.00:", text: "the electrodes breathe, the total thickness is 1.094 instead of 1.000 at SoC 0." }
  - { query: "cylindrical=1", label: "Cylindrical can:", text: "the thickness is fixed, so the compression follows from the swelling." }
charts:
  - { id: layers, title: Electrode stack geometry }
  - { id: classes, title: Stack by categories }
  - { id: compression, title: Compression vs. porosity, wide: true }
---

## What makes a cell thicker

- **Breathing:** both electrodes change volume with the state of charge, the silicon anode most of all. The SoC slider drives it.
- **SEI growth:** the SEI keeps growing over life and adds thickness that never goes away. The lower the SoH, the thicker the stack.
- **Compression:** clamp a pouch or prismatic cell and you squeeze the pores: the stack gets thinner, the porosity drops. A cylindrical can fixes the thickness instead.

## Model settings

The cell pairs a silicon anode with an NMC cathode (N/P 1.1, Li/P 0.95, 2.8 to 4.2 V). The stack consists of the anode current collector (18 µm), anode (7 µm), separator (20 µm), cathode (47 µm) and cathode current collector (15 µm), with porosities of 0.3 (anode), 0.4 (separator) and 0.25 (cathode). Thicknesses are normalized to the designed stack: half of each current collector, both coatings and the separator.
