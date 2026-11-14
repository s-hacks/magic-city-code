// Layer groups the legend chips can show or hide. Deck.gl lights are filtered in
// MapView.renderFrame; base-map layers carry metadata.group (see mapStyle.ts).
export type LayerGroup = "residents" | "need" | "stores" | "sites" | "hubs" | "streets" | "buildings";
