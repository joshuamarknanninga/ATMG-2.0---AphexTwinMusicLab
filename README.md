# ATMG 2.0 - AphexTwinMusicLab

ATMG 2.0 is now a **working, self-contained generative music backend** designed to be easy to run, easy to extend, and good enough to power a sequencer, MIDI tool, or browser client.

## What changed

The original repository only contained an empty server skeleton. This version replaces that placeholder with a production-friendly, dependency-light Node API focused on:

- deterministic, seed-based music generation,
- theory-aware chord, bass, melody, and drum tracks,
- Euclidean drum programming,
- voice-led chord inversion,
- clip analysis for symbolic note data,
- simple guest sessions and in-memory project persistence.

## Quick start

```bash
cd server
npm start
```

Server default: `http://localhost:4000`

## API

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
Returns supported moods/scales and the default generator profile.

### `POST /api/music/generate`
Generates a complete symbolic project.

```json
{
  "seed": "late-night-broken-beat",
  "key": "A",
  "scale": "minor",
  "mood": "dark",
  "bars": 8,
  "bpm": 128,
  "density": 0.68,
  "swing": 0.09
}
```

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

- **Simple first:** no external database or auth provider is required to start.
- **Deterministic:** identical seeds produce identical arrangements.
- **Musical quality:** the generator combines scale quantization, progression presets, voice-leading, motif mutation, and Euclidean spacing to produce tighter results than naïve random note emission.
- **Extensible:** you can swap the in-memory stores for Mongo/Postgres later without changing the music generation core.
