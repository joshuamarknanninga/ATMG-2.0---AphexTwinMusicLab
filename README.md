# ATMG 2.0 - AphexTwinMusicLab

ATMG 2.0 is a **working, self-contained generative music backend** designed to be easy to run, easy to extend, and strong enough to power an original experimental electronic sequencer, MIDI tool, or browser client.

## What changed

The repository now ships with a production-friendly, dependency-light Node API focused on:

- deterministic, seed-based music generation,
- theory-aware chord, bass, melody, texture, and drum tracks,
- section-aware arrangement with seed / lift / fracture / release forms,
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
HTML landing page for browsers with quick links to health and presets endpoints.

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
  "bars": 16,
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
