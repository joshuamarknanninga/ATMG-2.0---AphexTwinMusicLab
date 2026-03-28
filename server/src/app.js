import { createServer } from 'node:http';

import { env } from './config/env.js';
import { requireSession } from './middleware/auth.js';
import { createGuestSession } from './routes/auth.routes.js';
import { generateProject } from './services/generator.js';
import { getMusicPresets, validateGeneratorRequest } from './routes/music.routes.js';
import { createProject, getProject, listProjects } from './routes/project.routes.js';
import { analyzeNotes } from './routes/upload.routes.js';
import { HttpError } from './utils/errors.js';
import { fail, ok, readJsonBody } from './utils/http.js';

const resolveOrigin = (req) => (env.CORS_ORIGIN === '*' ? '*' : req.headers.origin ?? env.CORS_ORIGIN);

const commonHeaders = (origin) => ({
  'access-control-allow-origin': origin,
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'x-content-type-options': 'nosniff',
});

const sendHtml = (res, status, body, origin) => {
  res.writeHead(status, {
    ...commonHeaders(origin),
    'content-type': 'text/html; charset=utf-8',
  });
  res.end(body);
};

const sendEmpty = (res, status, origin) => {
  res.writeHead(status, commonHeaders(origin));
  res.end();
};

const renderLandingPage = () => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ATMG 2.0 Music Engine</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, system-ui, -apple-system, Segoe UI, sans-serif;
        background: radial-gradient(circle at top, #1b2c6a 0%, #0a0f1d 48%);
        color: #ecf1ff;
      }
      main { max-width: 1200px; margin: 0 auto; padding: 28px 16px 40px; }
      .badge {
        display: inline-flex; align-items: center; gap: 8px;
        border: 1px solid #4563ca; border-radius: 999px;
        padding: 6px 12px; font-size: 12px; letter-spacing: .05em;
        text-transform: uppercase; color: #aec0ff; background: #101a3e;
      }
      h1 { margin: 14px 0 8px; font-size: clamp(28px, 5vw, 44px); }
      .subtitle { margin: 0 0 18px; color: #c9d4ff; max-width: 980px; line-height: 1.45; }
      .layout { display: grid; gap: 16px; grid-template-columns: 420px minmax(0, 1fr); }
      @media (max-width: 1040px) { .layout { grid-template-columns: 1fr; } }
      .panel {
        border: 1px solid #2f438d;
        border-radius: 14px;
        background: rgba(16, 24, 54, 0.88);
        backdrop-filter: blur(4px);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
      }
      .panel h2 { margin: 0; font-size: 18px; }
      .panel-head { padding: 14px 14px 0; }
      .panel-body { padding: 14px; }
      .grid { display: grid; gap: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .full { grid-column: 1 / -1; }
      label { display: grid; gap: 6px; font-size: 13px; color: #d4deff; }
      input, select, button, textarea {
        width: 100%; border-radius: 10px; border: 1px solid #3b4f9f;
        background: #0d1638; color: #edf2ff; padding: 10px 11px; font: inherit;
      }
      input:focus, select:focus, button:focus, textarea:focus { outline: 2px solid #7691ff; outline-offset: 1px; }
      button { cursor: pointer; font-weight: 600; }
      .actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .primary { background: linear-gradient(180deg, #4c6ff5, #3f58ba); border-color: #5572eb; }
      .secondary { background: #1a2756; }
      .status { min-height: 20px; font-size: 13px; color: #b9c8ff; }
      .cards { display: grid; gap: 10px; grid-template-columns: repeat(5, minmax(0, 1fr)); }
      @media (max-width: 900px) { .cards { grid-template-columns: 1fr 1fr; } }
      @media (max-width: 640px) { .cards { grid-template-columns: 1fr; } }
      .card { border: 1px solid #314387; border-radius: 12px; background: #121c3f; padding: 10px; }
      .card .k { font-size: 12px; color: #9cb0ff; }
      .card .v { margin-top: 4px; font-weight: 700; font-size: 16px; }
      .endpoint-links { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 6px; }
      .endpoint-links a {
        color: #dce6ff; text-decoration: none; border: 1px solid #3850a3;
        border-radius: 9px; padding: 7px 10px; background: #111a3a;
      }
      textarea { min-height: 300px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
      .muted { color: #acbbef; font-size: 12px; }
      .section-title { margin-top: 10px; margin-bottom: 8px; color: #9cb0ff; font-size: 12px; text-transform: uppercase; letter-spacing: .07em; }
      .pads { display: grid; gap: 8px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .pad { border-color: #4f67bf; background: #172557; }
      .fx-note { margin-top: 8px; color: #a8b9f4; font-size: 12px; }
      .midi-state { font-size: 12px; color: #9ec2ff; }
    </style>
  </head>
  <body>
    <main>
      <span class="badge">ATMG 2.0</span>
      <h1>Mouse-friendly music generation + FX pedalboard UI</h1>
      <p class="subtitle">Generate deterministic songs, preview them in-browser, and manipulate the original signal with a pedalboard-style multi-effects chain (glitch, stutter, reverse-style envelope, filter, distortion, delay), plus drum pads, Web MIDI input, and synth profiles inspired by mini/micro-style hardware workflows.</p>
      <div class="layout">
        <section class="panel" aria-label="Generation Controls">
          <div class="panel-head"><h2>Generation + Performance Controls</h2></div>
          <div class="panel-body">
            <form id="generatorForm" class="grid">
              <label class="full">Seed
                <input id="seed" name="seed" value="mouse-friendly-demo" />
              </label>
              <label>Preset
                <select id="preset" name="preset"></select>
              </label>
              <label>Mood
                <select id="mood" name="mood"></select>
              </label>
              <label>Scale
                <select id="scale" name="scale"></select>
              </label>
              <label>Key
                <input id="key" name="key" value="A" maxlength="2" />
              </label>
              <label>BPM
                <input id="bpm" name="bpm" type="number" min="70" max="180" step="1" value="132" />
              </label>
              <label>Bars
                <input id="bars" name="bars" type="number" min="2" max="512" step="1" value="132" />
              </label>
              <label>Density
                <input id="density" name="density" type="number" min="0.2" max="0.95" step="0.01" value="0.66" />
              </label>
              <label>Swing
                <input id="swing" name="swing" type="number" min="0" max="0.2" step="0.01" value="0.06" />
              </label>
              <label>Syncopation
                <input id="syncopation" name="syncopation" type="number" min="0" max="1" step="0.01" value="0.68" />
              </label>
              <label>Mutation
                <input id="mutation" name="mutation" type="number" min="0" max="1" step="0.01" value="0.62" />
              </label>
              <label>Instability
                <input id="instability" name="instability" type="number" min="0" max="1" step="0.01" value="0.44" />
              </label>
              <label>Brightness
                <input id="brightness" name="brightness" type="number" min="0" max="1" step="0.01" value="0.48" />
              </label>
              <label>Texture
                <input id="texture" name="texture" type="number" min="0" max="1" step="0.01" value="0.58" />
              </label>

              <div class="full section-title">Synth + Multi FX Pedalboard</div>
              <label>Synth Profile
                <select id="synthProfile">
                  <option value="mini_inspired">Mini-inspired</option>
                  <option value="micro_inspired">Micro-inspired</option>
                  <option value="poly_clean">Poly Clean</option>
                </select>
              </label>
              <label>Filter Cutoff (Hz)
                <input id="fxFilterCutoff" type="number" min="80" max="12000" step="10" value="1800" />
              </label>
              <label>Filter Resonance (Q)
                <input id="fxFilterQ" type="number" min="0.1" max="20" step="0.1" value="1.2" />
              </label>
              <label>Distortion Drive
                <input id="fxDrive" type="number" min="0" max="1" step="0.01" value="0.2" />
              </label>
              <label>Delay Time (s)
                <input id="fxDelayTime" type="number" min="0" max="1.2" step="0.01" value="0.28" />
              </label>
              <label>Delay Feedback
                <input id="fxDelayFeedback" type="number" min="0" max="0.95" step="0.01" value="0.32" />
              </label>
              <label>Delay Mix
                <input id="fxDelayMix" type="number" min="0" max="1" step="0.01" value="0.24" />
              </label>
              <label>Stutter Rate (Hz)
                <input id="fxStutterRate" type="number" min="1" max="24" step="0.1" value="8" />
              </label>
              <label>Stutter Depth
                <input id="fxStutterDepth" type="number" min="0" max="1" step="0.01" value="0.12" />
              </label>
              <label>Glitch Chance
                <input id="fxGlitchChance" type="number" min="0" max="1" step="0.01" value="0.08" />
              </label>
              <label>Reverse Mix
                <input id="fxReverseMix" type="number" min="0" max="1" step="0.01" value="0.12" />
              </label>

              <div class="full section-title">Transport + Controllers</div>
              <div class="full actions">
                <button class="primary" type="submit" id="generateBtn">Generate Project</button>
                <button class="secondary" type="button" id="loadDefaultsBtn">Load Defaults</button>
                <button class="secondary" type="button" id="playBtn">Play Project</button>
                <button class="secondary" type="button" id="stopBtn">Stop</button>
                <button class="secondary" type="button" id="midiBtn">Connect MIDI</button>
              </div>
              <div class="full midi-state" id="midiState">MIDI: not connected</div>

              <div class="full section-title">Drum Machine Pads</div>
              <div class="full pads">
                <button class="pad" type="button" data-pad="kick">Kick</button>
                <button class="pad" type="button" data-pad="snare">Snare</button>
                <button class="pad" type="button" data-pad="hat">Hat</button>
              </div>
            </form>
            <p class="status" id="status">Loading presets…</p>
            <p class="fx-note">Effects process the original browser synth signal chain in real-time: filter → distortion → delay + stutter/glitch gate, with reverse-style envelope manipulation for tonal notes.</p>
          </div>
        </section>

        <section class="panel" aria-label="Generation Output">
          <div class="panel-head"><h2>Output</h2></div>
          <div class="panel-body">
            <div class="cards" id="summaryCards">
              <article class="card"><div class="k">Preset</div><div class="v" id="cardPreset">—</div></article>
              <article class="card"><div class="k">Total Events</div><div class="v" id="cardEvents">—</div></article>
              <article class="card"><div class="k">Sections</div><div class="v" id="cardSections">—</div></article>
              <article class="card"><div class="k">Measures</div><div class="v" id="cardMeasures">—</div></article>
              <article class="card"><div class="k">Duration</div><div class="v" id="cardDuration">—</div></article>
            </div>
            <div class="endpoint-links">
              <a href="/health" target="_blank" rel="noreferrer">GET /health</a>
              <a href="/api/music/presets" target="_blank" rel="noreferrer">GET /api/music/presets</a>
            </div>
            <label style="margin-top:12px; display:grid; gap:8px;">
              Generated project JSON
              <textarea id="result" readonly>{\n  "hint": "Generate a project to see output here."\n}</textarea>
            </label>
          </div>
        </section>
      </div>
    </main>

    <script>
      const state = {
        defaults: null,
        presets: [],
        moods: [],
        scales: [],
        currentProject: null,
      };

      const playback = {
        context: null,
        timeouts: [],
        activeNodes: new Set(),
        stutterTimer: null,
        glitchTimer: null,
        midi: null,
        midiInputs: [],
        chain: null,
      };

      const form = document.getElementById('generatorForm');
      const statusEl = document.getElementById('status');
      const resultEl = document.getElementById('result');
      const presetEl = document.getElementById('preset');
      const moodEl = document.getElementById('mood');
      const scaleEl = document.getElementById('scale');
      const generateBtn = document.getElementById('generateBtn');
      const playBtn = document.getElementById('playBtn');
      const stopBtn = document.getElementById('stopBtn');
      const midiBtn = document.getElementById('midiBtn');
      const midiStateEl = document.getElementById('midiState');

      const toOptions = (select, options, selected) => {
        select.innerHTML = options.map((value) => '<option value="' + value + '"' + (value === selected ? ' selected' : '') + '>' + value + '</option>').join('');
      };

      const setStatus = (message, isError = false) => {
        statusEl.textContent = message;
        statusEl.style.color = isError ? '#ff9aa8' : '#b9c8ff';
      };

      const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

      const registerNode = (node) => {
        playback.activeNodes.add(node);
        node.onended = () => playback.activeNodes.delete(node);
      };

      const makeDistortionCurve = (amount) => {
        const k = Math.max(0.001, amount * 400);
        const samples = 44100;
        const curve = new Float32Array(samples);

        for (let index = 0; index < samples; index += 1) {
          const x = (index * 2) / samples - 1;
          curve[index] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
        }

        return curve;
      };

      const createChain = (ctx) => {
        const input = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        const shaper = ctx.createWaveShaper();
        const delay = ctx.createDelay(1.2);
        const delayFeedback = ctx.createGain();
        const dry = ctx.createGain();
        const wet = ctx.createGain();
        const stutterGate = ctx.createGain();
        const output = ctx.createGain();

        filter.type = 'lowpass';
        filter.frequency.value = 1800;
        filter.Q.value = 1.2;

        shaper.curve = makeDistortionCurve(0.2);
        shaper.oversample = '4x';

        delay.delayTime.value = 0.28;
        delayFeedback.gain.value = 0.32;
        dry.gain.value = 0.76;
        wet.gain.value = 0.24;
        stutterGate.gain.value = 1;
        output.gain.value = 0.75;

        input.connect(filter);
        filter.connect(shaper);
        shaper.connect(dry);
        shaper.connect(delay);
        delay.connect(delayFeedback);
        delayFeedback.connect(delay);
        delay.connect(wet);

        dry.connect(stutterGate);
        wet.connect(stutterGate);
        stutterGate.connect(output);
        output.connect(ctx.destination);

        return { input, filter, shaper, delay, delayFeedback, dry, wet, stutterGate, output };
      };

      const clearFxTimers = () => {
        if (playback.stutterTimer) {
          clearInterval(playback.stutterTimer);
          playback.stutterTimer = null;
        }
        if (playback.glitchTimer) {
          clearInterval(playback.glitchTimer);
          playback.glitchTimer = null;
        }
      };

      const stopPlayback = () => {
        playback.timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
        playback.timeouts = [];
        clearFxTimers();

        for (const node of playback.activeNodes) {
          try {
            node.stop();
          } catch (_error) {
            // no-op
          }
        }

        playback.activeNodes.clear();

        if (playback.chain?.stutterGate) {
          playback.chain.stutterGate.gain.setValueAtTime(1, playback.context.currentTime);
        }
      };

      const ensureContext = async () => {
        if (!playback.context) {
          playback.context = new AudioContext();
          playback.chain = createChain(playback.context);
        }

        if (playback.context.state === 'suspended') {
          await playback.context.resume();
        }

        return playback.context;
      };

      const getFxSettings = () => ({
        synthProfile: document.getElementById('synthProfile').value,
        filterCutoff: Number(document.getElementById('fxFilterCutoff').value),
        filterQ: Number(document.getElementById('fxFilterQ').value),
        drive: Number(document.getElementById('fxDrive').value),
        delayTime: Number(document.getElementById('fxDelayTime').value),
        delayFeedback: Number(document.getElementById('fxDelayFeedback').value),
        delayMix: Number(document.getElementById('fxDelayMix').value),
        stutterRate: Number(document.getElementById('fxStutterRate').value),
        stutterDepth: Number(document.getElementById('fxStutterDepth').value),
        glitchChance: Number(document.getElementById('fxGlitchChance').value),
        reverseMix: Number(document.getElementById('fxReverseMix').value),
      });

      const applyFxSettings = (ctx, settings) => {
        const chain = playback.chain;
        if (!chain) {
          return;
        }

        chain.filter.frequency.setTargetAtTime(Math.max(80, Math.min(12000, settings.filterCutoff)), ctx.currentTime, 0.02);
        chain.filter.Q.setTargetAtTime(Math.max(0.1, Math.min(20, settings.filterQ)), ctx.currentTime, 0.02);

        chain.shaper.curve = makeDistortionCurve(Math.max(0, Math.min(1, settings.drive)));
        chain.delay.delayTime.setTargetAtTime(Math.max(0, Math.min(1.2, settings.delayTime)), ctx.currentTime, 0.02);
        chain.delayFeedback.gain.setTargetAtTime(Math.max(0, Math.min(0.95, settings.delayFeedback)), ctx.currentTime, 0.02);

        const wet = Math.max(0, Math.min(1, settings.delayMix));
        chain.wet.gain.setTargetAtTime(wet, ctx.currentTime, 0.02);
        chain.dry.gain.setTargetAtTime(1 - wet, ctx.currentTime, 0.02);

        chain.output.gain.setTargetAtTime(settings.synthProfile === 'micro_inspired' ? 0.8 : 0.72, ctx.currentTime, 0.02);

        clearFxTimers();

        const stutterDepth = Math.max(0, Math.min(1, settings.stutterDepth));
        const stutterRate = Math.max(1, Math.min(24, settings.stutterRate));
        playback.stutterTimer = setInterval(() => {
          if (!playback.chain) {
            return;
          }
          const value = Math.random() > 0.5 ? 1 : Math.max(0.05, 1 - stutterDepth);
          playback.chain.stutterGate.gain.setTargetAtTime(value, ctx.currentTime, 0.005);
        }, 1000 / stutterRate);

        const glitchChance = Math.max(0, Math.min(1, settings.glitchChance));
        playback.glitchTimer = setInterval(() => {
          if (!playback.chain || Math.random() > glitchChance) {
            return;
          }

          playback.chain.stutterGate.gain.setTargetAtTime(0.01, ctx.currentTime, 0.002);
          setTimeout(() => {
            if (playback.chain) {
              playback.chain.stutterGate.gain.setTargetAtTime(1, ctx.currentTime, 0.008);
            }
          }, 45 + Math.random() * 80);
        }, 90);
      };

      const scheduleTone = ({ ctx, frequency, when, duration, gainAmount, type = 'sine', reverseMix = 0 }) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, when);

        if (reverseMix > 0.35 && Math.random() < reverseMix) {
          gain.gain.setValueAtTime(0.0001, when);
          gain.gain.exponentialRampToValueAtTime(Math.max(0.001, gainAmount), when + Math.max(0.03, duration * 0.85));
          gain.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.04, duration + 0.05));
        } else {
          gain.gain.setValueAtTime(0.0001, when);
          gain.gain.exponentialRampToValueAtTime(Math.max(0.001, gainAmount), when + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.03, duration));
        }

        oscillator.connect(gain);
        gain.connect(playback.chain.input);

        oscillator.start(when);
        oscillator.stop(when + Math.max(0.05, duration + 0.08));
        registerNode(oscillator);
      };

      const scheduleKick = ({ ctx, when, duration, velocity }) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(140, when);
        oscillator.frequency.exponentialRampToValueAtTime(45, when + Math.max(0.03, duration));

        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.01, velocity / 130), when + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.04, duration));

        oscillator.connect(gain);
        gain.connect(playback.chain.input);

        oscillator.start(when);
        oscillator.stop(when + Math.max(0.06, duration + 0.05));
        registerNode(oscillator);
      };

      const scheduleNoise = ({ ctx, when, duration, velocity }) => {
        const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * Math.max(0.03, duration)));
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let index = 0; index < bufferSize; index += 1) {
          data[index] = Math.random() * 2 - 1;
        }

        const source = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        filter.type = 'highpass';
        filter.frequency.value = 1800;

        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.005, velocity / 250), when + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.03, duration));

        source.buffer = buffer;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(playback.chain.input);

        source.start(when);
        source.stop(when + Math.max(0.04, duration + 0.02));
        registerNode(source);
      };

      const synthProfileSettings = (profile) => {
        if (profile === 'micro_inspired') {
          return {
            laneVoice: { bass: 'square', chords: 'sawtooth', melody: 'square', texture: 'triangle' },
            gain: { bass: 0.11, chords: 0.1, melody: 0.1, texture: 0.06 },
          };
        }

        if (profile === 'poly_clean') {
          return {
            laneVoice: { bass: 'triangle', chords: 'sine', melody: 'triangle', texture: 'sine' },
            gain: { bass: 0.08, chords: 0.06, melody: 0.07, texture: 0.04 },
          };
        }

        return {
          laneVoice: { bass: 'sawtooth', chords: 'triangle', melody: 'square', texture: 'sine' },
          gain: { bass: 0.1, chords: 0.08, melody: 0.09, texture: 0.05 },
        };
      };

      const playEvent = ({ ctx, event, startAt, beatLength, fxSettings }) => {
        const when = startAt + event.beat * beatLength;
        const duration = Math.max(0.03, event.duration * beatLength);
        const velocity = Number(event.velocity ?? 80);

        if (event.lane === 'kick') {
          scheduleKick({ ctx, when, duration, velocity });
          return;
        }

        if (['snare', 'hat', 'openHat', 'perc', 'glitch'].includes(event.lane)) {
          scheduleNoise({ ctx, when, duration, velocity });
          return;
        }

        const profile = synthProfileSettings(fxSettings.synthProfile);
        scheduleTone({
          ctx,
          frequency: midiToFreq(event.midi),
          when,
          duration,
          gainAmount: (profile.gain[event.lane] ?? 0.06) * (velocity / 110),
          type: profile.laneVoice[event.lane] ?? 'sine',
          reverseMix: fxSettings.reverseMix,
        });
      };

      const playProject = async (project) => {
        if (!project?.tracks || !project?.meta?.bpm) {
          throw new Error('Generate a project first.');
        }

        stopPlayback();
        const ctx = await ensureContext();
        const fxSettings = getFxSettings();
        applyFxSettings(ctx, fxSettings);

        const beatLength = 60 / project.meta.bpm;
        const startAt = ctx.currentTime + 0.08;

        const allEvents = Object.values(project.tracks).flat().sort((left, right) => left.beat - right.beat);
        const totalDurationSeconds = Math.max(1, (project.meta.bars ?? 8) * 4 * beatLength + 0.4);

        allEvents.forEach((event) => {
          const timeoutId = setTimeout(() => {
            playEvent({ ctx, event, startAt, beatLength, fxSettings });
          }, Math.max(0, event.beat * beatLength * 1000));

          playback.timeouts.push(timeoutId);
        });

        const finishTimeout = setTimeout(() => {
          setStatus('Playback finished.');
          stopPlayback();
        }, totalDurationSeconds * 1000);

        playback.timeouts.push(finishTimeout);
      };

      const triggerPad = async (padName) => {
        const ctx = await ensureContext();
        applyFxSettings(ctx, getFxSettings());
        const when = ctx.currentTime + 0.01;

        if (padName === 'kick') {
          scheduleKick({ ctx, when, duration: 0.15, velocity: 120 });
          return;
        }

        if (padName === 'snare') {
          scheduleNoise({ ctx, when, duration: 0.12, velocity: 110 });
          return;
        }

        scheduleNoise({ ctx, when, duration: 0.06, velocity: 86 });
      };

      const connectMidi = async () => {
        if (!navigator.requestMIDIAccess) {
          throw new Error('Web MIDI is not supported in this browser.');
        }

        const access = await navigator.requestMIDIAccess();
        playback.midi = access;
        playback.midiInputs = [...access.inputs.values()];

        if (!playback.midiInputs.length) {
          midiStateEl.textContent = 'MIDI: no inputs detected';
          return;
        }

        const handler = async (message) => {
          const [status, note, velocity] = message.data;
          const command = status & 0xf0;

          if (command !== 0x90 || velocity === 0) {
            return;
          }

          const ctx = await ensureContext();
          applyFxSettings(ctx, getFxSettings());
          const profile = synthProfileSettings(getFxSettings().synthProfile);
          scheduleTone({
            ctx,
            frequency: midiToFreq(note),
            when: ctx.currentTime + 0.005,
            duration: 0.35,
            gainAmount: (profile.gain.melody ?? 0.08) * (velocity / 127),
            type: profile.laneVoice.melody ?? 'sine',
            reverseMix: getFxSettings().reverseMix,
          });
        };

        playback.midiInputs.forEach((input) => {
          input.onmidimessage = handler;
        });

        midiStateEl.textContent = 'MIDI: connected (' + playback.midiInputs.map((input) => input.name || 'unknown').join(', ') + ')';
      };

      const applyValues = (values) => {
        if (!values) {
          return;
        }

        Object.entries(values).forEach(([key, value]) => {
          const input = document.getElementById(key);
          if (!input || value == null || typeof value === 'object') {
            return;
          }
          input.value = String(value);
        });

        if (values.preset && state.presets.includes(values.preset)) {
          presetEl.value = values.preset;
        }
        if (values.mood && state.moods.includes(values.mood)) {
          moodEl.value = values.mood;
        }
        if (values.scale && state.scales.includes(values.scale)) {
          scaleEl.value = values.scale;
        }
      };

      const updateCards = (project) => {
        if (!project?.meta) {
          return;
        }

        document.getElementById('cardPreset').textContent = project.meta.preset || '—';
        document.getElementById('cardEvents').textContent = String(project.meta.totalEvents ?? '—');
        document.getElementById('cardSections').textContent = Array.isArray(project.meta.sections)
          ? project.meta.sections.map((section) => section.name).join(' • ')
          : '—';
        document.getElementById('cardMeasures').textContent = String(project.meta.measures ?? project.meta.bars ?? '—');
        document.getElementById('cardDuration').textContent = project.meta.durationMinutes
          ? project.meta.durationMinutes.toFixed(2) + ' min'
          : '—';
      };

      const collectPayload = () => ({
        seed: document.getElementById('seed').value.trim(),
        preset: presetEl.value,
        mood: moodEl.value,
        scale: scaleEl.value,
        key: document.getElementById('key').value.trim().toUpperCase(),
        bpm: Number(document.getElementById('bpm').value),
        bars: Number(document.getElementById('bars').value),
        density: Number(document.getElementById('density').value),
        swing: Number(document.getElementById('swing').value),
        syncopation: Number(document.getElementById('syncopation').value),
        mutation: Number(document.getElementById('mutation').value),
        instability: Number(document.getElementById('instability').value),
        brightness: Number(document.getElementById('brightness').value),
        texture: Number(document.getElementById('texture').value),
      });

      const loadPresets = async () => {
        setStatus('Loading presets…');

        const response = await fetch('/api/music/presets');
        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || 'Failed to load presets');
        }

        state.defaults = payload.data.defaults;
        state.presets = payload.data.presets || [];
        state.moods = payload.data.moods || [];
        state.scales = payload.data.scales || [];

        toOptions(presetEl, state.presets, state.defaults?.preset);
        toOptions(moodEl, state.moods, state.defaults?.mood);
        toOptions(scaleEl, state.scales, state.defaults?.scale);

        applyValues(state.defaults);
        setStatus('Ready. Choose settings and click Generate Project.');
      };

      const generate = async (payload) => {
        setStatus('Generating project…');
        generateBtn.disabled = true;

        const response = await fetch('/api/music/generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok || !result.ok) {
          throw new Error(result.error || 'Generation failed');
        }

        state.currentProject = result.data;
        resultEl.value = JSON.stringify(result.data, null, 2);
        updateCards(result.data);
        setStatus('Generated successfully. ' + (result.data.meta.durationMinutes ? 'Length: ' + result.data.meta.durationMinutes.toFixed(2) + ' min. ' : '') + 'Click Play Project to audition.');
      };

      document.getElementById('loadDefaultsBtn').addEventListener('click', () => {
        applyValues(state.defaults);
        setStatus('Defaults loaded.');
      });

      playBtn.addEventListener('click', async () => {
        try {
          await playProject(state.currentProject);
          setStatus('Playback started.');
        } catch (error) {
          setStatus(error.message || 'Unable to play project.', true);
        }
      });

      stopBtn.addEventListener('click', () => {
        stopPlayback();
        setStatus('Playback stopped.');
      });

      midiBtn.addEventListener('click', async () => {
        try {
          await connectMidi();
          setStatus('MIDI connected. Notes from your controller now trigger the synth.');
        } catch (error) {
          setStatus(error.message || 'Unable to connect MIDI.', true);
        }
      });

      document.querySelectorAll('[data-pad]').forEach((pad) => {
        pad.addEventListener('click', async () => {
          try {
            await triggerPad(pad.dataset.pad);
          } catch (error) {
            setStatus(error.message || 'Pad trigger failed.', true);
          }
        });
      });

      form.addEventListener('submit', async (event) => {
        event.preventDefault();

        try {
          await generate(collectPayload());
        } catch (error) {
          setStatus(error.message || 'Failed to generate project.', true);
        } finally {
          generateBtn.disabled = false;
        }
      });

      loadPresets().catch((error) => {
        setStatus(error.message || 'Failed to initialize UI.', true);
      });
    </script>
  </body>
</html>`;

const routeRequest = async (req, res) => {
  const origin = resolveOrigin(req);
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'OPTIONS') {
    return ok(res, { allow: ['GET', 'POST', 'OPTIONS'] }, 200, origin);
  }

  if (req.method === 'GET' && url.pathname === '/') {
    return sendHtml(res, 200, renderLandingPage(), origin);
  }

  if (req.method === 'GET' && url.pathname === '/favicon.ico') {
    return sendEmpty(res, 204, origin);
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return ok(res, { service: 'ATMG 2.0 music engine', status: 'ok' }, 200, origin);
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/guest') {
    return ok(res, createGuestSession(await readJsonBody(req)), 201, origin);
  }

  if (req.method === 'GET' && url.pathname === '/api/music/presets') {
    return ok(res, getMusicPresets(), 200, origin);
  }

  if (req.method === 'POST' && url.pathname === '/api/music/generate') {
    return ok(res, generateProject(validateGeneratorRequest(await readJsonBody(req))), 200, origin);
  }

  if (url.pathname === '/api/projects' && req.method === 'GET') {
    const session = requireSession(req);
    return ok(res, listProjects(session.id), 200, origin);
  }

  if (url.pathname === '/api/projects' && req.method === 'POST') {
    const session = requireSession(req);
    return ok(res, createProject({ userId: session.id, body: await readJsonBody(req) }), 201, origin);
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/projects/')) {
    const session = requireSession(req);
    const projectId = url.pathname.split('/').at(-1);
    return ok(res, getProject({ userId: session.id, projectId }), 200, origin);
  }

  if (req.method === 'POST' && url.pathname === '/api/uploads/analyze') {
    return ok(res, analyzeNotes(await readJsonBody(req)), 200, origin);
  }

  throw new HttpError(404, 'Route not found');
};

export const createApp = () =>
  createServer(async (req, res) => {
    try {
      await routeRequest(req, res);
    } catch (error) {
      const origin = resolveOrigin(req);
      const status = error.status ?? (error instanceof SyntaxError ? 400 : 500);
      const message = error instanceof SyntaxError ? 'Invalid JSON payload' : error.message ?? 'Unexpected server error';
      const details = error instanceof HttpError ? error.details : undefined;
      fail(res, status, message, details, origin);
    }
  });
