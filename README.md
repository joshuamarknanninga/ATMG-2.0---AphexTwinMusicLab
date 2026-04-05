# ATMG 2.0 - AphexTwinMusicLab

ATMG 2.0 is a **working, self-contained generative music backend** designed to be easy to run, easy to extend, and strong enough to power an original experimental electronic sequencer, MIDI tool, or browser client.

## What changed

The repository now ships with a production-friendly, dependency-light Node API focused on:

- deterministic, seed-based music generation,
- theory-aware chord, bass, melody, texture, and drum tracks,
- section-aware arrangement with seed / lift / fracture / release forms,
- automatic duration normalization to 4–12 minutes,
- controllable syncopation, mutation, instability, brightness, and texture,
- Euclidean and rotated drum programming,
- clip analysis for symbolic note data,
- simple guest sessions and in-memory project persistence.

## 25-year maturity roadmap (deep-tech upgrade plan)

If you want this to feel as mature as long-lived pro tools, the next upgrades should focus on reliability, DSP quality, and beginner-friendly workflow layers.

### Platform and DSP backbone

- Move more real-time DSP into **AudioWorklet** processors (stable low-latency graph execution on the audio rendering thread).
- Add **WebAssembly (WASM + SIMD)** DSP modules for filters/saturation/time FX where JS becomes CPU-heavy.
- Add optional **WebGPU** acceleration for heavy visuals + ML inference workloads that should not block UI/audio scheduling.

### Party/DJ usability layer

- Add deck abstractions (Deck A / Deck B), tempo/key lock, quantized cue points, and one-click transition recipes.
- Add persistent scene presets (“House Warmup”, “Peak Club”, “Afterhours”) that auto-map generator + FX + drum lock settings.
- Add safe-guard controls for non-musicians: “More Energy”, “More Space”, “More Groove”, each as bounded macro knobs.

### Analysis and AI assist

- Add browser/server audio feature extraction pipelines (BPM, key, spectral centroid, energy) as first-class APIs.
- Add optional model inference via **ONNX Runtime Web** (WebGPU provider when available) for intelligent suggestions.
- Add structured recommendation layers (e.g., “best next transition”, “compatible key move”, “drop timing”).

### Collaboration and scale

- Add real-time shared sessions using CRDTs for collaborative live set editing.
- Add robust storage backends (SQLite/Postgres) behind the same domain interfaces currently using in-memory models.
- Add job queues for heavy tasks (stems rendering, source separation, batch analysis).

### Primary references for the roadmap

- AudioWorklet: https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet
- Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- WebAssembly: https://developer.mozilla.org/en-US/docs/WebAssembly
- WebGPU: https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API
- ONNX Runtime Web: https://onnxruntime.ai/docs/tutorials/web/

## Quick start

```bash
# from repo root
npm run dev

# or run directly in server/
cd server
npm start
```

Server default: `http://localhost:4000`

## API

### `GET /`
Mouse-friendly HTML UI for setting generator controls, generating projects, showing measures + total duration, and playing generated JSON as browser audio preview.

### `GET /health`
Health check.

### `POST /api/auth/guest`
Creates a lightweight guest session.

```json
{
  "name": "Guest Producer"
}
```

### `GET /api/music/presets`
Returns supported moods, scales, generator presets, and the default profile.

### `POST /api/music/generate`
Generates a complete symbolic project.

```json
{
  "seed": "glass-machine-memory",
  "preset": "fractured",
  "key": "A",
  "scale": "minor",
  "bars": 132,
  "bpm": 134,
  "density": 0.72,
  "swing": 0.05,
  "syncopation": 0.81,
  "mutation": 0.68,
  "instability": 0.53,
  "brightness": 0.44,
  "texture": 0.63
}
```

### Presets

- `fractured`: dense, syncopated, high-mutation experimental rhythms
- `lucid`: brighter, melodic, more stable but still intricate
- `corrosive`: darker, harsher, more unstable movement
- `hypnotic`: slower-evolving, airy, texture-forward motion

### `POST /api/projects`
Requires a Bearer token from `/api/auth/guest`. Saves a generated project.

### `POST /api/uploads/analyze`
Analyzes symbolic note clips.

```json
{
  "notes": [
    { "midi": 60, "beat": 0, "duration": 1, "velocity": 90 },
    { "midi": 67, "beat": 1.5, "duration": 0.5, "velocity": 84 }
  ]
}
```

### `POST /api/exports/midi`
Exports a generated project as a Standard MIDI file (`.mid`).

### `POST /api/exports/stems`
Exports a symbolic stem bundle (`.json`) with per-lane note data for DAW/manual routing workflows.

## Design notes

- **Original by design:** the generator targets broad experimental electronic / IDM traits rather than imitating any specific artist.
- **Simple first:** no external database or auth provider is required to start.
- **Deterministic:** identical seeds produce identical arrangements.
- **Musical quality:** the engine combines section-aware form, voice-leading, motif memory, controlled mutation, syncopation, and Euclidean spacing to produce more coherent and varied results than naïve random note emission.
- **Extensible:** you can later swap in real persistence, synth/rendering layers, and sample-management features without rewriting the composition core.

## Browser pedalboard + controller layer

The root UI now includes a pedalboard-style signal manipulator section with real-time browser audio processing:

- **Glitch** (random gate interruptions),
- **Stutter** (rate/depth gate modulation),
- **Reverse-style envelope** (tonal envelope inversion blend),
- **Filter** (cutoff + resonance),
- **Distortion** (WaveShaper drive),
- **Delay** (time/feedback/mix),
- **Drum machine pads** (kick/snare/hat one-shots),
- **MIDI controller input** (Web MIDI note trigger),
- **Synth profiles** (`mini_inspired`, `micro_inspired`, `poly_clean`) inspired by compact hardware synth workflows.

All manipulators process the original generated preview signal in-browser through a single FX chain.

### Pedal controls and synchronization

- Every numeric Synth + Multi FX value now has explicit **+ / − step buttons** for mouse-first control (instead of relying on native input arrows only).
- Drum machine includes a **16-step pattern lock** for kick/snare/hat that can be toggled and edited live.
- **Sync Play** starts music generation playback, synth engine, and locked drum pattern from the same transport start, keeping them aligned by BPM/beat grid.
- Added **Groove Template** control (`straight`, `dilla`, `broken_beat`, `garage_swing`) that applies lane-aware timing/velocity shaping for less rigid playback feel.
- Added **Engine Mode** control:
  - `hybrid` (default): oscillator synthesis + sample layer stack,
  - `synth_only`: force oscillator engine only,
  - `sampler_only`: force sample voices only (falls back to synth if missing assets).
- Added **Master Bus Preset** macros (`clean`, `warm`, `club`, `cinematic`) for instant top-level tone shaping over the existing FX chain.

### Hybrid synth + sampler engine (v2 creator feature)

- The browser engine now supports **hybrid voice dispatch**:
  - Drums (`kick`, `snare`, `hat`, `openHat`, `perc`) can trigger sample layers with synth fallback.
  - Tonal lanes (`chords`, `texture`) can trigger pitched sample layers with oscillator support retained.
- Added **velocity layers** (`low`, `mid`, `high`) and **round-robin** sample selection to reduce repetitive machine-gun playback.
- The sample loader is non-blocking and resilient:
  - if assets are missing/unavailable, playback automatically continues on oscillator fallback.
  - warning is surfaced in UI status once, without interrupting transport.

### Sample asset conventions

Place sample files under:

- `server/assets/samples/drums/`
- `server/assets/samples/tonal/`

Current expected naming (extensible):

- Drums:
  - `kick_low_1.wav`, `kick_mid_1.wav`, `kick_high_1.wav`
  - `snare_low_1.wav`, `snare_mid_1.wav`, `snare_high_1.wav`
  - `hat_low_1.wav`, `hat_mid_1.wav`, `hat_high_1.wav`
  - `open_hat_low_1.wav`, `open_hat_mid_1.wav`, `open_hat_high_1.wav`
  - `perc_low_1.wav`, `perc_mid_1.wav`, `perc_high_1.wav`
- Tonal:
  - `chords_low_1.wav`, `chords_mid_1.wav`, `chords_high_1.wav`
  - `texture_low_1.wav`, `texture_mid_1.wav`, `texture_high_1.wav`

Server asset route:

- `GET /assets/samples/<path>` serves `.wav` / `.mp3` / `.ogg` sample files from `server/assets/samples`.

### Richness and performance optimization

- Added a **Richness** control to thicken the synth voice behavior and harmonic weight.
- Added **CPU Saver** mode to reduce scheduler/update load on lower-power phones/laptops.
- Added a **Tape Delay** toggle that rolls off high end and adds subtle delay-time wobble for a lo-fi tape echo flavor.
- Replaced per-note `setTimeout` blasting with a **lookahead scheduler** (Web Audio clock aligned) to reduce UI thread stalls/freezes during long songs.
- Added dynamic transport cleanup to stop timers/nodes quickly and avoid runaway resource use.
- Added a one-click **Download Mix (MP3)** action that captures master output PCM via **AudioWorklet**, then encodes a true MP3 (via `lamejs`) for better compatibility with iTunes/media players.

### Dual-bank mix analysis and auto beat matching

- Added two blank upload banks (**Bank A** and **Bank B**) for MP3/audio files.
- Each bank can run independent in-browser analysis (duration, estimated BPM, key, energy, frequency centroid, transient position).
- Added automatic mix-matching plan generation between banks with individual toggles for:
  - Tempo matching,
  - Beat alignment,
  - Phrase matching,
  - Key matching,
  - EQ/frequency balance,
  - Energy leveling.

### Simpler default generation profile

- Default generation now starts with a shorter arrangement (**24 bars**) and lower baseline density for less crowded output.
- Duration policy now clamps generated projects to approximately **1–4 minutes** (instead of long-form defaults) to keep preview/render fast and easier to mix.
- Melody/texture generation is intentionally thinned for cleaner, less dense arrangements.

### Drum and live-control improvements

- Locked drum-pattern playback now avoids layering with generated drum tracks during sync playback, improving beat alignment with transport.
- Drum synthesis was updated for richer tone (layered kick body/punch and fuller snare/noise shaping).
- FX and synth controls now re-apply live during playback so changes are heard on the fly without restarting transport.
- Added 4 classic breakbeat-style drum presets for pattern lock workflow:
  - **Amen Break**
  - **Funky Drummer**
  - **When the Levee Breaks**
  - **Apache Break**
- MP3 export now serves `lamejs` locally when available and falls back to WAV download if MP3 encoding is unavailable.

### Drum preset research references

- Amen break (widely sampled): https://en.wikipedia.org/wiki/Amen_break
- Funky Drummer (widely sampled): https://en.wikipedia.org/wiki/Funky_Drummer
- When the Levee Breaks (widely sampled Bonham beat): https://en.wikipedia.org/wiki/When_the_Levee_Breaks
- Apache (Incredible Bongo Band break): https://en.wikipedia.org/wiki/Apache_(instrumental)

### Technologies to move beyond “chiptune” (research notes)

- **Neural synthesis / performance modeling**: DDSP and MIDI-DDSP style pipelines for richer timbre and expressivity from note control.
  - https://magenta.tensorflow.org/ddsp
  - https://arxiv.org/abs/2112.09312
- **Expressive instrument modeling / high-end virtual instruments**: physically modeled and deeply sampled engines (Kontakt ecosystem, modeled instruments) for articulation depth beyond plain oscillators.
  - https://www.native-instruments.com/en/products/komplete/samplers/kontakt-8/
  - https://www.expressivee.com/2-soliste
- **Humanization tooling**: timing/velocity/performance perturbation to reduce robotic quantization artifacts.
  - https://www.ableton.com/en/manual/editing-midi-notes-and-velocities/#midi-note-editor
- **Browser-native performance DSP**: AudioWorklet + WebAssembly DSP pipelines for lower-latency, richer synthesis and custom processors.
  - https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet

### Randomizer visualizer (Synesthesia-style feasibility)

- Replaced the always-visible JSON HUD in the output panel with a **Randomizer Visualizer** canvas (Prism / Orbit / Pulse modes) driven by live audio FFT energy data.
- Added **Randomize Visuals** to mutate hue/speed/bloom parameters in real time.
- Kept generated JSON available under a debug `<details>` panel so diagnostics remain accessible.

Research references supporting feasibility:
- Web Audio frequency-domain analysis with `AnalyserNode`: https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode
- Synesthesia-style live music visualization concept: https://synesthesia.live/

## Research references used

Implementation references used for this update:

- MDN Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- MDN OscillatorNode: https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode
- MDN Web MIDI API: https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API
- W3C Web Audio API specification: https://www.w3.org/TR/webaudio/
