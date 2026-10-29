import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpSignRecognitionAdapter } from '@/services/adapters/http/sign-recognition.http';

describe('HttpSignRecognitionAdapter', () => {
  let adapter: HttpSignRecognitionAdapter;

  beforeEach(() => {
    adapter = new HttpSignRecognitionAdapter('http://localhost:8000');
    vi.restoreAllMocks();
  });

  it('initializes with live adapter mode and empty frames', () => {
    expect(adapter.adapter).toBe('live');
  });

  it('accumulates pushed frames and resets properly', async () => {
    await adapter.start({ lang: 'fr' });
    adapter.push({ image: 'data:image/jpeg;base64,abc123dummy', t: 100 });
    adapter.push({ image: 'data:image/jpeg;base64,def456dummy', t: 200 });

    adapter.reset();
    // After reset, calling finalize with mock fetch should send empty frames
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        signs: [],
        sequence: [],
        overallConfidence: 0.0,
        level: 'low',
        frames: 0,
        adapter: 'live',
      }),
    });
    globalThis.fetch = mockFetch;

    const res = await adapter.finalize();
    expect(res.frames).toBe(0);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/v1/recognize',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ lang: 'fr', frames: [] }),
      })
    );
  });

  it('correctly maps successful model recognition responses', async () => {
    await adapter.start({ lang: 'fr' });
    adapter.push({ image: 'data:image/jpeg;base64,frame1' });

    const mockResponse = {
      signs: [
        {
          gloss: 'HELP',
          confidence: 0.88,
          level: 'high',
          atMs: 250,
        },
      ],
      sequence: ['HELP'],
      overallConfidence: 0.88,
      level: 'high',
      frames: 1,
      model: { name: 'ConnectSign-LSA-Landmark', version: '0.2.0' },
      adapter: 'live',
      isUncertain: false,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await adapter.finalize();
    expect(result.sequence).toEqual(['HELP']);
    expect(result.signs[0]?.gloss).toBe('HELP');
    expect(result.overallConfidence).toBe(0.88);
    expect(result.level).toBe('high');
    expect(result.adapter).toBe('live');
  });

  it('handles backend network failures with structured retryable error', async () => {
    await adapter.start({ lang: 'fr' });
    adapter.push({ image: 'data:image/jpeg;base64,frame1' });

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    await expect(adapter.finalize()).rejects.toMatchObject({
      code: 'AI-004',
      retryable: true,
    });
  });
});
