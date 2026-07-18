export type StationStatus = "operational" | "future";

export interface MetroStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: StationStatus;
  /** Places Nearby search radius in meters (walk catchment). */
  searchRadiusM?: number;
}

export const DEFAULT_SEARCH_RADIUS_M = 2000;

export function stationSearchRadius(station: MetroStation): number {
  return station.searchRadiusM ?? DEFAULT_SEARCH_RADIUS_M;
}

/** Blue Line — Aluva → Thrippunithura Terminal (Wikipedia / KMRL coords). */
export const KOCHI_METRO_STATIONS: MetroStation[] = [
  // Outer north — wider catchment
  { id: "aluva", name: "Aluva", lat: 10.1098, lng: 76.3496, status: "operational", searchRadiusM: 2600 },
  {
    id: "pulinchodu",
    name: "Pulinchodu",
    lat: 10.09512,
    lng: 76.346661,
    status: "operational",
    searchRadiusM: 2400,
  },
  {
    id: "companypady",
    name: "Companypady",
    lat: 10.087293,
    lng: 76.34284,
    status: "operational",
    searchRadiusM: 2400,
  },
  {
    id: "ambattukavu",
    name: "Ambattukavu",
    lat: 10.079372,
    lng: 76.339004,
    status: "operational",
    searchRadiusM: 2300,
  },
  { id: "muttom", name: "Muttom", lat: 10.0727, lng: 76.3337, status: "operational", searchRadiusM: 2300 },
  {
    id: "kalamassery",
    name: "Kalamassery",
    lat: 10.0584,
    lng: 76.321926,
    status: "operational",
    searchRadiusM: 2200,
  },
  {
    id: "cusat",
    name: "Cochin University",
    lat: 10.046879,
    lng: 76.318377,
    status: "operational",
    searchRadiusM: 2100,
  },
  {
    id: "pathadipalam",
    name: "Pathadipalam",
    lat: 10.035948,
    lng: 76.314371,
    status: "operational",
    searchRadiusM: 2000,
  },
  {
    id: "edapally",
    name: "Edapally",
    lat: 10.0266556,
    lng: 76.3092583,
    status: "operational",
    searchRadiusM: 1800,
  },
  {
    id: "changampuzha",
    name: "Changampuzha Park",
    lat: 10.0151778,
    lng: 76.3022944,
    status: "operational",
    searchRadiusM: 1900,
  },
  {
    id: "palarivattom",
    name: "Palarivattom",
    lat: 10.0089639,
    lng: 76.30385,
    status: "operational",
    searchRadiusM: 1700,
  },
  {
    id: "jln",
    name: "JLN Stadium",
    lat: 10.0005167,
    lng: 76.2990028,
    status: "operational",
    searchRadiusM: 1700,
  },
  {
    id: "kaloor",
    name: "Kaloor",
    lat: 9.9946167,
    lng: 76.2916028,
    status: "operational",
    searchRadiusM: 1500,
  },
  {
    id: "town-hall",
    name: "Town Hall",
    lat: 9.991222,
    lng: 76.288028,
    status: "operational",
    searchRadiusM: 1400,
  },
  {
    id: "mg-road",
    name: "M.G. Road",
    lat: 9.9840667,
    lng: 76.28205,
    status: "operational",
    searchRadiusM: 1400,
  },
  {
    id: "maharajas",
    name: "Maharaja's College",
    lat: 9.9734278,
    lng: 76.2849889,
    status: "operational",
    searchRadiusM: 1400,
  },
  {
    id: "ernakulam-south",
    name: "Ernakulam South",
    lat: 9.9677556,
    lng: 76.2912778,
    status: "operational",
    searchRadiusM: 1500,
  },
  {
    id: "kadavanthra",
    name: "Kadavanthra",
    lat: 9.9665889,
    lng: 76.2982583,
    status: "operational",
    searchRadiusM: 1700,
  },
  {
    id: "elamkulam",
    name: "Elamkulam",
    lat: 9.967075,
    lng: 76.308364,
    status: "operational",
    searchRadiusM: 1800,
  },
  {
    id: "vyttila",
    name: "Vyttila",
    lat: 9.967477,
    lng: 76.320426,
    status: "operational",
    searchRadiusM: 1900,
  },
  {
    id: "thaikoodam",
    name: "Thaikoodam",
    lat: 9.96008,
    lng: 76.323708,
    status: "operational",
    searchRadiusM: 2100,
  },
  {
    id: "pettah",
    name: "Pettah",
    lat: 9.951161,
    lng: 76.331004,
    status: "operational",
    searchRadiusM: 2300,
  },
  {
    id: "vadakkekotta",
    name: "Vadakkekotta",
    lat: 9.9528,
    lng: 76.3395,
    status: "operational",
    searchRadiusM: 2400,
  },
  {
    id: "sn-junction",
    name: "SN Junction",
    lat: 9.9547,
    lng: 76.3461,
    status: "operational",
    searchRadiusM: 2400,
  },
  {
    id: "thrippunithura",
    name: "Thrippunithura Terminal",
    lat: 9.9503,
    lng: 76.3516,
    status: "operational",
    searchRadiusM: 2600,
  },
];

export const METRO_LINE_PATH = KOCHI_METRO_STATIONS.map((s) => ({
  lat: s.lat,
  lng: s.lng,
}));

/**
 * Phase 2 Pink Line (JLN → Infopark) — under construction / not open for service.
 * Coords are approximate corridor points for map preview only.
 */
export const PINK_LINE_FUTURE_STATIONS: MetroStation[] = [
  {
    id: "pink-jln",
    name: "JLN Stadium",
    lat: 10.0005167,
    lng: 76.2990028,
    status: "operational", // interchange already open on Blue Line
  },
  {
    id: "chembumukku",
    name: "Chembumukku",
    lat: 10.0128,
    lng: 76.3185,
    status: "future",
  },
  {
    id: "vazhakkala",
    name: "Vazhakkala",
    lat: 10.0165,
    lng: 76.332,
    status: "future",
  },
  {
    id: "padamugal",
    name: "Padamugal",
    lat: 10.0142,
    lng: 76.3425,
    status: "future",
  },
  {
    id: "kakkanad-jn",
    name: "Kakkanad Jn",
    lat: 10.0155,
    lng: 76.3518,
    status: "future",
  },
  {
    id: "infopark",
    name: "Infopark",
    lat: 10.0108,
    lng: 76.3625,
    status: "future",
  },
];

export const PINK_LINE_PATH = PINK_LINE_FUTURE_STATIONS.map((s) => ({
  lat: s.lat,
  lng: s.lng,
}));

/** All stations drawn on the map (Blue live + Pink coming soon). */
export const ALL_MAP_STATIONS: MetroStation[] = [
  ...KOCHI_METRO_STATIONS,
  ...PINK_LINE_FUTURE_STATIONS.filter((s) => s.status === "future"),
];

export const OPERATIONAL_COUNT = KOCHI_METRO_STATIONS.filter(
  (s) => s.status === "operational",
).length;
export const FUTURE_COUNT = PINK_LINE_FUTURE_STATIONS.filter(
  (s) => s.status === "future",
).length;

/** Fixed major place names — offset off the metro corridor so they don't sit on the line. */
export const MAJOR_PLACES = [
  { id: "aluva", name: "Aluva", lat: 10.1098, lng: 76.362 }, // east of line
  { id: "edapally", name: "Edapally", lat: 10.0267, lng: 76.322 }, // east
  { id: "ernakulam", name: "Ernakulam", lat: 9.9816, lng: 76.27 }, // west of MG Road stretch
  { id: "fort-kochi", name: "Fort Kochi", lat: 9.965, lng: 76.242 }, // already west
  { id: "vyttila", name: "Vyttila", lat: 9.958, lng: 76.333 }, // southeast of hub
  { id: "thrippunithura", name: "Thrippunithura", lat: 9.938, lng: 76.358 }, // south of terminal
] as const;

/** Rough center of the Blue Line for initial camera. */
export const KOCHI_MAP_CENTER = { lat: 10.02, lng: 76.31 };
export const KOCHI_MAP_ZOOM = 12;
