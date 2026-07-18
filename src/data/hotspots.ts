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
  book_store: "Book Nook",
  library: "Book Nook",
  art_gallery: "Art Walk",
  museum: "Art Walk",
  shopping_mall: "Shopping",
  clothing_store: "Shopping",
  department_store: "Shopping",
  market: "Shopping",
  tourist_attraction: "Local Spot",
  viewpoint: "Rooftop Views",
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
