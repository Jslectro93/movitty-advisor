// ── Color & vehicle dictionaries (used on client parsing) ──────

export const COLORS_ES_EN: Record<string, string> = {
    blanco: 'White', blanca: 'White', white: 'White',
    negro: 'Black', negra: 'Black', black: 'Black',
    rojo: 'Red', roja: 'Red', red: 'Red',
    azul: 'Blue', blue: 'Blue',
    gris: 'Gray', grey: 'Gray', gray: 'Gray',
    plateado: 'Silver', plata: 'Silver', silver: 'Silver',
    verde: 'Green', green: 'Green',
    amarillo: 'Yellow', yellow: 'Yellow',
    naranja: 'Orange', orange: 'Orange',
    cafe: 'Brown', café: 'Brown', marron: 'Brown', marrón: 'Brown', brown: 'Brown',
    beige: 'Beige',
    dorado: 'Gold', gold: 'Gold',
    morado: 'Purple', violeta: 'Purple', purple: 'Purple',
    'azul marino': 'Blue',
};

export const MAKE_MODELS: Record<string, string[]> = {
    Toyota: ['corolla', 'camry', 'rav4', 'highlander', 'tacoma', 'tundra', '4runner', 'sienna', 'prius', 'yaris', 'venza', 'chr', 'c-hr'],
    Honda: ['civic', 'accord', 'crv', 'cr-v', 'hrv', 'hr-v', 'pilot', 'odyssey', 'ridgeline', 'passport', 'fit'],
    Chevrolet: ['silverado', 'malibu', 'equinox', 'traverse', 'tahoe', 'suburban', 'trax', 'blazer', 'trailblazer', 'camaro', 'corvette'],
    Ford: ['f-150', 'f150', 'mustang', 'explorer', 'escape', 'edge', 'bronco', 'ranger', 'expedition', 'fusion', 'maverick'],
    Nissan: ['altima', 'sentra', 'maxima', 'rogue', 'murano', 'pathfinder', 'armada', 'frontier', 'titan', 'versa', 'kicks'],
    Hyundai: ['elantra', 'sonata', 'tucson', 'santa fe', 'palisade', 'kona', 'ioniq', 'accent'],
    Kia: ['optima', 'k5', 'sorento', 'sportage', 'forte', 'rio', 'soul', 'telluride', 'carnival', 'stinger', 'ev6', 'niro'],
    Jeep: ['wrangler', 'cherokee', 'grand cherokee', 'compass', 'renegade', 'gladiator'],
    BMW: ['3 series', '5 series', '7 series', 'x3', 'x5', 'x1', 'x7'],
    Mercedes: ['c-class', 'e-class', 's-class', 'glc', 'gle', 'gla', 'gls', 'cla'],
    Audi: ['a3', 'a4', 'a6', 'a8', 'q3', 'q5', 'q7', 'q8'],
    Volkswagen: ['jetta', 'passat', 'golf', 'tiguan', 'atlas', 'taos'],
    Subaru: ['outback', 'forester', 'crosstrek', 'impreza', 'legacy', 'ascent', 'wrx'],
    Mazda: ['mazda3', 'mazda6', 'cx-5', 'cx-9', 'cx-30', 'cx-50'],
    Dodge: ['charger', 'challenger', 'durango', 'hornet'],
    Ram: ['1500', '2500', '3500'],
    GMC: ['sierra', 'canyon', 'terrain', 'acadia', 'yukon'],
    Lexus: ['es', 'is', 'gs', 'ls', 'ux', 'nx', 'rx', 'gx', 'lx'],
    Cadillac: ['escalade', 'ct4', 'ct5', 'xt4', 'xt5', 'xt6', 'lyriq'],
    Tesla: ['model 3', 'model y', 'model s', 'model x', 'cybertruck'],
    Genesis: ['g70', 'g80', 'g90', 'gv70', 'gv80'],
    Mitsubishi: ['outlander', 'eclipse cross', 'mirage'],
    Porsche: ['911', 'cayenne', 'macan', 'panamera', 'taycan'],
};

export const MODEL_TO_MAKE: Record<string, string> = {};
for (const [make, models] of Object.entries(MAKE_MODELS)) {
    for (const m of models) MODEL_TO_MAKE[m] = make;
}

export const STOPWORDS = new Set([
    'en', 'cerca', 'de', 'o', 'el', 'la', 'los', 'las', 'un', 'una', 'año',
    'color', 'auto', 'carro', 'vehiculo', 'vehículo', 'nuevo', 'usado',
    'busco', 'quiero', 'necesito', 'dame', 'trae', 'y', 'con', 'para',
    'fl', 'tx', 'ca', 'ny', 'nj', 'ga', 'nc', 'sc', 'az', 'co', 'wa', 'or', 'il',
    'florida', 'texas', 'california', 'georgia',
]);

export interface ParsedQuery {
    year?: string;
    make?: string;
    model?: string;
    color?: string;
    location_raw?: string;
    model_free?: string;
}

export function parseQuery(raw: string): ParsedQuery {
    let text = raw.toLowerCase().trim();
    const found: ParsedQuery = {};

    // Year
    const yearMatch = text.match(/\b(19[89]\d|20[012]\d)\b/);
    if (yearMatch) { found.year = yearMatch[1]; text = text.replace(yearMatch[1], ' '); }

    // Color (longest match first)
    for (const esColor of Object.keys(COLORS_ES_EN).sort((a, b) => b.length - a.length)) {
        if (text.includes(esColor)) {
            found.color = COLORS_ES_EN[esColor];
            text = text.replace(esColor, ' ');
            break;
        }
    }

    // Location
    const locMatch = text.match(/\b(?:en|cerca\s+de|cerca)\s+(.+?)(?:\s+o\s+cerca.*)?$/);
    if (locMatch) {
        const locWords = locMatch[1].trim().replace(/\s+o\s*$/, '').split(' ').filter(w => !['o', 'cerca', 'de', 'el', 'la'].includes(w));
        found.location_raw = locWords.join(' ');
        text = text.slice(0, locMatch.index);
    }

    // Make / Model
    let remaining = text.split(' ').filter(w => !STOPWORDS.has(w) && w.length > 1).join(' ');

    // 1. Detect known makes directly
    for (const mk of Object.keys(MAKE_MODELS)) {
        if (remaining.includes(mk.toLowerCase())) {
            found.make = mk;
            remaining = remaining.replace(mk.toLowerCase(), ' ').replace(/\s+/g, ' ').trim();
            break;
        }
    }

    // 2. Detect specific models and optionally override make
    for (const mKey of Object.keys(MODEL_TO_MAKE).sort((a, b) => b.length - a.length)) {
        if (remaining.includes(mKey)) {
            found.make = MODEL_TO_MAKE[mKey];
            found.model = mKey.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            remaining = remaining.replace(mKey, ' ').replace(/\s+/g, ' ').trim();
            break;
        }
    }

    // 3. Any leftover parts become model_free
    const leftover = remaining.split(' ').filter(Boolean);
    if (leftover.length) {
        found.model_free = leftover.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    return found;
}
