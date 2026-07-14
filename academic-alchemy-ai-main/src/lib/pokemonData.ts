export type Rarity = 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary';

export const LEGENDARY_IDS = new Set<number>([
  144,145,146,150,151,
  243,244,245,249,250,251,
  377,378,379,380,381,382,383,384,385,386,
  480,481,482,483,484,485,486,487,488,489,490,491,492,493,
  494,638,639,640,641,642,643,644,645,646,647,648,649,
]);

export const VERY_RARE_IDS = new Set<number>([
  3,6,9,94,130,131,143,149,
  196,197,229,230,248,
  350,373,376,
  445,448,461,468,471,473,477,
  571,609,612,635,637,
]);

export const RARE_IDS = new Set<number>([
  34,65,68,71,76,80,89,91,103,105,110,112,113,115,
  121,122,123,124,125,126,127,128,132,134,135,136,138,139,140,141,142,
  154,157,160,169,176,181,182,184,186,195,198,199,200,
  206,208,210,212,214,217,219,221,224,232,234,237,241,242,
  257,260,282,306,310,319,330,334,338,344,348,357,359,362,365,368,371,375,
  392,395,398,405,407,409,411,416,419,423,426,430,432,
  435,437,442,444,452,455,457,460,462,463,464,465,466,
  467,469,470,474,475,476,478,479,
  497,500,503,508,512,516,521,526,530,534,537,542,545,
  549,553,555,559,561,567,569,573,579,584,591,596,598,604,606,617,620,623,626,632,
]);

export const getRarity = (id: number): Rarity => {
  if (LEGENDARY_IDS.has(id)) return 'legendary';
  if (VERY_RARE_IDS.has(id)) return 'very_rare';
  if (RARE_IDS.has(id)) return 'rare';
  return id % 3 === 0 ? 'uncommon' : 'common';
};

export const RARITY_COLORS: Record<Rarity, string> = {
  legendary: 'text-yellow-400',
  very_rare: 'text-purple-400',
  rare:      'text-blue-400',
  uncommon:  'text-green-400',
  common:    'text-gray-400',
};

export const RARITY_BG: Record<Rarity, string> = {
  legendary: 'bg-yellow-400/15 border-yellow-400/40',
  very_rare: 'bg-purple-400/15 border-purple-400/40',
  rare:      'bg-blue-400/15 border-blue-400/40',
  uncommon:  'bg-green-400/15 border-green-400/40',
  common:    'bg-white/5 border-white/10',
};

export const RARITY_LABEL: Record<Rarity, string> = {
  legendary: '★ Legendary',
  very_rare: '◆ Very Rare',
  rare:      '◇ Rare',
  uncommon:  '• Uncommon',
  common:    '· Common',
};

// Gen ranges for filter tabs
export const GEN_RANGES: Record<number, [number, number]> = {
  1: [1,   151],
  2: [152, 251],
  3: [252, 386],
  4: [387, 493],
  5: [494, 649],
};

// Animated GIF (Gen 1–5 all have these from Black/White sprites)
export const getAnimatedSprite = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${id}.gif`;

// Static PNG fallback
export const getStaticSprite = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;

// Pokemon cry audio
export const getCryUrl = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${id}.ogg`;

// Type emojis
export const TYPE_EMOJIS: Record<string, string> = {
  fire: '🔥', water: '💧', grass: '🌿', electric: '⚡', psychic: '🔮',
  ice: '❄️', dragon: '🐉', dark: '🌑', fairy: '✨', fighting: '💪',
  poison: '☠️', ground: '🌍', flying: '🌤️', rock: '🪨', bug: '🐛',
  ghost: '👻', steel: '⚙️', normal: '⭐',
};

// Fetch + cache Pokemon types
export const fetchPokemonTypes = async (id: number): Promise<string[]> => {
  const key = `studyspark_types_${id}`;
  const cached = localStorage.getItem(key);
  if (cached) { try { return JSON.parse(cached); } catch {} }
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    if (!res.ok) return ['normal'];
    const data = await res.json();
    const types: string[] = data.types.map((t: { type: { name: string } }) => t.type.name);
    localStorage.setItem(key, JSON.stringify(types));
    return types;
  } catch { return ['normal']; }
};

// Fetch + cache flavor text from species endpoint (Pokemon-specific speech content)
export const fetchPokemonFlavor = async (id: number): Promise<string> => {
  const key = `studyspark_flavor_${id}`;
  const cached = localStorage.getItem(key);
  if (cached) return cached;
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
    if (!res.ok) return '';
    const data = await res.json();
    const entries: { language: { name: string }; flavor_text: string }[] = data.flavor_text_entries;
    const english = entries.filter(e => e.language.name === 'en');
    if (!english.length) return '';
    // Pick randomly from first 8 entries for variety
    const entry = english[Math.floor(Math.random() * Math.min(english.length, 8))];
    const clean = entry.flavor_text.replace(/[\f\n\r\u00ad]/g, ' ').replace(/\s+/g, ' ').trim();
    localStorage.setItem(key, clean);
    return clean;
  } catch { return ''; }
};

// Fetch + cache all 649 names from PokeAPI
const CACHE_KEY = 'studyspark_pokemon_names_v1';

export const loadPokemonNames = async (): Promise<Record<number, string>> => {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try { return JSON.parse(cached); } catch { /* fall through */ }
  }
  try {
    const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=649&offset=0');
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    const map: Record<number, string> = {};
    for (const p of data.results as { name: string; url: string }[]) {
      const parts = p.url.split('/').filter(Boolean);
      const id = parseInt(parts[parts.length - 1]);
      if (id >= 1 && id <= 649) {
        map[id] = p.name.charAt(0).toUpperCase() + p.name.slice(1);
      }
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(map));
    return map;
  } catch {
    // Return a sparse map with ID-based names as fallback
    const fallback: Record<number, string> = {};
    for (let i = 1; i <= 649; i++) fallback[i] = `#${i}`;
    return fallback;
  }
};
