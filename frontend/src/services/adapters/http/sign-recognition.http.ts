import { LandmarkFrame, RecognitionResult, SpokenLang } from '@/types/domain';
import { SignRecognitionService } from '@/types/services';

export const PRODUCTION_RENDER_AI_URL = 'https://connect-sign.onrender.com';

export class HttpSignRecognitionAdapter implements SignRecognitionService {
  readonly adapter = 'live' as const;
  private frames: any[] = [];
  private currentLang: SpokenLang = 'fr';
  private baseUrl: string;
  private currentController: AbortController | null = null;

  constructor(baseUrl: string = import.meta.env.VITE_API_BASE_URL || PRODUCTION_RENDER_AI_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  abort(): void {
    if (this.currentController) {
      try {
        this.currentController.abort();
      } catch {
        // ignore
      }
      this.currentController = null;
    }
  }

  async start(opts: { lang: SpokenLang }): Promise<void> {
    this.abort();
    this.currentLang = opts.lang;
    this.frames = [];
  }

  push(frame: LandmarkFrame | any): void {
    this.frames.push(frame);
  }

  async finalize(): Promise<RecognitionResult> {
    this.abort();

    const payload = {
      lang: this.currentLang,
      frames: this.frames,
    };

    const startTime = Date.now();
    let retries = 2;
    let delay = 400;

    while (retries >= 0) {
      try {
        const controller = new AbortController();
        this.currentController = controller;
        // Accommodate Render cold starts (free tier spin-up can take up to 25-30s)
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const res = await fetch(`${this.baseUrl}/v1/recognize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        this.currentController = null;

        if (!res.ok) {
          throw new Error(`HTTP_${res.status}`);
        }

        const data = await res.json();
        this.frames = [];
        return {
          ...data,
          latencyMs: Date.now() - startTime,
          adapter: 'live',
        };
      } catch (err: any) {
        this.currentController = null;
        if (retries === 0) {
          this.frames = [];
          if (err.name === 'AbortError') {
            throw { code: 'AI-002', message: 'Recognition timeout (server may be waking up)', retryable: true };
          }
          throw { code: 'AI-004', message: 'Backend unreachable', retryable: true };
        }
        retries--;
        await new Promise((r) => setTimeout(r, delay));
        delay = 1000;
      }
    }

    throw { code: 'AI-004', message: 'Backend unreachable', retryable: true };
  }

  reset(): void {
    this.abort();
    this.frames = [];
  }
}

export const httpSignRecognitionAdapter = new HttpSignRecognitionAdapter();
