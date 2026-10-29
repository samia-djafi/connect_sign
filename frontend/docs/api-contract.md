# ConnectSign — API Contract & Service Specification

## 1. Overview

ConnectSign operates on a decoupled adapter architecture. Recognition requests are routed through either a local mock adapter (`MockSignRecognitionAdapter` for offline testing and demos) or a remote/local HTTP inference backend (`HttpSignRecognitionAdapter`) adhering to the contracts detailed below.

- **Base URL (Production Render):** `https://connect-sign.onrender.com` (configured via `VITE_API_BASE_URL`)
- **Base URL (Local Development):** `http://localhost:8000`
- **Content-Type:** `application/json`
- **Inference Latency Target:** $< 500$ ms on CPU for 16-frame window.

---

## 2. Service Separation & Client vs Server Roles

To ensure high availability in frontline clinical environments with intermittent connectivity, responsibilities are cleanly divided:

| Service | Execution Environment | Role |
|---|---|---|
| **Isolated Sign Classification** | FastAPI Backend (`POST /v1/recognize`) | 32-class LinearSVC classification from 16-frame MediaPipe landmark sequences or base64 image bursts |
| **System Readiness & Telemetry** | FastAPI Backend (`GET /health`) | Model checkpoint status, loaded class count, device target |
| **Phrase Catalog & Matching** | FastAPI Backend (`GET /v1/phrases`, `POST /v1/match`) & Client | 21 backend seed templates / 87 frontend healthcare phrases |
| **Text-to-Sign & Slot Parsing** | Client-Side (`src/services/text-to-sign.ts`) | Regex medical dosage extraction and fuzzy Damerau-Levenshtein gloss mapping |
| **Sentence Synthesis (NLG)** | Client-Side (`src/services/language-generation.ts`) | Rule-based grammar synthesis in French, Arabic, and English |
| **Speech Audio (TTS & STT)** | Client-Side (`src/services/speech.ts`) | Web Speech API synthesis and recognition |
| **Local Persistence** | Client-Side (`src/services/db.ts`) | Dexie IndexedDB storing sessions, messages, and favorites |

---

## 3. REST Endpoints (FastAPI Backend)

### 3.1 Health & Readiness Probe

- **Endpoint:** `GET /health` (also aliased at `GET /`)
- **Purpose:** Verifies operational health, model loading state, and active vocabulary size.

#### Response (200 OK — Ready)
```json
{
  "status": "ok",
  "service": "ConnectSign AI Recognition API",
  "version": "0.2.0",
  "model_loaded": true,
  "model_name": "ConnectSign-LSA-Landmark-SVM",
  "active_vocabulary_classes": 32,
  "device": "cpu",
  "timestamp": 1729851234.56
}
```

#### Response (200 OK — Degraded / Weights Missing)
```json
{
  "status": "degraded",
  "service": "ConnectSign AI Recognition API",
  "version": "0.2.0",
  "model_loaded": false,
  "model_name": null,
  "active_vocabulary_classes": 0,
  "device": "cpu",
  "timestamp": 1729851234.56
}
```

---

### 3.2 Recognize Sign Sequence

- **Endpoint:** `POST /v1/recognize`
- **Purpose:** Ingests video frames (base64 image strings) or serialized landmark dictionaries, extracts 3,453 spatio-temporal features, evaluates LinearSVC decision scores, applies uncertainty gating, and returns the predicted sign.

#### Request Schema (`RecognitionRequest`)
```json
{
  "lang": "fr",
  "frames": [
    {
      "t": 0,
      "hands": [[{"x": 0.5, "y": 0.5, "z": 0.0}]],
      "pose": [{"x": 0.5, "y": 0.3, "z": 0.0}]
    }
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `frames` | Array | Yes | Array of base64 image strings or `LandmarkFrame` dictionaries (1 to 120 frames). Typical sequence: 16 frames. |
| `lang` | String | No | Target spoken language context (`fr`, `ar`, `en`). Defaults to `fr`. |

#### Response (200 OK — Confident Recognition)
```json
{
  "signs": [
    {
      "gloss": "HELP",
      "confidence": 0.88,
      "level": "high",
      "atMs": 250
    }
  ],
  "sequence": ["HELP"],
  "overallConfidence": 0.88,
  "level": "high",
  "frames": 16,
  "latencyMs": 250,
  "model": {
    "name": "ConnectSign-LSA-Landmark",
    "version": "0.2.0"
  },
  "adapter": "live",
  "isUncertain": false,
  "rawPredictedLabel": "يساعد",
  "matchedPhrase": {
    "id": "ph_emergency_help",
    "category": "emergency",
    "text": {
      "fr": "Aidez-moi c'est une urgence !",
      "ar": "ساعدوني إنها حالة طارئة!",
      "en": "Help me it's an emergency!"
    },
    "gloss": ["HELP", "EMERGENCY"]
  },
  "supportStatus": "FULL_RECOGNITION",
  "topCandidates": [
    { "label": "يساعد", "score": 0.88 },
    { "label": "خطر", "score": 0.05 },
    { "label": "ماء", "score": 0.02 }
  ],
  "rejectionMessage": null
}
```

#### Response (200 OK — Uncertain / Rejection)
When the prediction score falls below `UNCERTAINTY_THRESHOLD` (0.12):
```json
{
  "signs": [],
  "sequence": [],
  "overallConfidence": 0.0,
  "level": "low",
  "frames": 16,
  "latencyMs": 180,
  "model": {
    "name": "ConnectSign-LSA-Landmark",
    "version": "0.2.0"
  },
  "adapter": "live",
  "isUncertain": true,
  "rawPredictedLabel": "ماء",
  "matchedPhrase": null,
  "supportStatus": "NO_MATCH",
  "topCandidates": [
    { "label": "ماء", "score": 0.085 },
    { "label": "خطر", "score": 0.071 },
    { "label": "يد", "score": 0.062 }
  ],
  "rejectionMessage": "Sign not recognized. Please try again."
}
```

#### HTTP Error Status Codes
- `422 Unprocessable Entity`: Request body is missing required `frames` or frames count exceeds 120.
- `503 Service Unavailable`: Backend model artifacts are not initialized.

---

### 3.3 List Seed Phrases

- **Endpoint:** `GET /v1/phrases`
- **Purpose:** Returns the 21 healthcare seed phrases configured in backend phrase service.

#### Response (200 OK)
```json
{
  "total_phrases": 21,
  "phrases": [
    {
      "id": "ph_headache",
      "category": "symptoms",
      "text": {
        "fr": "J'ai mal à la tête.",
        "ar": "عندي صداع في الرأس.",
        "en": "I have a headache."
      },
      "gloss": ["HEADACHE"],
      "contexts": ["healthcare"]
    }
  ]
}
```

---

## 4. Frontend Adapter Interface (`ISignRecognitionAdapter`)

Defined in `frontend/src/types/services.ts`:

```typescript
export interface SignRecognitionService {
  readonly adapter: 'live' | 'demo';
  start(opts: { lang: SpokenLang }): Promise<void>;
  push(frame: LandmarkFrame | any): void;
  finalize(): Promise<RecognitionResult>;
  reset(): void;
  abort?(): void;
}
```

### Adapter Implementations:
- **`HttpSignRecognitionAdapter` (`adapter: 'live'`):** Accumulates frames during gesture capture and executes HTTP `POST /v1/recognize`. Configured with a 25-second timeout and retry logic for Render free tier wakeups.
- **`MockSignRecognitionAdapter` (`adapter: 'demo'`):** Standalone offline simulation matching realistic gesture timings for automated UI testing and connectivity-free presentations.

---

## 5. Client Error Handling Matrix

| Error Code | Origin | Description | User-Facing Action |
|---|---|---|---|
| `AI-002` | `HttpSignRecognitionAdapter` | Request timed out (25 seconds) | Displays server wakeup guidance |
| `AI-004` | `HttpSignRecognitionAdapter` | Backend unreachable / network down | Displays offline notice; user can retry or switch to demo mode |
| `CAM-001` | `useCamera` | Camera access denied by user | Displays permission recovery modal |
| `CAM-002` | `useCamera` | Camera device in use or missing | Recommends checking device settings |
