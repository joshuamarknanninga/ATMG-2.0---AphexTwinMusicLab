import crypto from 'node:crypto';

import { projectModel } from '../models/Project.js';
import { generateProject } from '../services/generator.js';
import { HttpError } from '../utils/errors.js';
import { asString, ensureObject } from '../utils/validate.js';
import { validateGeneratorRequest } from './music.routes.js';

export const listProjects = (userId) => projectModel.listByOwner(userId);

export const createProject = ({ userId, body }) => {
  const payload = ensureObject(body);
  const name = asString(payload.name, 'name', { min: 2, max: 80 });
  const settings = payload.settings == null ? {} : validateGeneratorRequest(payload.settings);
  const generated = generateProject(settings);

  return projectModel.save({
    id: crypto.randomUUID(),
    ownerId: userId,
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: generated.meta,
    tracks: generated.tracks,
  });
};

export const getProject = ({ userId, projectId }) => {
  const project = projectModel.get(projectId);
  if (!project || project.ownerId !== userId) {
    throw new HttpError(404, 'Project not found');
  }

  return project;
};
