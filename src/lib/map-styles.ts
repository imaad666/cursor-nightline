/**
 * Comic yellow land, purple water, gold roads.
 * Aquamarine metro line is drawn separately on top.
 */
export const lightMapStyles: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#FFD54F" }] },
  { elementType: "labels", stylers: [{ visibility: "off" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#FFD54F" }],
  },
  {
    featureType: "landscape.man_made",
    elementType: "geometry",
    stylers: [{ color: "#F5C518" }],
  },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#E6B400" }] },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#E6B400" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#C99600" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#D4A017" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#9B6FD6" }],
  },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

/** Kochi Metro Blue Line — aquamarine. */
export const METRO_LINE_COLOR = "#02B0AF";
export const METRO_LINE_GLOW = "#7EEAEA";
