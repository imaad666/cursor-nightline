export interface MetroFact {
  id: string;
  label: string;
  body: string;
}

/** Line facts for the floating comic caption (KMRL / press-reported). */
export const METRO_FACTS: MetroFact[] = [
  {
    id: "line",
    label: "Blue Line",
    body: "Aluva → Thrippunithura · ~28 km · 25 stations. Phase 1 wrapped in March 2024.",
  },
  {
    id: "color",
    label: "Aquamarine",
    body: "Official coach & brand colour — blue-green for Kochi’s water and calm. Priority seats: lime green.",
  },
  {
    id: "women",
    label: "Women-run",
    body: "World’s first rapid transit whose entire management operations are handled by women.",
  },
  {
    id: "inclusion",
    label: "Inclusion first",
    body: "Among the first Indian public agencies to formally employ transgender staff at stations.",
  },
  {
    id: "stations",
    label: "Themed stops",
    body: "Every station is designed around a Kerala culture or geography theme.",
  },
  {
    id: "green",
    label: "Solar + gardens",
    body: "Solar on stations and depot, plus vertical gardens on metro pillars.",
  },
  {
    id: "opened",
    label: "June 2017",
    body: "First stretch (Aluva → Palarivattom) opened by the Prime Minister on 17 June 2017.",
  },
  {
    id: "cbtc",
    label: "CBTC brains",
    body: "First Indian metro to use Communication Based Train Control — built ready for driverless ops.",
  },
  {
    id: "kochi-one",
    label: "Kochi One",
    body: "One card, one app — metro, buses, and more under a single mobility ticket.",
  },
  {
    id: "award",
    label: "Best mobility",
    body: "Named Best Urban Mobility Project in India (Urban Mobility India, 2017).",
  },
  {
    id: "water",
    label: "Port city line",
    body: "Built for a city where land melts into water — colour and design pulled from Kochi’s coast.",
  },
  {
    id: "pink",
    label: "Pink Line next",
    body: "Phase 2 (Pink Line) toward Infopark / Kakkanad is the next chapter of the network.",
  },
];
