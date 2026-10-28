import { normalizeText, tokenize } from './text-normalize';

/**
 * Computes Damerau-Levenshtein edit distance between two strings,
 * accounting for insertions, deletions, substitutions, and adjacent transpositions.
 */
export function damerauLevenshteinDistance(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const matrix: number[][] = Array.from({ length: al + 1 }, () => Array(bl + 1).fill(0));

  for (let i = 0; i <= al; i++) matrix[i]![0] = i;
  for (let j = 0; j <= bl; j++) matrix[0]![j] = j;

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let min = Math.min(
        matrix[i - 1]![j]! + 1,      // deletion
        matrix[i]![j - 1]! + 1,      // insertion
        matrix[i - 1]![j - 1]! + cost // substitution
      );

      // Transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        min = Math.min(min, matrix[i - 2]![j - 2]! + cost);
      }

      matrix[i]![j] = min;
    }
  }

  return matrix[al]![bl]!;
}

/**
 * Computes normalized similarity score (0.0 to 1.0) based on Damerau-Levenshtein distance.
 */
export function stringSimilarity(a: string, b: string): number {
  const normA = normalizeText(a);
  const normB = normalizeText(b);

  if (normA === normB) return 1.0;
  if (!normA || !normB) return 0.0;

  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1.0;

  const distance = damerauLevenshteinDistance(normA, normB);
  return Math.max(0, 1 - distance / maxLen);
}

/**
 * Computes Jaccard index similarity between token sets of two strings.
 */
export function tokenSetSimilarity(a: string, b: string): number {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));

  if (tokensA.size === 0 && tokensB.size === 0) return 1.0;
  if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersection++;
    }
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return intersection / union;
}

export function combinedScore(input: string, candidate: string): number {
  const strSim = stringSimilarity(input, candidate);
  const tokSim = tokenSetSimilarity(input, candidate);
  return Math.max(strSim, tokSim * 0.7 + strSim * 0.3);
}

// Duration Slot templates
export interface SlotMatchResult {
  matched: boolean;
  gloss: string[];
  durationGloss?: string;
}

const DURATION_DICT: Record<string, { fr: string[]; ar: string[]; en: string[] }> = {
  YESTERDAY: {
    fr: ['hier'],
    ar: ['امس', 'البارحة'],
    en: ['yesterday']
  },
  TODAY: {
    fr: ["aujourd'hui", 'aujourd hui'],
    ar: ['اليوم'],
    en: ['today']
  },
  TWO_DAYS: {
    fr: ['deux jours', '2 jours'],
    ar: ['يومين', '2 ايام'],
    en: ['two days', '2 days']
  },
  ONE_WEEK: {
    fr: ['une semaine', '1 semaine'],
    ar: ['اسبوع', '1 اسبوع'],
    en: ['a week', 'one week', '1 week']
  }
};

export function matchDurationSlot(input: string, lang: 'fr' | 'ar' | 'en'): SlotMatchResult | null {
  const norm = normalizeText(input);

  let prefixMatch = false;
  let remaining = '';

  if (lang === 'fr' && (norm.startsWith('depuis') || norm.startsWith('il y a'))) {
    prefixMatch = true;
    remaining = norm.replace(/^(depuis|il y a)\s*/, '');
  } else if (lang === 'ar' && (norm.startsWith('منذ') || norm.startsWith('من'))) {
    prefixMatch = true;
    remaining = norm.replace(/^(منذ|من)\s*/, '');
  } else if (lang === 'en' && (norm.startsWith('since') || norm.startsWith('for'))) {
    prefixMatch = true;
    remaining = norm.replace(/^(since|for)\s*/, '');
  }

  if (!prefixMatch) return null;

  for (const [durKey, dict] of Object.entries(DURATION_DICT)) {
    const variants = dict[lang];
    for (const v of variants) {
      const normV = normalizeText(v);
      if (remaining === normV || stringSimilarity(remaining, normV) >= 0.8) {
        return {
          matched: true,
          gloss: ['SINCE', durKey],
          durationGloss: durKey
        };
      }
    }
  }

  return null;
}
