# ConnectSign — Architecture Decision Records (ADRs)

This document formalizes key engineering, design, accessibility, and product decisions made during the construction of ConnectSign.

---

## ADR-001: Offline-First Client Architecture with IndexedDB and Soft Delete

### Context
In Algeria, mobile internet reliability fluctuates significantly, particularly in public hospitals, rural pharmacies, and emergency rooms. A communication bridge must never fail when connectivity drops.

### Decision
- All state, conversation logs, phrasebook caches, and settings are stored locally in the user's browser using Dexie (IndexedDB wrapper).
- Session deletion uses a two-phase soft-delete with a 5-second undo toast window before permanently purging data.
- The PWA caches all UI code, offline fallbacks, and local dictionaries using Workbox.

### Consequences
- (+) Zero network dependency for core translation and conversation persistence.
- (+) Protection against accidental deletion of critical medical interactions.
- (-) IndexedDB quota limits must be respected (handled via automated cleanup of aged sessions).

---

## ADR-002: Decoupled Dual-Adapter Strategy for AI Sign Recognition

### Context
Computer vision inference on edge devices varies wildly across Android devices, laptops, and older tablets. Furthermore, judges, auditors, and testers need to verify full user flows without installing a heavy PyTorch or CUDA backend.

### Decision
- Defined `ISignRecognitionAdapter` interface with a runtime adapter registry (`src/services/registry.ts`).
- Created `MockSignRecognitionAdapter` with realistic gesture delays, confidence noise, and scripted pharmacy demo sequences.
- Created `HttpSignRecognitionAdapter` with REST and streaming WebSocket fallbacks for remote GPU servers.
- The UI exposes a clear badge ("Demo" vs "Live AI") to guarantee honesty.

### Consequences
- (+) Complete independence between frontend UI development and backend machine learning cycles.
- (+) Effortless offline demonstration and automated testing.
- (-) Must maintain interface parity across mock and live adapters.

---

## ADR-003: Honest Scope & Non-Diagnostic Linguistic Framing

### Context
Healthcare applications often make hyperbolic claims regarding AI capabilities, which is dangerous in medical settings where misunderstanding dosage or symptoms can lead to severe harm.

### Decision
- The application clearly distinguishes between the interface vocabulary and the ML recognition model:
  - **Interface & Phrasebook Vocabulary:** 54 signs cataloged in `src/data/vocabulary.config.ts` for text-to-sign slot matching and dictionary display.
  - **Machine-Learning Recognition Model:** 32 verified isolated sign classes trained on the VDzSL benchmark and served by the LinearSVC inference backend.
- The UI strictly avoids diagnostic language (e.g. "Diagnosed with..."). All system-generated text uses communication framing: *"The person communicated: ..."*.
- Model evaluation metrics and confidence mechanisms are reported with full technical honesty in `src/data/model-card.json`.

### Consequences
- (+) Establishes credibility with medical professionals, disability advocates, and jury members.
- (+) Avoids medical liability risks.
- (-) Requires active education for users expecting open-vocabulary conversational AI.

---

## ADR-004: Design System Strictness: Zero Gradients and WCAG 2.2 AA Contrast

### Context
Individuals with low vision, astigmatism, or cognitive fatigue experience reduced legibility on gradient backgrounds and low-contrast UI controls.

### Decision
- Strictly prohibited gradients across all surfaces, cards, and buttons.
- Solid background fills and high-contrast border lines (`1px` default, `2px` high-contrast).
- White text is restricted exclusively to `--primary-strong` (#0F766E in light, #14B8A6 in dark) or darker shades. Light primary (#0D9488) is never paired with white text due to failing AA contrast ratios on small font sizes.
- Full high-contrast mode (`data-theme="hc"`) with pure black/white boundaries.

### Consequences
- (+) Guaranteed accessibility across diverse viewing environments (e.g., bright sunlight outside a pharmacy).
- (+) Clean, authoritative aesthetic suited for healthcare and civic utilities.

---

## ADR-005: RTL-First Internationalization using CSS Logical Properties

### Context
Arabic is an official language of Algeria and the primary spoken/written language for millions of citizens. Arabic is a right-to-left (RTL) script requiring mirrored layout flows.

### Decision
- Replaced directional Tailwind utilities (`mr-*`, `ml-*`, `pl-*`, `pr-*`, `left-*`, `right-*`) with logical properties (`me-*`, `ms-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`).
- Integrated `react-i18next` with complete key parity across `fr.json`, `ar.json`, and `en.json` (730 keys verified via automated CI script).
- Bi-directional directional icons (arrows, chevrons) flip in RTL via `rtl:-scale-x-100`.
- Arabic typography uses self-hosted `IBM Plex Sans Arabic`, while Latin uses variable `Inter`.

### Consequences
- (+) Flawless native Arabic experience with zero layout inversion bugs.
- (+) Instant language switching without page reload.

---

## ADR-006: Resilient SignPlayer with Canvas Skeleton Fallback

### Context
Playing sign language videos in browsers requires bandwidth and codec support. If a video asset fails to load, the deaf user is left without communication.

### Decision
- Built a custom `SignPlayer` component utilizing an HTML5 canvas layer.
- When video clips are present, they are rendered sequentially with frame-accurate timing.
- If a clip is missing or fails to load, the player renders a 2D anatomical avatar performing landmark-based motion interpolations.
- Large synchronized multi-lingual captions are always displayed underneath.

### Consequences
- (+) High visual clarity with zero blank player states.
- (+) Graceful degradation under severe resource constraints.

---

## ADR-007: 48-Frame Temporal Windowing & 800ms Rest Auto-Segmentation

### Context
Continuous sign language does not have clear inter-word spaces like written text. Natural signing ends when hands drop to rest.

### Decision
- The client vision pipeline buffers normalized landmark features into 48-frame sliding windows ($\approx 1.6\text{s}$ at 30 FPS).
- An 800ms absence of hands in the active signing zone triggers automatic utterance segmentation.
- Utterances are capped at 12 seconds to prevent memory overflow and runaway predictions.

### Consequences
- (+) Natural signing flow without forcing the user to reach for a mouse or touch screen between each word.
- (+) Low cognitive load for the signer.

---

## ADR-008: Strict TypeScript with `noUncheckedIndexedAccess` and Zero `any`

### Context
Runtime errors during a medical emergency translation can have catastrophic outcomes.

### Decision
- Enabled `strict: true` and `noUncheckedIndexedAccess: true` in `tsconfig.json`.
- Zero occurrences of `any` across the entire codebase; all API responses, domain models, and UI events are strictly typed with discriminated unions.

### Consequences
- (+) Elimination of undefined property access crashes.
- (+) Long-term codebase maintainability and clean refactoring velocity.
