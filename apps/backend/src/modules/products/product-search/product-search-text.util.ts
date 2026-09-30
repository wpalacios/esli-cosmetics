const SPANISH_STOP_WORDS = new Set([
  "a",
  "al",
  "con",
  "de",
  "del",
  "el",
  "en",
  "grande",
  "la",
  "las",
  "limpieza",
  "lo",
  "los",
  "marca",
  "para",
  "por",
  "que",
  "un",
  "una",
  "uno",
  "y",
]);

const SYNONYM_GROUPS: readonly string[][] = [
  ["pcs", "piezas", "pzas", "und", "unidades"],
  ["liquidacion", "liquidación"],
  ["jabon", "jabón"],
  ["ducha", "bano", "baño"],
  ["combo", "paquete", "kit"],
];

export function normalizeSearchText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeSearchQuery(input: string): string[] {
  const normalized = normalizeSearchText(input);
  if (!normalized) return [];

  return normalized
    .split(/\s+/)
    .filter(token => token.length > 0 && !SPANISH_STOP_WORDS.has(token));
}

export function expandSynonymsForToken(token: string): string[] {
  const normalized = normalizeSearchText(token);
  const variants = new Set<string>([normalized]);

  for (const group of SYNONYM_GROUPS) {
    const normalizedGroup = group.map(g => normalizeSearchText(g));
    if (normalizedGroup.includes(normalized)) {
      for (const synonym of normalizedGroup) {
        variants.add(synonym);
      }
    }
  }

  return [...variants];
}

/** Token groups where each inner array is OR variants for one required token. */
export function buildTokenGroups(rawQuery: string): string[][] {
  const tokens = tokenizeSearchQuery(rawQuery);
  if (tokens.length === 0) {
    const normalized = normalizeSearchText(rawQuery);
    return normalized ? [[normalized]] : [];
  }

  return tokens.map(token => expandSynonymsForToken(token));
}

export function expandSearchQueries(raw: string, maxVariants = 4): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const seen = new Set<string>();
  const variants: string[] = [];

  const push = (value: string) => {
    const v = value.trim();
    if (!v) return;
    const key = v.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    variants.push(v);
  };

  push(trimmed);
  push(normalizeSearchText(trimmed));

  const tokens = tokenizeSearchQuery(trimmed);
  if (tokens.length > 0) {
    push(tokens.join(" "));
    push(tokens.flatMap(t => expandSynonymsForToken(t)).join(" "));
    for (const token of tokens) {
      if (token.length >= 3 || /^\d+$/.test(token)) push(token);
    }
  }

  return variants.slice(0, maxVariants);
}
