---
name: kochi-metro-side-quests
description: Build and refine the Kochi Metro map-based nearby-spots experience. Use for map UI, station data, Google Maps and Places integrations, hotspot ranking, camera behavior, and visual design changes in this repository.
---

# Kochi Metro Side Quests

This is a map-first local discovery product, not a generic directory. The
experience must feel recognisably like Kochi Metro before its logo is read.

## Start here

Read [reference.md](reference.md) before changing the map, nearby-place flow,
visual language, or project architecture. It contains the full product brief,
data and API contracts, interaction rules, workflows, and release checklist.

## Working principles

1. Make the map the hero and keep chrome sparse.
2. Preserve the comic-yellow world, ink borders, and Fraunces + Outfit type
   system; do not introduce generic dashboard styling.
3. Use real place coordinates and protect the Google Maps key.
4. Make station selection, camera movement, and deck navigation feel smooth
   and direct—never jumpy or over-animated.
5. Return both `rated` and `closest` nearby-place lists from one fetch.
6. Keep the selected station and active pin visible above the bottom deck.

## Before handing off work

- Check the idle, station-selected, and dismissal states.
- Confirm a selected card pans to its pin without zoom thrash.
- Confirm `Top rated` and `Closest` differ and need no second fetch.
- Run the relevant lint or build validation.
- Keep commits focused; use one file per commit when asked to work “one by
  one.”
