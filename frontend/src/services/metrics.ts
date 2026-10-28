import { ModelMetrics } from '@/types/domain';
import { MetricsService } from '@/types/services';
import { VOCAB_SIZE } from '@/data/vocabulary.config';

/**
 * In-memory telemetry service tracking runtime ML inference performance and pipeline state.
 */
class AppMetricsService implements MetricsService {
  private metrics: ModelMetrics = {
    fps: 0,
    inferenceMs: null,
    vocabSize: VOCAB_SIZE,
    tracking: 'lost',
    adapter: 'demo',
    model: 'LSA-Sequence-TCN-Lite',
    version: '0.1.0-mvp',
  };

  private listeners: ((m: ModelMetrics) => void)[] = [];

  /** Returns an immutable snapshot copy of current model metrics. */
  getMetrics(): ModelMetrics {
    return { ...this.metrics };
  }

  /** Updates metric attributes and broadcasts changes to all active subscribers. */
  updateMetrics(partial: Partial<ModelMetrics>): void {
    this.metrics = { ...this.metrics, ...partial };
    this.notify();
  }

  /** Subscribes a listener callback to metrics state changes. Returns an unsubscribe function. */
  subscribe(callback: (metrics: ModelMetrics) => void): () => void {
    this.listeners.push(callback);
    callback({ ...this.metrics });
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener({ ...this.metrics });
    }
  }
}

export const metricsService = new AppMetricsService();
