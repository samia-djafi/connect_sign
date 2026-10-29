import { LocalProfile, ProfileStorageService } from '@/types/profile';
import { generateId } from '@/lib/ids';

export const PROFILE_STORAGE_KEY = 'connectsign-profile';
export const LEGACY_PROFILE_STORAGE_KEY = 'lsab-profile';

// Safe in-memory fallback cache when localStorage is disabled or throws
let memoryProfileCache: LocalProfile | null = null;

function isStorageAvailable(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  try {
    const testKey = '__cs_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export class LocalProfileService implements ProfileStorageService {
  /**
   * Retrieves existing profile or null if not yet created.
   * Handles invalid JSON, missing fields, or inaccessible storage safely.
   */
  getProfile(): LocalProfile | null {
    if (!isStorageAvailable()) {
      return memoryProfileCache;
    }

    try {
      let raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
      if (!raw) {
        // Transparent backward compatibility: migrate legacy profile key if present
        const legacyRaw = window.localStorage.getItem(LEGACY_PROFILE_STORAGE_KEY);
        if (legacyRaw) {
          raw = legacyRaw;
          try {
            window.localStorage.setItem(PROFILE_STORAGE_KEY, legacyRaw);
            window.localStorage.removeItem(LEGACY_PROFILE_STORAGE_KEY);
          } catch {
            // ignore non-critical migration write error
          }
        }
      }

      if (!raw) {
        return memoryProfileCache;
      }

      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof parsed.id === 'string' &&
        (typeof parsed.preferredName === 'string' || parsed.preferredName === null) &&
        typeof parsed.createdAt === 'string'
      ) {
        const validated: LocalProfile = {
          id: parsed.id,
          preferredName: parsed.preferredName,
          createdAt: parsed.createdAt,
          updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : parsed.createdAt,
        };
        memoryProfileCache = validated;
        return validated;
      }
      return memoryProfileCache;
    } catch (err) {
      console.warn('ConnectSign: Failed to read local profile, falling back gracefully:', err);
      return memoryProfileCache;
    }
  }

  /**
   * Creates or overwrites profile with the given preferredName (or null if guest/skipped).
   */
  saveProfile(preferredName: string | null): LocalProfile {
    const existing = this.getProfile();
    const now = new Date().toISOString();
    const cleanName = preferredName && preferredName.trim().length > 0 ? preferredName.trim() : null;

    const profile: LocalProfile = {
      id: existing?.id || generateId('prof'),
      preferredName: cleanName,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    memoryProfileCache = profile;

    if (isStorageAvailable()) {
      try {
        window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
      } catch (err) {
        console.warn('ConnectSign: Failed to persist local profile to localStorage:', err);
      }
    }

    return profile;
  }

  /**
   * Updates only preferredName on existing profile (creating one if none exists).
   */
  updatePreferredName(preferredName: string | null): LocalProfile {
    return this.saveProfile(preferredName);
  }

  /**
   * Clears the profile from storage and cache.
   */
  clearProfile(): void {
    memoryProfileCache = null;
    if (isStorageAvailable()) {
      try {
        window.localStorage.removeItem(PROFILE_STORAGE_KEY);
        window.localStorage.removeItem(LEGACY_PROFILE_STORAGE_KEY);
      } catch (err) {
        console.warn('ConnectSign: Failed to clear local profile:', err);
      }
    }
  }

  /**
   * Ensures a profile exists without overwriting an existing one.
   */
  ensureProfile(): LocalProfile {
    const existing = this.getProfile();
    if (existing) {
      return existing;
    }
    return this.saveProfile(null);
  }
}

export const profileService = new LocalProfileService();
