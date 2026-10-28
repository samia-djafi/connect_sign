/**
 * Dynamically announces messages to assistive screen readers via an ARIA live region.
 *
 * @param message - Text announcement string for the screen reader.
 * @param priority - 'polite' (waits for idle) or 'assertive' (interrupts immediately).
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  if (typeof document === 'undefined') return;

  const elementId = `a11y-announcer-${priority}`;
  let liveRegion = document.getElementById(elementId);

  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = elementId;
    liveRegion.setAttribute('role', priority === 'assertive' ? 'alert' : 'status');
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    liveRegion.style.position = 'absolute';
    liveRegion.style.width = '1px';
    liveRegion.style.height = '1px';
    liveRegion.style.padding = '0';
    liveRegion.style.margin = '-1px';
    liveRegion.style.overflow = 'hidden';
    liveRegion.style.clip = 'rect(0, 0, 0, 0)';
    liveRegion.style.whiteSpace = 'nowrap';
    liveRegion.style.border = '0';
    document.body.appendChild(liveRegion);
  }

  // Clear previous message then set new after brief tick to ensure re-announcement
  liveRegion.textContent = '';
  setTimeout(() => {
    if (liveRegion) {
      liveRegion.textContent = message;
    }
  }, 50);
}

/**
 * Dispatches a lightweight tactile vibration feedback on supported mobile devices.
 *
 * @param durationMs - Vibration pulse duration in milliseconds (default 40ms).
 */
export function triggerHaptic(durationMs: number = 40) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(durationMs);
    } catch {
      // Ignore vibration errors if unsupported
    }
  }
}
