---
title: "Two-tank battery model: a practical way to understand voltage, capacity, and aging"
date: 2026-03-03
modified: 2026-03-16
description: "Learn how the two-tank battery model explains cell voltage, usable capacity, NP ratio, aging, lithium inventory, and dQ/dV in one coherent framework."
thumbnail: /images/introduction_post/2026-03-03_twotank_charge.png
thumbnailAlt: "Two connected tanks showing lithium moving during battery charging."
thumbnailWidth: 1102
thumbnailHeight: 702
ogImage: /images/introduction_post/2026-03-03_twotank_charge.png
ogImageAlt: "Two connected tanks showing lithium moving during battery charging."
category: Basics
readTime: 7 min read
tldr: "The two-tank battery model treats the anode and cathode as connected lithium reservoirs. Fill levels explain voltage, voltage limits define usable capacity, NP ratio explains anode oversizing, and aging depends on which reservoir becomes limiting."
definition: "The two-tank battery model is a battery analogy in which the anode and cathode are represented as two connected tanks that store the same lithium at different heights."
keyQuestion: "What is the two-tank battery model?"
keyAnswer: "It is a physically motivated way to visualize how lithium moves between the electrodes, why voltage depends on state of charge, why capacity depends on voltage limits, and why design margins such as NP ratio matter."
llms: "Foundational article explaining the two-tank battery model, voltage, capacity, NP ratio, aging, and dQ/dV."
---

Many battery discussions jump straight into equations, plots, or acronyms. That works once you already have intuition. The harder part is building a mental picture that lets you look at a voltage curve, a capacity number, or an aging trend and immediately ask whether it makes physical sense.

The two-tank battery model is the picture I keep coming back to. It simplifies the cell without breaking the important relationships. That makes it useful both for human readers and for tools that need a short, quotable explanation.

## What is the two-tank battery model?

### Definition

Imagine the battery as a system of two connected tanks. The anode tank sits on the hill, the cathode tank sits in the valley, and the water inside represents lithium. Charging pushes lithium into the anode tank. Discharging lets lithium move back into the cathode tank.

### Explanation

This picture is useful because it keeps three ideas together:

- lithium has to be conserved
- the electrodes store that lithium at different potentials
- the cell voltage depends on the difference between those potentials

If you can picture those three statements at the same time, many battery concepts stop feeling disconnected.

### Example

If you add lithium to the anode during charge, the anode fill level changes. If you remove lithium during discharge, the cathode fill level changes. The battery response is therefore not just a material property in isolation. It depends on where the lithium currently sits.

![Charge and discharge in the tank analogy](/images/introduction_post/2026-03-03_twotank_charge.png)

## Why does cell voltage come from height difference?

The simplest reading of the model is that cell voltage equals the height difference between the two lithium levels. A larger difference means a larger cell voltage. A smaller difference means a smaller cell voltage.

That also explains why voltage changes with state of charge. As soon as lithium moves between the tanks, the fill levels move, so the height difference changes as well. In electrochemical language, the electrode potentials shift as lithium content changes.

This operating range is usually called the voltage window.

![Cell voltage as the height difference between the two tanks](/images/introduction_post/2026-03-03_twotank_voltage.png)

## What is cell capacity in the two-tank model?

It is tempting to say that capacity is simply the amount of lithium in the system. In practice, usable cell capacity is the amount of lithium that can move **between the lower and upper voltage limits**. Those cutoff voltages define the accessible part of the reservoirs.

That is why capacity is not a universal battery constant. It depends on the voltage window, current, temperature, and the condition of the materials. The same physical cell can deliver different usable capacity under different operating conditions.

In the tank picture, the relevant question is not "How much water exists?" but "How much water can move before one of the voltage limits is reached?"

![Voltage limits in the tank analogy](/images/introduction_post/2026-03-03_twotank_voltage_limits.png)

## What is NP ratio in batteries?

The NP ratio compares anode capacity with cathode capacity. It is a design check for whether the anode is large enough to accept the lithium that arrives during charge.

In the two-tank model, this becomes geometric. If the anode reservoir is too small, the lithium level rises to the top too early. A ratio slightly above 1 gives the anode some headroom instead of designing it exactly at the edge.

![NP ratio in the tank analogy](/images/introduction_post/2026-03-03_twotank_npratio.png)

## Why are anodes larger than cathodes?

When the cell is assembled, the cyclable lithium mostly starts on the cathode side. During formation and later charging, that lithium has to fit into the anode. If the anode is not large enough, the system is forced into an unsafe region where lithium plating becomes more likely.

That is why practical cells usually make the anode somewhat larger than the minimum theoretical value. The exact margin depends on chemistry, loading, temperature, rate capability, and lifetime targets, but the principle is straightforward: you want room for lithium to arrive safely.

## How do aging modes change usable capacity?

The two-tank model helps because it separates three quantities that can become limiting over lifetime:

- anode capacity
- cathode capacity
- lithium inventory

Not every loss mode hurts the cell in the same way. The practical cell capacity is controlled by whichever reservoir is limiting under the chosen voltage window. If a loss mode affects a non-limiting reservoir, the measured capacity may barely move at first. If it affects the limiting one, the capacity drops directly.

This is one reason aging interpretation can be misleading when people only look at a single capacity number without asking which physical quantity became limiting.

![Aging modes in the tank analogy](/images/introduction_post/2026-03-03_twotank_aging.png)

## How do blended materials behave?

The same picture also helps with blended active materials such as graphite plus silicon or LFP plus NMC. In equilibrium, the blended materials must share the same electrode potential. In the tank picture, that means they settle to the same fill height even if their shapes are different.

Once you know the tank shape of each material, you can see when one material contributes more strongly than the other and how the balance shifts across the operating range.

![Blended electrode materials in the tank analogy](/images/introduction_post/2026-03-03_twotank_blends.png)

## What does dQ/dV mean in the two-tank model?

The dQ/dV curve can be interpreted as the local cross-sectional area of the tank. Wide tank sections correspond to voltage plateaus because a large amount of lithium moves with only a small voltage change. Narrow sections correspond to steep voltage regions because small lithium movements change the voltage more strongly.

This is the point where the analogy stops being a loose metaphor and becomes a compact way to visualize a real electrochemical relationship.

![Graphite dQ/dV curve as the shape of a tank](/images/introduction_post/2026-03-03_graphite_dqdv.png)

## Where should you go next?

If you want to move from intuition to interaction, open the [battery tools](/tools/) and vary the parameters yourself. The article is meant to stand on its own even before the rest of the content library exists.

The point of Charge Tanks is not to replace electrochemistry with a metaphor. It is to make the underlying relationships easier to remember, discuss, and inspect. Explore the [tool suite](/tools/), connect on [LinkedIn](https://www.linkedin.com/in/lars-von-kolzenberg/), or send me an [email](mailto:lars@chargetanks.com).
