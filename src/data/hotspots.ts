export type HotspotTag =
  | "Cozy Cafe"
  | "Date Night"
  | "Action Movie"
  | "Street Food"
  | "Park Stroll"
  | "Rooftop Views"
  | "Live Music"
  | "Book Nook"
  | "Dessert Spot"
  | "Art Walk"
  | "Shopping"
  | "Social Spot"
  | "Culture Fix"
  | "Play Time"
  | "Outdoor Hang"
  | "Wellness"
  | "Local Market"
  | "Local Spot";

/** Map pin icon category. */
export type PlaceKind =
  | "cafe"
  | "restaurant"
  | "movie"
  | "park"
  | "dessert"
  | "music"
  | "books"
  | "art"
  | "shop"
  | "place";

export interface Hotspot {
  id: string;
  stationId: string;
  name: string;
  tag: HotspotTag;
  kind: PlaceKind;
  walkMins: number;
  lat: number;
  lng: number;
  image: string;
  blurb: string;
  rating?: number;
  ratingCount?: number;
  priceLevel?: number;
  openingHours?: string[];
  address?: string;
  mapsUri?: string;
  photoAttribution?: string;
}

const TYPE_TAG: Record<string, HotspotTag> = {
  cafe: "Cozy Cafe",
  coffee_shop: "Cozy Cafe",
  restaurant: "Date Night",
  fine_dining_restaurant: "Date Night",
  meal_takeaway: "Street Food",
  meal_delivery: "Street Food",
  fast_food_restaurant: "Street Food",
  indian_restaurant: "Street Food",
  movie_theater: "Action Movie",
  park: "Park Stroll",
  national_park: "Park Stroll",
  garden: "Park Stroll",
  bakery: "Dessert Spot",
  ice_cream_shop: "Dessert Spot",
  dessert_shop: "Dessert Spot",
  confectionery: "Dessert Spot",
  bar: "Live Music",
  night_club: "Live Music",
  pub: "Live Music",
  live_music_venue: "Live Music",
  comedy_club: "Social Spot",
  karaoke: "Social Spot",
  cocktail_bar: "Social Spot",
  brewery: "Social Spot",
  brewpub: "Social Spot",
  beer_garden: "Social Spot",
  gastropub: "Social Spot",
  book_store: "Book Nook",
  library: "Book Nook",
  art_gallery: "Art Walk",
  art_museum: "Culture Fix",
  art_studio: "Culture Fix",
  auditorium: "Culture Fix",
  concert_hall: "Culture Fix",
  cultural_center: "Culture Fix",
  cultural_landmark: "Culture Fix",
  history_museum: "Culture Fix",
  museum: "Art Walk",
  performing_arts_theater: "Culture Fix",
  planetarium: "Culture Fix",
  aquarium: "Play Time",
  amusement_center: "Play Time",
  amusement_park: "Play Time",
  bowling_alley: "Play Time",
  go_karting_venue: "Play Time",
  indoor_playground: "Play Time",
  miniature_golf_course: "Play Time",
  paintball_center: "Play Time",
  video_arcade: "Play Time",
  shopping_mall: "Shopping",
  clothing_store: "Shopping",
  department_store: "Shopping",
  gift_shop: "Local Market",
  flea_market: "Local Market",
  farmers_market: "Local Market",
  market: "Local Market",
  thrift_store: "Local Market",
  botanical_garden: "Outdoor Hang",
  city_park: "Outdoor Hang",
  dog_park: "Outdoor Hang",
  hiking_area: "Outdoor Hang",
  observation_deck: "Rooftop Views",
  picnic_ground: "Outdoor Hang",
  plaza: "Outdoor Hang",
  tourist_attraction: "Outdoor Hang",
  viewpoint: "Rooftop Views",
  fitness_center: "Wellness",
  gym: "Wellness",
  sports_club: "Wellness",
  sports_complex: "Wellness",
  swimming_pool: "Wellness",
};

const TAG_KIND: Record<HotspotTag, PlaceKind> = {
  "Cozy Cafe": "cafe",
  "Date Night": "restaurant",
  "Street Food": "restaurant",
  "Action Movie": "movie",
  "Park Stroll": "park",
  "Rooftop Views": "park",
  "Dessert Spot": "dessert",
  "Live Music": "music",
  "Book Nook": "books",
  "Art Walk": "art",
  Shopping: "shop",
  "Social Spot": "music",
  "Culture Fix": "art",
  "Play Time": "place",
  "Outdoor Hang": "park",
  Wellness: "place",
  "Local Market": "shop",
  "Local Spot": "place",
};

export function tagFromPlaceTypes(
  primaryType?: string,
  types: string[] = [],
): HotspotTag {
  if (primaryType && TYPE_TAG[primaryType]) return TYPE_TAG[primaryType];
  for (const t of types) {
    if (TYPE_TAG[t]) return TYPE_TAG[t];
  }
  return "Local Spot";
}

export function kindFromTag(tag: HotspotTag): PlaceKind {
  return TAG_KIND[tag];
}

export function distanceMetersBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const meters = 2 * R * Math.asin(Math.sqrt(h));
  return meters;
}

/** Fallback estimate used only when Google Routes cannot return a duration. */
export function walkMinsBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  return Math.max(1, Math.round(distanceMetersBetween(a, b) / 80));
}

/** Open Google Maps walking directions from A → B. */
export function mapsWalkingRouteUrl(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): string {
  const params = new URLSearchParams({
    api: "1",
    origin: `${from.lat},${from.lng}`,
    destination: `${to.lat},${to.lng}`,
    travelmode: "walking",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Open a multi-stop walking plan in Google Maps. */
export function mapsWalkingPlanUrl(
  from: { lat: number; lng: number },
  stops: Array<{ lat: number; lng: number }>,
): string {
  if (stops.length === 0) return mapsWalkingRouteUrl(from, from);
  const destination = stops[stops.length - 1];
  const params = new URLSearchParams({
    api: "1",
    origin: `${from.lat},${from.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: "walking",
  });
  const waypoints = stops
    .slice(0, -1)
    .map((stop) => `${stop.lat},${stop.lng}`)
    .join("|");
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
