import { describe, it, expect, beforeEach } from 'vitest';
import { LocalProfileService, PROFILE_STORAGE_KEY, LEGACY_PROFILE_STORAGE_KEY } from '@/services/profile-service';

describe('LocalProfileService', () => {
  let service: LocalProfileService;

  beforeEach(() => {
    localStorage.clear();
    service = new LocalProfileService();
    service.clearProfile();
  });

  it('returns null when no profile exists initially', () => {
    expect(service.getProfile()).toBeNull();
  });

  it('creates and saves a preferred name with a stable identifier and timestamps', () => {
    const profile = service.saveProfile('Samia');

    expect(profile).toBeDefined();
    expect(profile.id).toBeDefined();
    expect(profile.preferredName).toBe('Samia');
    expect(profile.createdAt).toBeDefined();
    expect(profile.updatedAt).toBeDefined();

    const stored = service.getProfile();
    expect(stored).toEqual(profile);
    expect(localStorage.getItem(PROFILE_STORAGE_KEY)).toContain('Samia');
  });

  it('trims leading and trailing whitespace from the preferred name', () => {
    const profile = service.saveProfile('  Amine  ');
    expect(profile.preferredName).toBe('Amine');
  });

  it('treats whitespace-only names as null (guest profile)', () => {
    const profile = service.saveProfile('     ');
    expect(profile.preferredName).toBeNull();
  });

  it('preserves existing profile id and createdAt when updating preferredName', () => {
    const initial = service.saveProfile('Initial Name');
    const initialId = initial.id;
    const initialCreatedAt = initial.createdAt;

    const updated = service.updatePreferredName('New Name');
    expect(updated.id).toBe(initialId);
    expect(updated.createdAt).toBe(initialCreatedAt);
    expect(updated.preferredName).toBe('New Name');
  });

  it('ensureProfile creates a profile only if none exists and does not overwrite existing ones', () => {
    const created = service.ensureProfile();
    expect(created.id).toBeDefined();
    expect(created.preferredName).toBeNull();

    service.updatePreferredName('Karim');

    const ensuredAgain = service.ensureProfile();
    expect(ensuredAgain.id).toBe(created.id);
    expect(ensuredAgain.preferredName).toBe('Karim');
  });

  it('handles invalid JSON in localStorage safely without throwing', () => {
    localStorage.setItem(PROFILE_STORAGE_KEY, '{invalid json');
    const profile = service.getProfile();
    // Falls back gracefully without crashing
    expect(profile).toBeNull();
  });

  it('migrates legacy profile to connectsign-profile seamlessly', () => {
    const legacyData = {
      id: 'legacy-user-123',
      preferredName: 'Nadia',
      createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      updatedAt: new Date('2026-01-02T00:00:00.000Z').toISOString(),
    };
    localStorage.setItem(LEGACY_PROFILE_STORAGE_KEY, JSON.stringify(legacyData));

    const migrated = service.getProfile();
    expect(migrated).not.toBeNull();
    expect(migrated?.id).toBe('legacy-user-123');
    expect(migrated?.preferredName).toBe('Nadia');

    // Verify saved to new key and cleared from legacy key
    expect(localStorage.getItem(PROFILE_STORAGE_KEY)).toContain('Nadia');
    expect(localStorage.getItem(LEGACY_PROFILE_STORAGE_KEY)).toBeNull();
  });

  it('clears profile correctly', () => {
    service.saveProfile('Samia');
    expect(service.getProfile()).not.toBeNull();

    service.clearProfile();
    expect(service.getProfile()).toBeNull();
    expect(localStorage.getItem(PROFILE_STORAGE_KEY)).toBeNull();
  });
});
