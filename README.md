# Kochi Metro Side Quests

<p align="center">
  <img src="images/IMG_1315-2.png" alt="beautiful face" width="200">
</p>

Kochi Metro Side Quests is a map-first discovery experience for finding
interesting places around Kochi Metro. Start from a station, explore nearby
spots, describe the kind of outing you want, and build a walking plan from
only the places you choose.

## The experience

The interface is designed as a short visual journey rather than a directory:

1. The map loads into the comic-style Kochi Metro world.
2. The Blue Line reveals stations as you zoom in or touch the line.
3. Selecting a station opens nearby places in a ranked deck.
4. The `Closest` view helps optimize for a short walk.
5. `Side Quests` turns natural language into filters for the map.
6. The `+` controls let you curate the stops you actually want.
7. The final selection becomes a walking route in Google Maps.

## Walkthrough

### 1. Kochi Side Quests is loading

The loading state keeps the comic map language alive while the Google Maps
assets initialize.

<p align="center">
  <img src="screenshots/loading.png" alt="Kochi Side Quests loading screen" width="900">
</p>

### 2. Initial metro overview

The first viewport presents Kochi as a glowing metro map: the Blue Line is
operational, the Pink Line is upcoming, and the map remains the hero.

<p align="center">
  <img src="screenshots/initial%20load.png" alt="Initial Kochi Metro Side Quests map" width="900">
</p>

### 3. Discover stations by leaning into the line

Hovering over the glowing Blue Line makes the hidden station rhythm more
discoverable without covering the map in permanent labels.

<p align="center">
  <img src="screenshots/hover_over_line.png" alt="Hovering over the Blue Line to reveal stations" width="900">
</p>

### 4. Select a metro station

Choosing an operational station eases the camera into the stop and opens the
nearby hotspot deck above the map’s lower edge.

<p align="center">
  <img src="screenshots/select_station_on_line.png" alt="Selecting a Kochi Metro station on the line" width="900">
</p>

### 5. Switch to the closest places

The deck supports a `Top rated` and `Closest` view. `Closest` prioritizes real
walking time from the selected station so the first stop stays practical.

<p align="center">
  <img src="screenshots/closest_selection.png" alt="Closest nearby places for the selected station" width="900">
</p>

### 6. Describe a custom Side Quest

The Side Quests chat accepts requests such as:

> I want to do sports at Vyttila, keep it cheap, stay close to the metro, and
> find somewhere open until 9pm.

The request becomes structured filters for station, interest, walking limit,
budget, and opening time. Matching places are then returned to the map.

<p align="center">
  <img src="screenshots/custom_side_quest.png" alt="Creating a custom Side Quest with natural language" width="900">
</p>

### 7. Curate the stops with plus controls

Every fetched location has a `+` control. Add only the places you want to
visit; the route beams and plan count update as the selection changes.

<p align="center">
  <img src="screenshots/added_2_stops_in_custom.png" alt="Adding two custom Side Quest stops to the plan" width="900">
</p>

### 8. Open the final Google Maps plan

Once the stops are selected, `Open Google Maps plan` creates a walking
directions link containing the metro station and only the curated locations.

<p align="center">
  <img src="screenshots/google_maps_plan_created.png" alt="Final Google Maps walking plan created from selected stops" width="900">
</p>

## Why it feels different

- **Map first:** Kochi Metro stays visible throughout the discovery loop.
- **Real nearby places:** Google Places supplies coordinates, photos, ratings,
  opening hours, and walking durations.
- **Natural language planning:** OpenAI converts casual requests into useful
  filters instead of forcing a form-first workflow.
- **Human-curated routes:** Search results are suggestions; the user decides
  which stops become the plan.
- **Walking handoff:** The final route opens in Google Maps with walking mode
  and the selected stops as waypoints.

## Google Maps setup

Create `.env.local` with:

```bash
GOOGLE_MAPS_KEY=your_google_maps_key
OPENAI_API_KEY=your_openai_api_key
```

Keep both keys in `.env.local`, restart the development server after changing
them, and never commit the file or expose either key in client-side code.

```bash
npm install
npm run dev
```
