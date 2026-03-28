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

## Research references used

Implementation references used for this update:

- MDN Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- MDN OscillatorNode: https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode
- MDN Web MIDI API: https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API
- W3C Web Audio API specification: https://www.w3.org/TR/webaudio/
