import { ConfidenceLevel } from '@/types/domain';

const CONFIDENCE_HIGH = Number(import.meta.env.VITE_CONFIDENCE_HIGH || 0.85);
const CONFIDENCE_THRESHOLD = Number(import.meta.env.VITE_CONFIDENCE_THRESHOLD || 0.70);

/**
 * Maps a normalized confidence score (0.0 to 1.0) to discrete UI confidence tiers.
 *
 * @param score - Normalized model confidence probability.
 * @returns 'high' | 'medium' | 'low' based on configured environmental thresholds.
 */
export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= CONFIDENCE_HIGH) return 'high';
  if (score >= CONFIDENCE_THRESHOLD) return 'medium';
  return 'low';
}

/**
 * Formats a probability value as a human-friendly rounded percentage string (e.g. 85%).
 *
 * @param score - Normalized confidence score (0.0 to 1.0).
 * @returns Formatted percentage string.
 */
export function formatConfidencePercent(score: number): string {
  return `${Math.round(score * 100)}%`;
}
