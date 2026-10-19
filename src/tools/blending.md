---
layout: layouts/tool.njk
permalink: /tools/blending/
toolSlug: blending
title: Blending
metaTitle: "Blended electrodes: graphite and silicon as tanks | Charge Tanks"
heading: Understand Blended Electrodes with the Tank Analogy
lead: Mix graphite (material A) and silicon (material B) in one electrode and see how the blended tank, its voltage and the material states of lithiation follow.
controls:
  - group: Blend setup
    items:
      - { type: slider, name: sol, label: SoL (Blend), min: 0, max: 1, step: 0.01, value: 0.5, primary: true }
      - { type: slider, name: gamma, label: "q% (Material A)", min: 0, max: 1, step: 0.01, value: 0.7, primary: true }
tryThis:
  - { query: "gamma=1", label: "q% = 1:", text: "pure graphite. The blend tank equals the graphite tank." }
  - { query: "gamma=0", label: "q% = 0:", text: "pure silicon." }
  - { query: "sol=0.25&gamma=0.5", label: "Half and half at SoL 0.25:", text: "both materials sit at the same voltage but at different states of lithiation." }
readMore: { url: "/blog/two-tank-battery-model/#how-do-blended-materials-behave", title: "How do blended materials behave?" }
charts:
  - { id: tanks1, title: Tanks of each material }
  - { id: ocv, title: Voltage from water level }
  - { id: tanks2, title: Blend tank (sum of both) }
  - { id: solmap, title: Mapping SoLs to blend SoL }
---

## What does this tool show?

Material A is **graphite**, material B is **silicon**. **q%** is the capacity fraction of material A in the blend.

### 1) The tanks of each material (top left)

Imagine two water tanks side by side.

- Each tank represents one **battery material**.
- The **shape** of the tank tells us how much lithium it can hold at each "height".
- This shape is shown by the curve called **dQ/dV** (capacity per voltage).

In the plot you see:

- Left (green): tank of **material A**, scaled by its capacity fraction (**q%**).
- Right (yellow): tank of **material B**, scaled by **(1-q%)**.
- The light-blue filling marks the **current water level** (voltage).

### 2) The blend tank (bottom left)

If we now put both tanks together, we get the **blend tank**.

- The blend curve is just the **sum** of both separate tanks.
- This shows how the **mixture** of A and B behaves as one electrode.
- Thin green and yellow lines remind you of the individual tanks.
- The thick light-gray line shows the combined response.

### 3) Voltage as water level (top right)

The **height of the water level** is the **voltage** of the blend. As you slide the **blend state of lithiation (θ_blend)**, the level moves up or down. At each level we can read:

- the **OCV of material A** (green),
- the **OCV of material B** (yellow),
- the **OCV of the blend** (light gray, thick line).

The dots show the current operating point for each.

### 4) Mapping SoLs (bottom right)

Here comes the trickier part:

- The **blend SoL** is just one slider you control.
- But inside, each material has its own **SoL** (SoL A, SoL B).
- The curves show how SoL A and SoL B change as SoL Blend moves.
- The dashed line is a simple reference.

## In summary

- Top left: the **individual tanks**.
- Bottom left: the **blend tank** = A + B.
- Top right: the **voltage** comes from the water level.
- Bottom right: the **hidden mapping** between blend SoL and the two material SoLs.

By adjusting **SoL (Blend)** and **q%**, you can explore how different mixtures behave and see how electrode design shapes battery voltage.
