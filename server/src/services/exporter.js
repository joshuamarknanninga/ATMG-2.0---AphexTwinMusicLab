const textEncoder = new TextEncoder();

const u32be = (value) => Uint8Array.of((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
const u16be = (value) => Uint8Array.of((value >>> 8) & 0xff, value & 0xff);

const encodeVarLen = (value) => {
  let buffer = value & 0x7f;
  const bytes = [];
  while ((value >>= 7)) {
    buffer <<= 8;
    buffer |= ((value & 0x7f) | 0x80);
  }
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) {
      buffer >>= 8;
      continue;
    }
    break;
  }
  return Uint8Array.from(bytes);
};

const concat = (...parts) => {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let cursor = 0;
  parts.forEach((part) => {
    output.set(part, cursor);
    cursor += part.length;
  });
  return output;
};

const toTicks = (beats, ticksPerBeat) => Math.max(0, Math.round(beats * ticksPerBeat));

const laneProgram = (lane) => {
  if (lane === 'bass') return 38; // synth bass
  if (lane === 'chords') return 89; // warm pad
  if (lane === 'texture') return 95; // sweep pad
  return 81; // lead square
};

const laneChannel = (lane) => (['kick', 'snare', 'hat', 'openHat', 'perc', 'glitch', 'drums'].includes(lane) ? 9 : 0);

const collectTrackEvents = (events, ticksPerBeat) => {
  const midiEvents = [];
  events.forEach((note) => {
    const startTick = toTicks(note.beat, ticksPerBeat);
    const endTick = toTicks(note.beat + note.duration, ticksPerBeat);
    const channel = laneChannel(note.lane);
    const pitch = Math.max(0, Math.min(127, Math.round(note.midi)));
    const velocity = Math.max(1, Math.min(127, Math.round(note.velocity ?? 88)));
    midiEvents.push({ tick: startTick, data: Uint8Array.of(0x90 | channel, pitch, velocity) });
    midiEvents.push({ tick: Math.max(startTick + 1, endTick), data: Uint8Array.of(0x80 | channel, pitch, 0) });
  });
  midiEvents.sort((a, b) => a.tick - b.tick);

  let previousTick = 0;
  const encoded = [];
  midiEvents.forEach((entry) => {
    encoded.push(encodeVarLen(entry.tick - previousTick));
    encoded.push(entry.data);
    previousTick = entry.tick;
  });

  encoded.push(encodeVarLen(0), Uint8Array.of(0xff, 0x2f, 0x00));
  return concat(...encoded);
};

const makeTrackChunk = (trackData) =>
  concat(textEncoder.encode('MTrk'), u32be(trackData.length), trackData);

export const projectToMidi = (project) => {
  const ticksPerBeat = 480;
  const tempo = Math.max(40, Math.min(260, Math.round(project?.meta?.bpm ?? 120)));
  const microsecondsPerQuarter = Math.round(60000000 / tempo);

  const tempoTrackData = concat(
    encodeVarLen(0),
    Uint8Array.of(0xff, 0x51, 0x03, (microsecondsPerQuarter >>> 16) & 0xff, (microsecondsPerQuarter >>> 8) & 0xff, microsecondsPerQuarter & 0xff),
    encodeVarLen(0),
    Uint8Array.of(0xff, 0x2f, 0x00),
  );

  const tracks = Object.entries(project?.tracks ?? {}).map(([name, events]) => {
    const channel = laneChannel(name);
    const program = laneProgram(name);
    const header = channel === 9
      ? concat(encodeVarLen(0), Uint8Array.of(0x99, 36, 1), encodeVarLen(0), Uint8Array.of(0x89, 36, 0))
      : concat(encodeVarLen(0), Uint8Array.of(0xc0 | channel, program));
    const body = collectTrackEvents(Array.isArray(events) ? events : [], ticksPerBeat);
    return makeTrackChunk(concat(header, body));
  });

  const header = concat(
    textEncoder.encode('MThd'),
    u32be(6),
    u16be(1),
    u16be(tracks.length + 1),
    u16be(ticksPerBeat),
  );

  return concat(header, makeTrackChunk(tempoTrackData), ...tracks);
};

export const projectToStemBundle = (project) => ({
  version: 1,
  exportedAt: new Date().toISOString(),
  meta: project?.meta ?? {},
  stems: Object.fromEntries(
    Object.entries(project?.tracks ?? {}).map(([name, events]) => [
      name,
      {
        lane: name,
        noteCount: Array.isArray(events) ? events.length : 0,
        notes: Array.isArray(events) ? events : [],
      },
    ]),
  ),
});
