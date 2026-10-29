import { Phrase, VocabularyItem } from '@/types/domain';
import { PhrasebookService } from '@/types/services';
import { SEED_PHRASES } from '@/data/phrasebook';
import { ESSENTIAL_VOCABULARY } from '@/data/vocabulary';
import { db } from './db';
import { normalizeText } from '@/lib/text-normalize';
import { combinedScore } from '@/lib/fuzzy';

const FAVORITES_STORAGE_KEY = 'connectsign-phrasebook-favorites';
const LEGACY_FAVORITES_STORAGE_KEY = 'lsab-phrasebook-favorites';

class AppPhrasebookService implements PhrasebookService {
  private phrases: Phrase[] = SEED_PHRASES;
  private vocabulary: VocabularyItem[] = ESSENTIAL_VOCABULARY;
  private cachedFavorites: Set<string> = new Set();
  private initialized = false;

  constructor() {
    this.initFavorites();
  }

  private initFavorites(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        let raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (!raw) {
          const legacyRaw = localStorage.getItem(LEGACY_FAVORITES_STORAGE_KEY);
          if (legacyRaw) {
            raw = legacyRaw;
            try {
              localStorage.setItem(FAVORITES_STORAGE_KEY, legacyRaw);
              localStorage.removeItem(LEGACY_FAVORITES_STORAGE_KEY);
            } catch {
              // ignore
            }
          }
        }
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((id) => {
              if (typeof id === 'string' && id.trim()) {
                this.cachedFavorites.add(id.trim());
              }
            });
          }
        }
      }
    } catch {
      // Gracefully ignore localStorage access errors
    }
  }

  private async syncWithDb(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    try {
      // Merge any existing Dexie IndexedDB records if present
      const dbItems = await db.favorites.toArray();
      let changed = false;
      for (const item of dbItems) {
        if (item.phraseId && !this.cachedFavorites.has(item.phraseId)) {
          this.cachedFavorites.add(item.phraseId);
          changed = true;
        }
      }

      // Also ensure Dexie has all items from localStorage
      for (const phraseId of this.cachedFavorites) {
        const exists = await db.favorites.get(phraseId);
        if (!exists) {
          await db.favorites.add({ phraseId, createdAt: Date.now() });
        }
      }

      if (changed) {
        this.saveToLocalStorage();
      }
    } catch {
      // IndexedDB might not be available in all contexts, localStorage is source of truth
    }
  }

  private saveToLocalStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const arr = Array.from(this.cachedFavorites);
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(arr));
      }
    } catch {
      // Ignore quota/private mode errors gracefully
    }
  }

  async list(): Promise<Phrase[]> {
    return this.phrases;
  }

  async listVocabulary(): Promise<VocabularyItem[]> {
    return this.vocabulary;
  }

  async search(query: string, filters?: { category?: string; context?: string }): Promise<Phrase[]> {
    await this.syncWithDb();
    const normQ = normalizeText(query);
    const favorites = this.cachedFavorites;

    let list = this.phrases;

    if (filters?.category) {
      if (filters.category === 'favorites') {
        list = list.filter((p) => favorites.has(p.id));
      } else if (filters.category === 'emergency') {
        list = list.filter((p) => p.emergency || p.category === 'emergency');
      } else if (
        filters.category === 'pharmacy_medical' ||
        filters.category === 'symptoms' ||
        filters.category === 'medication'
      ) {
        list = list.filter(
          (p) =>
            p.category === 'pharmacy_medical' ||
            p.category === 'symptoms' ||
            p.category === 'medication'
        );
      } else if (filters.category === 'health_access' || filters.category === 'appointment') {
        list = list.filter(
          (p) => p.category === 'health_access' || p.category === 'appointment'
        );
      } else {
        list = list.filter((p) => p.category === filters.category);
      }
    }

    if (filters?.context && filters.context !== 'all') {
      list = list.filter((p) => p.contexts.includes(filters.context as any));
    }

    if (!normQ) {
      return list;
    }

    return list.filter((p) => {
      const matchFr = normalizeText(p.text.fr).includes(normQ) || combinedScore(normQ, p.text.fr) >= 0.75;
      const matchAr = normalizeText(p.text.ar).includes(normQ) || combinedScore(normQ, p.text.ar) >= 0.75;
      const matchEn = normalizeText(p.text.en).includes(normQ) || combinedScore(normQ, p.text.en) >= 0.75;
      const matchGloss = p.gloss.some((g) => normalizeText(g).includes(normQ));
      return matchFr || matchAr || matchEn || matchGloss;
    });
  }

  async searchVocabulary(
    query: string,
    filters?: { category?: string }
  ): Promise<VocabularyItem[]> {
    await this.syncWithDb();
    const normQ = normalizeText(query);
    const favorites = this.cachedFavorites;

    let list = this.vocabulary;

    if (filters?.category) {
      if (filters.category === 'favorites') {
        list = list.filter((v) => favorites.has(v.id));
      } else {
        list = list.filter((v) => v.category === filters.category);
      }
    }

    if (!normQ) {
      return list;
    }

    return list.filter((v) => {
      const matchFr =
        normalizeText(v.text.fr).includes(normQ) || combinedScore(normQ, v.text.fr) >= 0.75;
      const matchAr =
        normalizeText(v.text.ar).includes(normQ) || combinedScore(normQ, v.text.ar) >= 0.75;
      const matchEn =
        normalizeText(v.text.en).includes(normQ) || combinedScore(normQ, v.text.en) >= 0.75;
      const matchGloss = v.gloss ? normalizeText(v.gloss).includes(normQ) : false;
      return matchFr || matchAr || matchEn || matchGloss;
    });
  }

  async toggleFavorite(phraseId: string): Promise<boolean> {
    await this.syncWithDb();

    let isFav: boolean;
    if (this.cachedFavorites.has(phraseId)) {
      this.cachedFavorites.delete(phraseId);
      isFav = false;
      try {
        await db.favorites.delete(phraseId);
      } catch {
        // ignore
      }
    } else {
      this.cachedFavorites.add(phraseId);
      isFav = true;
      try {
        await db.favorites.add({ phraseId, createdAt: Date.now() });
      } catch {
        // ignore
      }
    }

    this.saveToLocalStorage();
    return isFav;
  }

  async isFavorite(phraseId: string): Promise<boolean> {
    await this.syncWithDb();
    return this.cachedFavorites.has(phraseId);
  }

  async getFavorites(): Promise<string[]> {
    await this.syncWithDb();
    return Array.from(this.cachedFavorites);
  }
}

export const phrasebookService = new AppPhrasebookService();
