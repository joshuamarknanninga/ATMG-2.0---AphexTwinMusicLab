import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const appDirname = dirname(fileURLToPath(import.meta.url));

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
      .stepper-wrap { display: grid; grid-template-columns: 1fr auto; gap: 6px; align-items: center; }
      .stepper-buttons { display: grid; gap: 4px; }
      .stepper-buttons button { width: 28px; min-height: 24px; padding: 0; font-size: 14px; border-radius: 7px; }
      .pattern-grid { display: grid; gap: 6px; margin-top: 8px; }
      .pattern-row { display: grid; gap: 6px; grid-template-columns: 58px repeat(16, minmax(0, 1fr)); align-items: center; }
      .pattern-cell { min-height: 26px; padding: 0; background: #0f1d46; border: 1px solid #3553b3; border-radius: 6px; }
      .pattern-cell.active { background: #4f6fff; }
      .pattern-label { font-size: 12px; color: #9eb1f8; }
      .toggle-row {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 42px;
        border: 1px solid #3b4f9f;
        border-radius: 10px;
        padding: 8px 10px;
        background: #0d1638;
      }
      .toggle-row input[type="checkbox"] { width: 18px; height: 18px; margin: 0; }
      .toggle-row .toggle-text { font-size: 13px; color: #d4deff; }
      .bank-box { border: 1px solid #324894; border-radius: 10px; padding: 10px; background: #101a3f; display: grid; gap: 8px; }
      .bank-title { font-size: 12px; text-transform: uppercase; color: #9cb0ff; letter-spacing: .06em; }
      .analysis-output { border: 1px solid #30458e; border-radius: 10px; padding: 9px; min-height: 72px; background: #0b1433; font-size: 12px; color: #cfdbff; white-space: pre-wrap; }
      .toggles-grid { display: grid; gap: 8px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
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
                <input id="bars" name="bars" type="number" min="2" max="256" step="1" value="24" />
              </label>
              <label>Density
                <input id="density" name="density" type="number" min="0.15" max="0.8" step="0.01" value="0.42" />
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
              <label>Richness
                <input id="fxRichness" type="number" min="0" max="1" step="0.01" value="0.55" />
              </label>
              <label class="toggle-row"><input id="fxTapeDelay" type="checkbox" /><span class="toggle-text">Tape Delay</span></label>
              <label class="toggle-row"><input id="fxCpuSaver" type="checkbox" /><span class="toggle-text">CPU Saver</span></label>

              <div class="full section-title">Transport + Controllers</div>
              <div class="full actions">
                <button class="primary" type="submit" id="generateBtn">Generate Project</button>
                <button class="secondary" type="button" id="loadDefaultsBtn">Load Defaults</button>
                <button class="secondary" type="button" id="playBtn">Play Project</button>
                <button class="secondary" type="button" id="stopBtn">Stop</button>
                <button class="secondary" type="button" id="downloadMixBtn">Download Mix (MP3)</button>
                <button class="secondary" type="button" id="midiBtn">Connect MIDI</button>
                <button class="secondary" type="button" id="syncBtn">Sync Play</button>
              </div>
              <div class="full midi-state" id="midiState">MIDI: not connected</div>

              <div class="full section-title">Drum Machine Pads</div>
              <div class="full pads">
                <button class="pad" type="button" data-pad="kick">Kick</button>
                <button class="pad" type="button" data-pad="snare">Snare</button>
                <button class="pad" type="button" data-pad="hat">Hat</button>
              </div>
              <div class="full section-title">Pattern Lock + Sync</div>
              <label class="full toggle-row"><input id="lockPatternToggle" type="checkbox" /><span class="toggle-text">Lock Pattern</span></label>
              <label class="full">Drum Preset
                <select id="drumPresetSelect">
                  <option value="amen_break">Amen Break</option>
                  <option value="funky_drummer">Funky Drummer</option>
                  <option value="when_the_levee_breaks">When the Levee Breaks</option>
                  <option value="apache_break">Apache Break</option>
                </select>
              </label>
              <div class="full pattern-grid" id="patternGrid"></div>

              <div class="full section-title">Mix Banks + Auto Beat Matching</div>
              <div class="full bank-box">
                <div class="bank-title">Bank A</div>
                <input id="bankAFile" type="file" accept=".mp3,audio/mpeg,audio/mp3,audio/*" />
                <button class="secondary" type="button" id="analyzeBankABtn">Analyze Bank A</button>
                <div class="analysis-output" id="bankAAnalysis">No track loaded.</div>
              </div>
              <div class="full bank-box">
                <div class="bank-title">Bank B</div>
                <input id="bankBFile" type="file" accept=".mp3,audio/mpeg,audio/mp3,audio/*" />
                <button class="secondary" type="button" id="analyzeBankBBtn">Analyze Bank B</button>
                <div class="analysis-output" id="bankBAnalysis">No track loaded.</div>
              </div>
              <div class="full toggles-grid">
                <label class="toggle-row"><input id="matchTempoToggle" type="checkbox" checked /><span class="toggle-text">Tempo Match</span></label>
                <label class="toggle-row"><input id="matchBeatToggle" type="checkbox" checked /><span class="toggle-text">Beat Align</span></label>
                <label class="toggle-row"><input id="matchPhraseToggle" type="checkbox" checked /><span class="toggle-text">Phrase Match</span></label>
                <label class="toggle-row"><input id="matchKeyToggle" type="checkbox" checked /><span class="toggle-text">Key Match</span></label>
                <label class="toggle-row"><input id="matchEqToggle" type="checkbox" checked /><span class="toggle-text">EQ + Frequency Balance</span></label>
                <label class="toggle-row"><input id="matchEnergyToggle" type="checkbox" checked /><span class="toggle-text">Energy Match</span></label>
              </div>
              <button class="full secondary" type="button" id="autoMatchBtn">Auto Match Banks</button>
              <div class="full analysis-output" id="mixMatchOutput">Load and analyze both banks to build a matching plan.</div>
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

    <script src="/vendor/lame.min.js"></script>
    <script>
      if (!window.lamejs) {
        const fallback = document.createElement('script');
        fallback.src = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js';
        document.head.appendChild(fallback);
      }
    </script>
    <script>
      const state = {
        defaults: null,
        presets: [],
        moods: [],
        scales: [],
        currentProject: null,
        lockDrumPattern: false,
        drumPattern: {
          kick: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
          snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
          hat:  [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
        },
        banks: {
          a: { file: null, buffer: null, analysis: null },
          b: { file: null, buffer: null, analysis: null },
        },
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
        schedulerTimer: null,
        playbackEndTimer: null,
        tapeDelayTimer: null,
        recordingChunks: [],
        recordingNode: null,
        recordingSilence: null,
        pcmWorkletReady: false,
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
      const syncBtn = document.getElementById('syncBtn');
      const lockPatternToggleEl = document.getElementById('lockPatternToggle');
      const drumPresetSelectEl = document.getElementById('drumPresetSelect');
      const downloadMixBtn = document.getElementById('downloadMixBtn');
      const patternGridEl = document.getElementById('patternGrid');
      const midiStateEl = document.getElementById('midiState');
      const bankAFileEl = document.getElementById('bankAFile');
      const bankBFileEl = document.getElementById('bankBFile');
      const bankAAnalysisEl = document.getElementById('bankAAnalysis');
      const bankBAnalysisEl = document.getElementById('bankBAnalysis');
      const analyzeBankABtn = document.getElementById('analyzeBankABtn');
      const analyzeBankBBtn = document.getElementById('analyzeBankBBtn');
      const autoMatchBtn = document.getElementById('autoMatchBtn');
      const mixMatchOutputEl = document.getElementById('mixMatchOutput');

      const toOptions = (select, options, selected) => {
        select.innerHTML = options.map((value) => '<option value="' + value + '"' + (value === selected ? ' selected' : '') + '>' + value + '</option>').join('');
      };

      const DRUM_PRESETS = {
        amen_break: {
          kick: [1,0,0,0,1,0,0,0,0,0,1,0,0,0,1,0],
          snare:[0,0,1,0,0,0,0,1,0,0,1,0,0,0,0,1],
          hat:  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        },
        funky_drummer: {
          kick: [1,0,0,0,0,0,1,0,1,0,0,0,0,1,0,0],
          snare:[0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0],
          hat:  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        },
        when_the_levee_breaks: {
          kick: [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
          snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
          hat:  [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
        },
        apache_break: {
          kick: [1,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0],
          snare:[0,0,1,0,0,1,0,0,0,0,1,0,0,1,0,0],
          hat:  [1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1],
        },
      };

      const setStatus = (message, isError = false) => {
        statusEl.textContent = message;
        statusEl.style.color = isError ? '#ff9aa8' : '#b9c8ff';
      };

      const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

      const enhanceStepButtons = () => {
        const targets = ['fxFilterCutoff','fxFilterQ','fxDrive','fxDelayTime','fxDelayFeedback','fxDelayMix','fxStutterRate','fxStutterDepth','fxGlitchChance','fxReverseMix','fxRichness'];

        targets.forEach((id) => {
          const input = document.getElementById(id);
          if (!input || input.dataset.enhanced === '1') {
            return;
          }

          const step = Number(input.step || 1) || 1;
          const min = Number.isFinite(Number(input.min)) ? Number(input.min) : -Infinity;
          const max = Number.isFinite(Number(input.max)) ? Number(input.max) : Infinity;

          const wrap = document.createElement('div');
          wrap.className = 'stepper-wrap';

          const btnWrap = document.createElement('div');
          btnWrap.className = 'stepper-buttons';

          const up = document.createElement('button');
          up.type = 'button';
          up.textContent = '+';
          up.className = 'secondary';

          const down = document.createElement('button');
          down.type = 'button';
          down.textContent = '−';
          down.className = 'secondary';

          const adjust = (delta) => {
            const current = Number(input.value || 0);
            const next = Math.max(min, Math.min(max, current + delta));
            const decimals = step.toString().includes('.') ? step.toString().split('.')[1].length : 0;
            input.value = next.toFixed(decimals);
            input.dispatchEvent(new Event('change'));
          };

          up.addEventListener('click', () => adjust(step));
          down.addEventListener('click', () => adjust(-step));

          input.parentNode.insertBefore(wrap, input);
          wrap.appendChild(input);
          btnWrap.appendChild(up);
          btnWrap.appendChild(down);
          wrap.appendChild(btnWrap);
          input.dataset.enhanced = '1';
        });
      };

      const renderPatternGrid = () => {
        const lanes = ['kick','snare','hat'];
        patternGridEl.innerHTML = '';

        lanes.forEach((lane) => {
          const row = document.createElement('div');
          row.className = 'pattern-row';

          const label = document.createElement('div');
          label.className = 'pattern-label';
          label.textContent = lane.toUpperCase();
          row.appendChild(label);

          state.drumPattern[lane].forEach((value, step) => {
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'pattern-cell' + (value ? ' active' : '');
            cell.textContent = value ? '●' : '○';
            cell.addEventListener('click', () => {
              state.drumPattern[lane][step] = state.drumPattern[lane][step] ? 0 : 1;
              renderPatternGrid();
            });
            row.appendChild(cell);
          });

          patternGridEl.appendChild(row);
        });
      };

      const lockPatternToggle = () => {
        state.lockDrumPattern = lockPatternToggleEl.checked;
        setStatus(state.lockDrumPattern ? 'Pattern locked and ready to sync.' : 'Pattern unlocked.');
      };

      const applyDrumPreset = (presetId) => {
        const preset = DRUM_PRESETS[presetId];
        if (!preset) {
          return;
        }
        state.drumPattern = {
          kick: [...preset.kick],
          snare: [...preset.snare],
          hat: [...preset.hat],
        };
        renderPatternGrid();
        setStatus('Drum preset loaded: ' + presetId.replaceAll('_', ' ') + '.');
      };

      const buildLockedPatternEvents = ({ bars }) => {
        const events = [];
        if (!state.lockDrumPattern) {
          return events;
        }

        for (let bar = 0; bar < bars; bar += 1) {
          ['kick', 'snare', 'hat'].forEach((lane) => {
            state.drumPattern[lane].forEach((hit, stepIndex) => {
              if (!hit) {
                return;
              }

              events.push({
                lane,
                beat: bar * 4 + stepIndex * 0.25,
                duration: lane === 'hat' ? 0.06 : 0.12,
                velocity: lane === 'kick' ? 116 : lane === 'snare' ? 106 : 82,
                midi: lane === 'kick' ? 36 : lane === 'snare' ? 38 : 42,
              });
            });
          });
        }

        return events;
      };

      const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

      const estimateTempo = (samples, sampleRate) => {
        const hop = 1024;
        const envelope = [];
        for (let index = 0; index < samples.length - hop; index += hop) {
          let total = 0;
          for (let step = 0; step < hop; step += 1) {
            total += Math.abs(samples[index + step]);
          }
          envelope.push(total / hop);
        }

        if (envelope.length < 32) {
          return 120;
        }

        const minLag = Math.floor((60 / 180) * (sampleRate / hop));
        const maxLag = Math.floor((60 / 70) * (sampleRate / hop));
        let bestLag = minLag;
        let bestScore = 0;

        for (let lag = minLag; lag <= maxLag; lag += 1) {
          let score = 0;
          for (let i = 0; i < envelope.length - lag; i += 1) {
            score += envelope[i] * envelope[i + lag];
          }
          if (score > bestScore) {
            bestScore = score;
            bestLag = lag;
          }
        }

        const beatSeconds = (bestLag * hop) / sampleRate;
        return Math.max(70, Math.min(180, 60 / beatSeconds));
      };

      const estimateKey = (samples, sampleRate) => {
        const window = Math.min(samples.length, sampleRate * 6);
        let crossings = 0;
        for (let index = 1; index < window; index += 1) {
          if ((samples[index - 1] <= 0 && samples[index] > 0) || (samples[index - 1] >= 0 && samples[index] < 0)) {
            crossings += 1;
          }
        }
        if (!crossings) {
          return 'Unknown';
        }
        const approxHz = (crossings * sampleRate) / (2 * window);
        const midi = Math.round(69 + 12 * Math.log2(Math.max(1, approxHz) / 440));
        return noteNames[((midi % 12) + 12) % 12];
      };

      const analyzeAudioBuffer = (buffer) => {
        const channel = buffer.getChannelData(0);
        const sampleRate = buffer.sampleRate;
        const duration = buffer.duration;
        const bpm = estimateTempo(channel, sampleRate);

        let rmsTotal = 0;
        let peak = 0;
        let peakIndex = 0;
        let centroidAccumulator = 0;
        let centroidWeight = 0;
        const stride = 2048;
        for (let index = 0; index < channel.length; index += stride) {
          const value = channel[index];
          const abs = Math.abs(value);
          rmsTotal += value * value;
          if (abs > peak) {
            peak = abs;
            peakIndex = index;
          }
          centroidAccumulator += abs * index;
          centroidWeight += abs;
        }

        const rms = Math.sqrt(rmsTotal / Math.max(1, channel.length));
        const energy = Math.max(0, Math.min(1, rms * 3.4));
        const centroidRatio = centroidWeight ? centroidAccumulator / (centroidWeight * channel.length) : 0.5;
        const centroidHz = Math.round(centroidRatio * (sampleRate / 2));
        const firstPeakSeconds = peakIndex / sampleRate;

        return {
          duration,
          bpm,
          key: estimateKey(channel, sampleRate),
          energy,
          centroidHz,
          firstPeakSeconds,
        };
      };

      const renderBankAnalysis = (analysis) => {
        if (!analysis) {
          return 'No analysis available.';
        }
        return [
          'Duration: ' + analysis.duration.toFixed(2) + 's',
          'Tempo: ' + analysis.bpm.toFixed(2) + ' BPM',
          'Key: ' + analysis.key,
          'Energy: ' + analysis.energy.toFixed(3),
          'Freq centroid: ' + analysis.centroidHz + ' Hz',
          'First transient: ' + analysis.firstPeakSeconds.toFixed(3) + 's',
        ].join('\\n');
      };

      const decodeFileToBuffer = async (file) => {
        const ctx = await ensureContext();
        const bytes = await file.arrayBuffer();
        return ctx.decodeAudioData(bytes.slice(0));
      };

      const analyzeBank = async (bankId) => {
        const fileEl = bankId === 'a' ? bankAFileEl : bankBFileEl;
        const outputEl = bankId === 'a' ? bankAAnalysisEl : bankBAnalysisEl;
        const selectedFile = fileEl.files?.[0];

        if (!selectedFile) {
          throw new Error('Select an MP3/audio file for Bank ' + bankId.toUpperCase() + ' first.');
        }

        state.banks[bankId].file = selectedFile;
        outputEl.textContent = 'Analyzing ' + selectedFile.name + '…';
        const buffer = await decodeFileToBuffer(selectedFile);
        const analysis = analyzeAudioBuffer(buffer);
        state.banks[bankId].buffer = buffer;
        state.banks[bankId].analysis = analysis;
        outputEl.textContent = renderBankAnalysis(analysis);
        return analysis;
      };

      const collectMatchToggles = () => ({
        tempo: document.getElementById('matchTempoToggle').checked,
        beatAlignment: document.getElementById('matchBeatToggle').checked,
        phrase: document.getElementById('matchPhraseToggle').checked,
        key: document.getElementById('matchKeyToggle').checked,
        eq: document.getElementById('matchEqToggle').checked,
        energy: document.getElementById('matchEnergyToggle').checked,
      });

      const buildMatchPlan = (a, b, toggles) => {
        const tempoRatio = b.bpm ? a.bpm / b.bpm : 1;
        const beatOffsetSec = b.firstPeakSeconds - a.firstPeakSeconds;
        const beatOffsetBeats = beatOffsetSec / Math.max(0.0001, 60 / a.bpm);
        const phraseBars = Math.round(beatOffsetBeats / 16);
        const keyIndexA = noteNames.indexOf(a.key);
        const keyIndexB = noteNames.indexOf(b.key);
        const semitoneShift = keyIndexA >= 0 && keyIndexB >= 0 ? ((keyIndexA - keyIndexB + 18) % 12) - 6 : 0;
        const eqDeltaHz = a.centroidHz - b.centroidHz;
        const energyDelta = a.energy - b.energy;

        return [
          toggles.tempo ? 'Tempo match: set Bank B playbackRate to x' + tempoRatio.toFixed(4) + '.' : 'Tempo match: disabled.',
          toggles.beatAlignment ? 'Beat align: nudge Bank B by ' + beatOffsetSec.toFixed(3) + 's (' + beatOffsetBeats.toFixed(2) + ' beats).' : 'Beat align: disabled.',
          toggles.phrase ? 'Phrase match: shift phrase start by ' + phraseBars + ' bar(s).' : 'Phrase match: disabled.',
          toggles.key ? 'Key match: pitch-shift Bank B by ' + semitoneShift + ' semitone(s) toward ' + a.key + '.' : 'Key match: disabled.',
          toggles.eq ? 'EQ/Frequency balance: move Bank B tonal centroid by ' + eqDeltaHz.toFixed(0) + ' Hz toward Bank A.' : 'EQ/Frequency balance: disabled.',
          toggles.energy ? 'Energy match: adjust Bank B gain by ' + energyDelta.toFixed(3) + ' (normalized).' : 'Energy match: disabled.',
        ].join('\\n');
      };

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
        const delayTone = ctx.createBiquadFilter();
        const dry = ctx.createGain();
        const wet = ctx.createGain();
        const stutterGate = ctx.createGain();
        const output = ctx.createGain();
        const streamDestination = ctx.createMediaStreamDestination();

        filter.type = 'lowpass';
        filter.frequency.value = 1800;
        filter.Q.value = 1.2;

        shaper.curve = makeDistortionCurve(0.2);
        shaper.oversample = '4x';

        delay.delayTime.value = 0.28;
        delayFeedback.gain.value = 0.32;
        delayTone.type = 'lowpass';
        delayTone.frequency.value = 18000;
        dry.gain.value = 0.76;
        wet.gain.value = 0.24;
        stutterGate.gain.value = 1;
        output.gain.value = 0.75;

        input.connect(filter);
        filter.connect(shaper);
        shaper.connect(dry);
        shaper.connect(delayTone);
        delayTone.connect(delay);
        delay.connect(delayFeedback);
        delayFeedback.connect(delay);
        delay.connect(wet);

        dry.connect(stutterGate);
        wet.connect(stutterGate);
        stutterGate.connect(output);
        output.connect(ctx.destination);
        output.connect(streamDestination);

        return { input, filter, shaper, delay, delayFeedback, delayTone, dry, wet, stutterGate, output, streamDestination };
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
        if (playback.tapeDelayTimer) {
          clearInterval(playback.tapeDelayTimer);
          playback.tapeDelayTimer = null;
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

        if (playback.schedulerTimer) {
          clearInterval(playback.schedulerTimer);
          playback.schedulerTimer = null;
        }

        if (playback.playbackEndTimer) {
          clearTimeout(playback.playbackEndTimer);
          playback.playbackEndTimer = null;
        }

        if (playback.chain?.stutterGate && playback.context) {
          playback.chain.stutterGate.gain.setValueAtTime(1, playback.context.currentTime);
        }

        if (playback.recordingNode) {
          try {
            playback.recordingNode.disconnect();
          } catch (_error) {
            // no-op
          }
          playback.recordingNode = null;
        }

        if (playback.recordingSilence) {
          try {
            playback.recordingSilence.disconnect();
          } catch (_error) {
            // no-op
          }
          playback.recordingSilence = null;
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
        richness: Number(document.getElementById('fxRichness').value),
        cpuSaver: document.getElementById('fxCpuSaver').checked,
        tapeDelay: document.getElementById('fxTapeDelay').checked,
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
        const tapeOn = Boolean(settings.tapeDelay);
        chain.delayTone.frequency.setTargetAtTime(tapeOn ? 2600 : 18000, ctx.currentTime, 0.03);
        chain.delayFeedback.gain.setTargetAtTime(
          Math.max(0, Math.min(0.95, settings.delayFeedback + (tapeOn ? 0.08 : 0))),
          ctx.currentTime,
          0.03,
        );
        chain.shaper.curve = makeDistortionCurve(Math.max(0, Math.min(1, settings.drive + (tapeOn ? 0.04 : 0))));

        const richness = Math.max(0, Math.min(1, settings.richness ?? 0.55));
        chain.output.gain.setTargetAtTime(settings.synthProfile === 'micro_inspired' ? 0.78 : 0.7, ctx.currentTime, 0.02);
        chain.filter.frequency.setTargetAtTime(Math.max(80, Math.min(12000, settings.filterCutoff + richness * 2200)), ctx.currentTime, 0.02);
        chain.filter.Q.setTargetAtTime(Math.max(0.1, Math.min(20, settings.filterQ + richness * 0.9)), ctx.currentTime, 0.02);

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

        if (tapeOn) {
          playback.tapeDelayTimer = setInterval(() => {
            if (!playback.chain) {
              return;
            }
            const jitter = (Math.random() - 0.5) * 0.012;
            playback.chain.delay.delayTime.setTargetAtTime(
              Math.max(0, Math.min(1.2, settings.delayTime + jitter)),
              ctx.currentTime,
              0.08,
            );
          }, 180);
        }
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
        const punchOsc = ctx.createOscillator();
        const gain = ctx.createGain();
        const punchGain = ctx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(140, when);
        oscillator.frequency.exponentialRampToValueAtTime(46, when + Math.max(0.03, duration));

        punchOsc.type = 'triangle';
        punchOsc.frequency.setValueAtTime(240, when);
        punchOsc.frequency.exponentialRampToValueAtTime(80, when + 0.02);

        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.02, velocity / 110), when + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.04, duration));
        punchGain.gain.setValueAtTime(0.0001, when);
        punchGain.gain.exponentialRampToValueAtTime(Math.max(0.006, velocity / 400), when + 0.002);
        punchGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);

        oscillator.connect(gain);
        punchOsc.connect(punchGain);
        gain.connect(playback.chain.input);
        punchGain.connect(playback.chain.input);

        oscillator.start(when);
        punchOsc.start(when);
        oscillator.stop(when + Math.max(0.06, duration + 0.05));
        punchOsc.stop(when + 0.05);
        registerNode(oscillator);
        registerNode(punchOsc);
      };

      const scheduleNoise = ({ ctx, when, duration, velocity, lane = 'snare' }) => {
        const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * Math.max(0.03, duration)));
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let index = 0; index < bufferSize; index += 1) {
          data[index] = Math.random() * 2 - 1;
        }

        const source = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const toneFilter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        filter.type = lane === 'hat' || lane === 'openHat' ? 'highpass' : 'bandpass';
        filter.frequency.value = lane === 'hat' ? 5200 : lane === 'openHat' ? 4200 : lane === 'perc' ? 1200 : 1900;
        filter.Q.value = lane === 'snare' ? 1.4 : 0.8;

        toneFilter.type = 'lowpass';
        toneFilter.frequency.value = lane === 'hat' || lane === 'openHat' ? 9000 : lane === 'perc' ? 2800 : 6400;

        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.008, velocity / 220), when + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.03, duration));

        if (lane === 'snare') {
          const bodyOsc = ctx.createOscillator();
          const bodyGain = ctx.createGain();
          bodyOsc.type = 'triangle';
          bodyOsc.frequency.setValueAtTime(190, when);
          bodyOsc.frequency.exponentialRampToValueAtTime(130, when + Math.max(0.02, duration * 0.7));
          bodyGain.gain.setValueAtTime(0.0001, when);
          bodyGain.gain.exponentialRampToValueAtTime(Math.max(0.004, velocity / 520), when + 0.003);
          bodyGain.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.04, duration));
          bodyOsc.connect(bodyGain);
          bodyGain.connect(playback.chain.input);
          bodyOsc.start(when);
          bodyOsc.stop(when + Math.max(0.05, duration + 0.03));
          registerNode(bodyOsc);
        }

        source.buffer = buffer;
        source.connect(filter);
        filter.connect(toneFilter);
        toneFilter.connect(gain);
        gain.connect(playback.chain.input);

        source.start(when);
        source.stop(when + Math.max(0.04, duration + 0.02));
        registerNode(source);
      };

      const synthProfileSettings = (profile, fxSettings) => {
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

      const playEvent = ({ ctx, event, when, beatLength, fxSettings }) => {
        const duration = Math.max(0.03, event.duration * beatLength);
        const velocity = Number(event.velocity ?? 80);

        if (event.lane === 'kick') {
          scheduleKick({ ctx, when, duration, velocity });
          return;
        }

        if (['snare', 'hat', 'openHat', 'perc', 'glitch'].includes(event.lane)) {
          scheduleNoise({ ctx, when, duration, velocity, lane: event.lane });
          return;
        }

        const profile = synthProfileSettings(fxSettings.synthProfile, fxSettings);
        const richnessGain = 0.75 + (fxSettings.richness ?? 0.55) * 0.7;
        const profileGain = (profile.gain[event.lane] ?? 0.06) * richnessGain;
        scheduleTone({
          ctx,
          frequency: midiToFreq(event.midi),
          when,
          duration,
          gainAmount: profileGain * (velocity / 110),
          type: profile.laneVoice[event.lane] ?? 'sine',
          reverseMix: fxSettings.reverseMix,
        });
      };

      const mergeFloatChunks = (chunks) => {
        const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const merged = new Float32Array(length);
        let cursor = 0;
        chunks.forEach((chunk) => {
          merged.set(chunk, cursor);
          cursor += chunk.length;
        });
        return merged;
      };

      const floatToInt16 = (input) => {
        const output = new Int16Array(input.length);
        for (let index = 0; index < input.length; index += 1) {
          const sample = Math.max(-1, Math.min(1, input[index]));
          output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        }
        return output;
      };

      const encodeWavBlob = (pcm16, sampleRate) => {
        const buffer = new ArrayBuffer(44 + pcm16.length * 2);
        const view = new DataView(buffer);
        const writeString = (offset, text) => {
          for (let i = 0; i < text.length; i += 1) {
            view.setUint8(offset + i, text.charCodeAt(i));
          }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + pcm16.length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, pcm16.length * 2, true);

        let offset = 44;
        for (let i = 0; i < pcm16.length; i += 1) {
          view.setInt16(offset, pcm16[i], true);
          offset += 2;
        }

        return new Blob([buffer], { type: 'audio/wav' });
      };

      const triggerDownload = ({ blob, extension }) => {
        const href = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = href;
        a.download = 'atmg-mix-' + Date.now() + '.' + extension;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(href), 4000);
      };

      const ensurePcmWorklet = async (ctx) => {
        if (playback.pcmWorkletReady) {
          return;
        }

        if (!ctx.audioWorklet) {
          throw new Error('AudioWorklet is not supported in this browser.');
        }

        const moduleSource = [
          'class PcmCaptureProcessor extends AudioWorkletProcessor {',
          '  process(inputs) {',
          '    const input = inputs[0];',
          '    if (!input || !input[0]) {',
          '      return true;',
          '    }',
          '    this.port.postMessage(input[0]);',
          '    return true;',
          '  }',
          '}',
          "registerProcessor('pcm-capture-processor', PcmCaptureProcessor);",
        ].join('\\n');

        const blob = new Blob([moduleSource], { type: 'application/javascript' });
        const moduleUrl = URL.createObjectURL(blob);
        await ctx.audioWorklet.addModule(moduleUrl);
        URL.revokeObjectURL(moduleUrl);
        playback.pcmWorkletReady = true;
      };

      const startMp3Capture = async (ctx) => {
        if (!playback.chain?.output) {
          throw new Error('Audio output chain is not ready for recording.');
        }

        await ensurePcmWorklet(ctx);
        playback.recordingChunks = [];
        const recordingNode = new AudioWorkletNode(ctx, 'pcm-capture-processor', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          channelCount: 1,
        });
        const silence = ctx.createGain();
        silence.gain.value = 0;

        recordingNode.port.onmessage = (event) => {
          if (!event.data) {
            return;
          }
          playback.recordingChunks.push(new Float32Array(event.data));
        };

        playback.chain.output.connect(recordingNode);
        recordingNode.connect(silence);
        silence.connect(ctx.destination);

        playback.recordingNode = recordingNode;
        playback.recordingSilence = silence;
      };

      const finishMp3CaptureAndDownload = (sampleRate) => {
        if (!playback.recordingChunks.length) {
          setStatus('No audio captured for export.', true);
          return;
        }

        const merged = mergeFloatChunks(playback.recordingChunks);
        const pcm16 = floatToInt16(merged);

        if (window.lamejs && typeof window.lamejs.Mp3Encoder === 'function') {
          const encoder = new window.lamejs.Mp3Encoder(1, sampleRate, 192);
          const mp3Chunks = [];
          const blockSize = 1152;

          for (let index = 0; index < pcm16.length; index += blockSize) {
            const chunk = pcm16.subarray(index, index + blockSize);
            const encoded = encoder.encodeBuffer(chunk);
            if (encoded.length) {
              mp3Chunks.push(new Uint8Array(encoded));
            }
          }
          const finalChunk = encoder.flush();
          if (finalChunk.length) {
            mp3Chunks.push(new Uint8Array(finalChunk));
          }
          triggerDownload({ blob: new Blob(mp3Chunks, { type: 'audio/mpeg' }), extension: 'mp3' });
          playback.recordingChunks = [];
          setStatus('Mix downloaded as MP3 (iTunes compatible).');
          return;
        }

        triggerDownload({ blob: encodeWavBlob(pcm16, sampleRate), extension: 'wav' });
        playback.recordingChunks = [];
        setStatus('MP3 encoder unavailable, downloaded WAV fallback instead.');
      };

      const playProject = async (project, options = {}) => {
        if (!project?.tracks || !project?.meta?.bpm) {
          throw new Error('Generate a project first.');
        }

        stopPlayback();
        const ctx = await ensureContext();
        const fxSettings = getFxSettings();
        applyFxSettings(ctx, fxSettings);

        const beatLength = 60 / project.meta.bpm;
        const startAt = ctx.currentTime + 0.08;

        const generatedEvents = Object.entries(project.tracks)
          .filter(([name]) => !(state.lockDrumPattern && name === 'drums'))
          .flatMap(([, events]) => events);
        const lockedPatternEvents = buildLockedPatternEvents({ bars: project.meta.bars ?? 8 });
        const allEvents = [...generatedEvents, ...lockedPatternEvents].sort((left, right) => left.beat - right.beat);

        let cursor = 0;
        const lookAheadSeconds = fxSettings.cpuSaver ? 0.12 : 0.22;
        const schedulerTickMs = fxSettings.cpuSaver ? 35 : 20;

        const scheduleChunk = () => {
          const now = ctx.currentTime;
          while (cursor < allEvents.length) {
            const event = allEvents[cursor];
            const when = startAt + event.beat * beatLength;
            if (when > now + lookAheadSeconds) {
              break;
            }

            playEvent({ ctx, event, when, beatLength, fxSettings });
            cursor += 1;
          }
        };

        scheduleChunk();
        playback.schedulerTimer = setInterval(scheduleChunk, schedulerTickMs);

        const totalDurationSeconds = Math.max(1, (project.meta.bars ?? 8) * 4 * beatLength + 0.6);
        playback.playbackEndTimer = setTimeout(() => {
          if (options.record) {
            finishMp3CaptureAndDownload(ctx.sampleRate);
          } else {
            setStatus('Playback finished.');
          }
          stopPlayback();
        }, totalDurationSeconds * 1000);

        if (options.record) {
          await startMp3Capture(ctx);
        }
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

        if ('fxCpuSaver' in values) {
          document.getElementById('fxCpuSaver').checked = values.fxCpuSaver === true || values.fxCpuSaver === 'on';
        }
        if ('fxTapeDelay' in values) {
          document.getElementById('fxTapeDelay').checked = values.fxTapeDelay === true || values.fxTapeDelay === 'on';
        }
        if ('lockPatternToggle' in values) {
          lockPatternToggleEl.checked = values.lockPatternToggle === true || values.lockPatternToggle === 'on';
          state.lockDrumPattern = lockPatternToggleEl.checked;
        }

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

      downloadMixBtn.addEventListener('click', async () => {
        try {
          await playProject(state.currentProject, { record: true });
          setStatus('Rendering + recording mix… download begins automatically when playback ends.');
        } catch (error) {
          setStatus(error.message || 'Unable to export mix.', true);
        }
      });

      analyzeBankABtn.addEventListener('click', async () => {
        try {
          await analyzeBank('a');
          setStatus('Bank A analyzed.');
        } catch (error) {
          setStatus(error.message || 'Bank A analysis failed.', true);
        }
      });

      analyzeBankBBtn.addEventListener('click', async () => {
        try {
          await analyzeBank('b');
          setStatus('Bank B analyzed.');
        } catch (error) {
          setStatus(error.message || 'Bank B analysis failed.', true);
        }
      });

      autoMatchBtn.addEventListener('click', () => {
        const analysisA = state.banks.a.analysis;
        const analysisB = state.banks.b.analysis;
        if (!analysisA || !analysisB) {
          setStatus('Analyze both Bank A and Bank B before auto matching.', true);
          return;
        }
        const toggles = collectMatchToggles();
        const plan = buildMatchPlan(analysisA, analysisB, toggles);
        mixMatchOutputEl.textContent = plan;
        setStatus('Auto match plan generated from both banks.');
      });

      midiBtn.addEventListener('click', async () => {
        try {
          await connectMidi();
          setStatus('MIDI connected. Notes from your controller now trigger the synth.');
        } catch (error) {
          setStatus(error.message || 'Unable to connect MIDI.', true);
        }
      });

      syncBtn.addEventListener('click', async () => {
        try {
          await playProject(state.currentProject);
          setStatus('Sync started: music + synth + locked drum pattern aligned.');
        } catch (error) {
          setStatus(error.message || 'Unable to sync play.', true);
        }
      });

      lockPatternToggleEl.addEventListener('change', lockPatternToggle);
      drumPresetSelectEl.addEventListener('change', () => applyDrumPreset(drumPresetSelectEl.value));
      bankAFileEl.addEventListener('change', () => {
        state.banks.a = { file: bankAFileEl.files?.[0] ?? null, buffer: null, analysis: null };
        bankAAnalysisEl.textContent = state.banks.a.file ? 'Ready to analyze: ' + state.banks.a.file.name : 'No track loaded.';
      });
      bankBFileEl.addEventListener('change', () => {
        state.banks.b = { file: bankBFileEl.files?.[0] ?? null, buffer: null, analysis: null };
        bankBAnalysisEl.textContent = state.banks.b.file ? 'Ready to analyze: ' + state.banks.b.file.name : 'No track loaded.';
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

      const liveFxInputs = [
        'synthProfile','fxFilterCutoff','fxFilterQ','fxDrive','fxDelayTime','fxDelayFeedback','fxDelayMix',
        'fxStutterRate','fxStutterDepth','fxGlitchChance','fxReverseMix','fxRichness','fxCpuSaver','fxTapeDelay',
      ];
      liveFxInputs.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) {
          return;
        }
        el.addEventListener('input', () => {
          if (!playback.context || !playback.chain) {
            return;
          }
          applyFxSettings(playback.context, getFxSettings());
        });
        el.addEventListener('change', () => {
          if (!playback.context || !playback.chain) {
            return;
          }
          applyFxSettings(playback.context, getFxSettings());
        });
      });

      enhanceStepButtons();
      lockPatternToggleEl.checked = state.lockDrumPattern;
      applyDrumPreset(drumPresetSelectEl.value);
      renderPatternGrid();

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

  if (req.method === 'GET' && url.pathname === '/vendor/lame.min.js') {
    try {
      const content = await readFile(join(appDirname, '../../node_modules/lamejs/lame.min.js'), 'utf8');
      res.writeHead(200, {
        ...commonHeaders(origin),
        'content-type': 'application/javascript; charset=utf-8',
      });
      res.end(content);
      return;
    } catch (_error) {
      return fail(res, 404, 'lamejs asset unavailable');
    }
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
