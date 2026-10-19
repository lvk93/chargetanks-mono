---
layout: layouts/tool.njk
permalink: /tools/swelling/
toolSlug: swelling
title: Swelling
metaTitle: "Battery swelling: breathing, SEI growth and compression | Charge Tanks"
heading: Understand Swelling
lead: See how electrode breathing, SEI growth and stack compression change the thickness of a silicon/NMC cell stack.
controls:
  - group: Swelling conditions
    items:
      - { type: slider, name: soc, label: SoC, min: 0, max: 1, step: 0.01, value: 0.5, primary: true }
      - { type: slider, name: soh, label: State of Health, min: 0.8, max: 1, step: 0.01, value: 1 }
      - { type: checkbox, name: cylindrical, label: "Cylindrical?", value: false }
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

## What does this tool show?

Why can a battery get thicker? Three simple reasons:

1. **Breathing:** when SoC goes up or down, the anode and cathode gently expand and shrink (like lungs).
2. **Irreversible swelling:** over life a thin **SEI "crust"** grows and adds permanent thickness (lower SoH means more swelling).
3. **Compression:** squeezing the stack pushes back.

- **Cylindrical:** the metal can fixes the thickness; you can't tune the squeeze.
- **Pouch/prismatic:** you *can* clamp it (springs/pads). More squeeze means less empty space.

## Knobs

- **SoC** drives breathing.
- **SoH**: lower means more SEI swelling.
- **Cylindrical** switches to the fixed-thickness can.
- **Compression** is the clamp force for pouch and prismatic cells.

Move the sliders and watch the layers and the total thickness respond.

## Model settings

The cell pairs a silicon anode with an NMC cathode (NP ratio 1.1, LiP ratio 0.95, 2.8 to 4.2 V). The stack consists of the anode current collector (18 µm), anode (7 µm), separator (20 µm), cathode (47 µm) and cathode current collector (15 µm), with porosities of 0.3 (anode), 0.4 (separator) and 0.25 (cathode). Thicknesses are normalized to the designed stack: half of each current collector, both coatings and the separator.
