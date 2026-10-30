---
layout: layouts/tool.njk
permalink: /tools/blending/
toolSlug: blending
title: Blending
metaTitle: "Blended electrodes: graphite and silicon as tanks | Charge Tanks"
heading: Two materials, one level
lead: Graphite (A) and silicon (B) in one electrode fill up together, and the lithium goes wherever the tank is wider.
controls:
  - group: Blend setup
    items:
      - { type: slider, name: sol, label: SoL (blend), min: 0, max: 1, step: 0.01, value: 0.5, primary: true }
      - { type: slider, name: gamma, label: "Graphite share (A)", min: 0, max: 1, step: 0.01, value: 0.7, primary: true }
tryThis:
  - { query: "gamma=1", label: "Graphite share 1:", text: "pure graphite. The blend tank equals the graphite tank." }
  - { query: "gamma=0", label: "Graphite share 0:", text: "pure silicon." }
  - { query: "sol=0.25&gamma=0.5", label: "Half and half at SoL 0.25:", text: "both materials sit at the same voltage but at different states of lithiation." }
readMore: { url: "/blog/lithium-balance/#blends", title: "The lithium balance: blended electrodes" }
charts:
  - { id: tanks1, title: Tanks of each material }
  - { id: ocv, title: Voltage from water level }
  - { id: tanks2, title: Blend tank (sum of both) }
  - { id: solmap, title: Mapping SoLs to blend SoL }
---

## How to read the charts

Material A is graphite, material B is silicon. The graphite share is A's fraction of the electrode's capacity.

- **Tanks of each material:** graphite (green), scaled by its share, and silicon (orange), scaled by the rest. The light-blue filling is the current level.
- **Voltage from water level:** the OCV of graphite, silicon and the blend (thick line). The dots sit at the current level, at the same voltage for all three.
- **Blend tank:** the sum of both tanks, so the blend behaves like one electrode. The thin lines are the single materials.
- **Mapping SoLs to blend SoL:** how full graphite and silicon each are while the blend fills. The dashed line is the blend itself, for reference.
