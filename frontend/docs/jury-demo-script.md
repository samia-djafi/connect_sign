# ConnectSign — 3-Minute Live Jury Demonstration Script

**Title:** ConnectSign: Real-Time Bidirectional Healthcare Communication for Algerian Sign Language<br />
**Target Duration:** Exactly 3 minutes (180 seconds)  
**Presenter Setup:** Laptop or Tablet with webcam, modern browser (Chrome / Edge / Firefox), audio unmuted.

---

## Timeline & Execution

```
[00:00 - 00:30] Problem & Onboarding  ──▶  Language & RTL Switching
[00:30 - 01:15] Sign → Language Flow  ──▶  Camera Tracking, Auto-Segment & Speech
[01:15 - 02:00] Language → Sign Flow  ──▶  Speech/Text Input & LSA SignPlayer
[02:00 - 02:35] Emergency Sheet       ──▶  1-Click Rapid Medical Relief
[02:35 - 03:00] Offline & Diagnostics ──▶  IndexedDB, PWA & Honest Model Card
```

---

### Phase 1: Problem & First Impression (0:00 – 0:30)

- **Spoken Pitch:**  
  *"In Algeria, over 200,000 Deaf citizens rely on Algerian Sign Language (LSA). When a Deaf patient arrives at a pharmacy or emergency room without an interpreter, simple misunderstandings over medications can be dangerous. This is ConnectSign — an installable PWA designed for two-way conversations without requiring internet access."*
- **Action on Screen:**
  1. Open the application at the dashboard.
  2. Click the Language dropdown in the header and select **العربية (Arabic)**.
  3. Point out the instant switch to a native RTL layout (IBM Plex Sans Arabic typography, mirrored icons, and clean alignment).
  4. Switch back to French or English depending on jury preference.
  5. Click **"Nouvelle conversation" (New Conversation)** $\rightarrow$ select **Pharmacie / Santé**.

---

### Phase 2: Sign-to-Language: Deaf Patient to Pharmacist (0:30 – 1:15)

- **Spoken Pitch:**  
  *"First, let's watch the Deaf patient communicate their symptoms. The camera detects upper-body pose and 21 hand landmarks in real time. Notice the pipeline is completely local and private."*
- **Action on Screen:**
  1. Click **"Démarrer la caméra"** (or activate **"Demo Coach"** scenario: *Pharmacie - Mal de tête*).
  2. The camera viewport lights up with green tracking bounds.
  3. Signer makes signs: `BONJOUR` $\rightarrow$ `MAL_TETE` $\rightarrow$ `DOULEUR_FORTE` $\rightarrow$ `MEDICAMENT`.
  4. Point out the **Confidence Indicator** showing 94% (High) and the **Detected Sign Chips** appearing chronologically.
  5. Hands drop below chest $\rightarrow$ 800ms rest triggers automatic segmentation without touching the screen.
  6. The proposed sentence appears in the confirmation card: *"Bonjour, j'ai un violent mal de tête, avez-vous un médicament ?"*
  7. Click **"Confirmer & Envoyer"**.
  8. Audio synthesis immediately speaks the phrase aloud for the pharmacist to hear.

---

### Phase 3: Language-to-Sign: Pharmacist to Deaf Patient (1:15 – 2:00)

- **Spoken Pitch:**  
  *"Now, the pharmacist replies in spoken or written French or Arabic. Watch how ConnectSign parses medical dosage and translates it into high-definition sign clips."*
- **Action on Screen:**
  1. In the workspace reply area, type:  
     `"Prenez deux comprimés par jour après le repas pendant 5 jours"`  
     *(Or click the microphone icon and speak the sentence aloud).*
  2. Click **"Traduire en LSA"**.
  3. The **SignPlayer** animates:
     - First clip: `PRENDRE_COMPRIME`
     - Second clip: `DEUX_FOIS`
     - Third clip: `APRES_REPAS`
  4. Point out the synchronized high-contrast subtitle ticker in French and Arabic below the video canvas.
  5. Point out the **Sign Sequence Strip** showing each sign token with its exact duration.

---

### Phase 4: Emergency Medical Sheet (2:00 – 2:35)

- **Spoken Pitch:**  
  *"In an acute crisis — like severe asthma, bleeding, or anaphylaxis — the patient has no time to compose sentences. We built the Emergency Medical Sheet."*
- **Action on Screen:**
  1. Click the red **"Urgence" (Emergency)** button in the top bar.
  2. A high-contrast medical sheet opens instantly.
  3. Show the instant emergency cards: *"Difficulté à respirer"*, *"Douleur thoracique"*, *"Allergie grave"*.
  4. Click an emergency card: it plays an emergency alarm tone, broadcasts full-screen high-visibility medical cards with Arabic/French instructions, and copies emergency contact numbers.
  5. Dismiss the sheet.

---

### Phase 5: Technical Depth, Offline Resilience & Honesty (2:35 – 3:00)

- **Spoken Pitch:**  
  *"Finally, let's look at engineering rigor and community honesty."*
- **Action on Screen:**
  1. Navigate to **Diagnostics** in the navigation menu.
  2. Show live telemetry:
     - Active Adapter: `MockSignRecognitionAdapter` (labeled honestly as Demo)
     - Vision pipeline FPS: 30 FPS stable
     - IndexedDB persistence: 4 tables, zero server leaks
  3. Show the **Vocabulary Scope**: clearly distinguishing between the 54-sign interface phrasebook and the 32-sign ML recognition model, avoiding misleading claims of continuous universal translation.
  4. Open DevTools $\rightarrow$ Network $\rightarrow$ toggle **Offline**.
  5. Refresh the page: the application loads instantaneously from the Service Worker cache with full IndexedDB history intact.
- **Concluding Sentence:**  
  *"ConnectSign delivers dignified, immediate, and honest communication access for Algeria's Deaf community. Thank you."*
