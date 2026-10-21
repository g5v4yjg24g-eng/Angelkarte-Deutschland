// Artenliste (Entwurf, M2). Status: deutsche Namen + wissenschaftliche Namen, noch NICHT gegen das
// GBIF-Backbone geprüft (DATA_SOURCES §4, offene Prüfung). IDs sind stabile Schlüssel und werden nicht umbenannt.
export interface Species {
  id: string;
  de: string;
  sci?: string;
  aliases?: string[];
}

export const SPECIES: readonly Species[] = [
  { id: 'perch', de: 'Flussbarsch', sci: 'Perca fluviatilis', aliases: ['Barsch'] },
  { id: 'pike', de: 'Hecht', sci: 'Esox lucius' },
  { id: 'zander', de: 'Zander', sci: 'Sander lucioperca' },
  { id: 'carp', de: 'Karpfen', sci: 'Cyprinus carpio' },
  { id: 'tench', de: 'Schleie', sci: 'Tinca tinca' },
  { id: 'roach', de: 'Rotauge', sci: 'Rutilus rutilus', aliases: ['Plötze'] },
  { id: 'rudd', de: 'Rotfeder', sci: 'Scardinius erythrophthalmus' },
  { id: 'bream', de: 'Brasse', sci: 'Abramis brama', aliases: ['Brachse', 'Blei'] },
  { id: 'silver_bream', de: 'Güster', sci: 'Blicca bjoerkna' },
  { id: 'eel', de: 'Aal', sci: 'Anguilla anguilla' },
  { id: 'wels', de: 'Wels', sci: 'Silurus glanis', aliases: ['Waller'] },
  { id: 'brown_trout', de: 'Bachforelle', sci: 'Salmo trutta' },
  { id: 'rainbow_trout', de: 'Regenbogenforelle', sci: 'Oncorhynchus mykiss' },
  { id: 'grayling', de: 'Äsche', sci: 'Thymallus thymallus' },
  { id: 'chub', de: 'Döbel', sci: 'Squalius cephalus', aliases: ['Aitel'] },
  { id: 'ide', de: 'Aland', sci: 'Leuciscus idus', aliases: ['Orfe'] },
  { id: 'asp', de: 'Rapfen', sci: 'Leuciscus aspius' },
  { id: 'barbel', de: 'Barbe', sci: 'Barbus barbus' },
  { id: 'nase', de: 'Nase', sci: 'Chondrostoma nasus' },
  { id: 'crucian_carp', de: 'Karausche', sci: 'Carassius carassius' },
  { id: 'gibel_carp', de: 'Giebel', sci: 'Carassius gibelio' },
  { id: 'bleak', de: 'Ukelei', sci: 'Alburnus alburnus' },
  { id: 'dace', de: 'Hasel', sci: 'Leuciscus leuciscus' },
  { id: 'gudgeon', de: 'Gründling', sci: 'Gobio gobio' },
  { id: 'ruffe', de: 'Kaulbarsch', sci: 'Gymnocephalus cernua' },
  { id: 'burbot', de: 'Quappe', sci: 'Lota lota', aliases: ['Rutte'] },
  { id: 'grass_carp', de: 'Graskarpfen', sci: 'Ctenopharyngodon idella' },
  { id: 'arctic_char', de: 'Seesaibling', sci: 'Salvelinus alpinus' },
  { id: 'brook_trout', de: 'Bachsaibling', sci: 'Salvelinus fontinalis' },
  { id: 'whitefish', de: 'Renke/Maräne', sci: 'Coregonus spp.', aliases: ['Renke', 'Maräne', 'Felchen'] },
  { id: 'round_goby', de: 'Schwarzmundgrundel', sci: 'Neogobius melanostomus' },
  { id: 'other', de: 'Andere Art' },
];

const byId = new Map(SPECIES.map((s) => [s.id, s]));
export const speciesById = (id: string | undefined) => (id ? byId.get(id) : undefined);

const norm = (s: string) => s.trim().toLowerCase();
/** Name (auch Alias) → Art-ID; undefined, wenn unbekannt. */
export function speciesIdFromName(name: string): string | undefined {
  const n = norm(name);
  return SPECIES.find((s) => norm(s.de) === n || s.aliases?.some((a) => norm(a) === n))?.id;
}
