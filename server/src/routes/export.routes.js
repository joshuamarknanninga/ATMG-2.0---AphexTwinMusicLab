import { projectToMidi, projectToStemBundle } from '../services/exporter.js';
import { ensureObject } from '../utils/validate.js';

export const exportMidi = (body) => {
  const payload = ensureObject(body);
  const project = ensureObject(payload.project);
  return projectToMidi(project);
};

export const exportStems = (body) => {
  const payload = ensureObject(body);
  const project = ensureObject(payload.project);
  return projectToStemBundle(project);
};
