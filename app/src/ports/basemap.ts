// Port für die Basiskarte (ARCHITECTURE §1, E2). Ein Wechsel des Anbieters betrifft nur den Adapter.
export type MapTheme = 'light' | 'dark';

export interface BasemapProvider {
  id: string;
  /** URL eines MapLibre-Stils. */
  styleUrl(theme: MapTheme): string;
  /** Hosts, die der Stil nachlädt (für Tests und eine spätere Content-Security-Policy). */
  hosts: string[];
  /** Schrift für Beschriftungen eigener Ebenen; genutzt nur, wenn der geladene Stil Glyphen anbietet. */
  glyphFont: string[];
  /** Anpassungen nach dem Laden des Stils (fehlende Ebenen werden übersprungen). */
  adjustments(theme: MapTheme): StyleAdjustments;
}

export interface StyleAdjustments {
  hideLayers?: string[];
  /** [Ebene, Paint-Eigenschaft, Wert] */
  paint?: [layer: string, property: string, value: string | number][];
}
