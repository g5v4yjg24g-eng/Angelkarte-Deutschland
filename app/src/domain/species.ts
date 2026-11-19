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
  { id: 'asp', de: 'Rapfen', sci: 'Leuciscus aspius', aliases: ['Schied'] },
  { id: 'barbel', de: 'Barbe', sci: 'Barbus barbus' },
  { id: 'nase', de: 'Nase', sci: 'Chondrostoma nasus' },
  { id: 'crucian_carp', de: 'Karausche', sci: 'Carassius carassius' },
  { id: 'gibel_carp', de: 'Giebel', sci: 'Carassius gibelio', aliases: ['Silberkarausche'] },
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
  // Ergänzt 2026-10-25 (Wunsch Nutzer). Stör als Gattung: geangelt werden oft Zuchtstöre (z. B. Sterlet,
  // Sibirischer Stör); deshalb keine Gleichsetzung mit dem geschützten Europäischen Stör (Acipenser sturio).
  { id: 'salmon', de: 'Lachs', sci: 'Salmo salar', aliases: ['Atlantischer Lachs'] },
  { id: 'sea_trout', de: 'Meerforelle', sci: 'Salmo trutta trutta' },
  { id: 'sturgeon', de: 'Stör', sci: 'Acipenser spp.' },
  // Ergänzt 2026-11-19 (Wunsch Nutzer: „es fehlen noch viele Fischarten“). Süßwasser- und Meeresfische, die in
  // Deutschland geangelt oder gefangen werden; Namen und wissenschaftliche Namen noch nicht gegen GBIF geprüft
  // (DATA_SOURCES §4). Zu diesen Arten gibt es keine Rechtsdaten – die Prüfung beim Fang meldet dort nichts.
  { id: 'huchen', de: 'Huchen', sci: 'Hucho hucho', aliases: ['Donaulachs'] },
  { id: 'lake_trout', de: 'Seeforelle', sci: 'Salmo trutta lacustris' },
  { id: 'sterlet', de: 'Sterlet', sci: 'Acipenser ruthenus' },
  { id: 'silver_carp', de: 'Silberkarpfen', sci: 'Hypophthalmichthys molitrix' },
  { id: 'bighead_carp', de: 'Marmorkarpfen', sci: 'Hypophthalmichthys nobilis' },
  { id: 'topmouth_gudgeon', de: 'Blaubandbärbling', sci: 'Pseudorasbora parva' },
  { id: 'minnow', de: 'Elritze', sci: 'Phoxinus phoxinus' },
  { id: 'spirlin', de: 'Schneider', sci: 'Alburnoides bipunctatus' },
  { id: 'belica', de: 'Moderlieschen', sci: 'Leucaspius delineatus' },
  { id: 'vimba', de: 'Zährte', sci: 'Vimba vimba', aliases: ['Rußnase'] },
  { id: 'blue_bream', de: 'Zope', sci: 'Ballerus ballerus' },
  { id: 'white_eyed_bream', de: 'Zobel', sci: 'Ballerus sapa' },
  { id: 'stone_loach', de: 'Bartgrundel', sci: 'Barbatula barbatula', aliases: ['Schmerle'] },
  { id: 'spined_loach', de: 'Steinbeißer', sci: 'Cobitis taenia' },
  { id: 'weatherfish', de: 'Schlammpeitzger', sci: 'Misgurnus fossilis' },
  { id: 'bullhead', de: 'Mühlkoppe', sci: 'Cottus gobio', aliases: ['Koppe', 'Groppe'] },
  { id: 'stickleback', de: 'Dreistachliger Stichling', sci: 'Gasterosteus aculeatus' },
  { id: 'ninespine_stickleback', de: 'Neunstachliger Stichling', sci: 'Pungitius pungitius' },
  { id: 'brown_bullhead', de: 'Zwergwels', sci: 'Ameiurus nebulosus' },
  { id: 'pumpkinseed', de: 'Sonnenbarsch', sci: 'Lepomis gibbosus' },
  { id: 'volga_pikeperch', de: 'Wolgazander', sci: 'Sander volgensis' },
  { id: 'smelt', de: 'Stint', sci: 'Osmerus eperlanus' },
  { id: 'allis_shad', de: 'Maifisch', sci: 'Alosa alosa' },
  { id: 'twaite_shad', de: 'Finte', sci: 'Alosa fallax' },
  { id: 'cod', de: 'Dorsch', sci: 'Gadus morhua', aliases: ['Kabeljau'] },
  { id: 'haddock', de: 'Schellfisch', sci: 'Melanogrammus aeglefinus' },
  { id: 'whiting', de: 'Wittling', sci: 'Merlangius merlangus' },
  { id: 'pollack', de: 'Pollack', sci: 'Pollachius pollachius' },
  { id: 'saithe', de: 'Köhler', sci: 'Pollachius virens', aliases: ['Seelachs'] },
  { id: 'herring', de: 'Hering', sci: 'Clupea harengus' },
  { id: 'sprat', de: 'Sprotte', sci: 'Sprattus sprattus' },
  { id: 'garfish', de: 'Hornhecht', sci: 'Belone belone' },
  { id: 'flounder', de: 'Flunder', sci: 'Platichthys flesus' },
  { id: 'plaice', de: 'Scholle', sci: 'Pleuronectes platessa' },
  { id: 'dab', de: 'Kliesche', sci: 'Limanda limanda' },
  { id: 'turbot', de: 'Steinbutt', sci: 'Scophthalmus maximus' },
  { id: 'brill', de: 'Glattbutt', sci: 'Scophthalmus rhombus' },
  { id: 'sole', de: 'Seezunge', sci: 'Solea solea' },
  { id: 'seabass', de: 'Wolfsbarsch', sci: 'Dicentrarchus labrax' },
  { id: 'mackerel', de: 'Makrele', sci: 'Scomber scombrus' },
  { id: 'eelpout', de: 'Aalmutter', sci: 'Zoarces viviparus' },
  { id: 'sea_scorpion', de: 'Seeskorpion', sci: 'Myoxocephalus scorpius' },
  { id: 'thicklip_mullet', de: 'Dicklippige Meeräsche', sci: 'Chelon labrosus', aliases: ['Meeräsche'] },
  { id: 'gurnard', de: 'Knurrhahn', sci: 'Triglidae' },
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
