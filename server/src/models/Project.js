const projectStore = new Map();

export const projectModel = {
  listByOwner(ownerId) {
    return [...projectStore.values()].filter((project) => project.ownerId === ownerId);
  },
  get(projectId) {
    return projectStore.get(projectId) ?? null;
  },
  save(project) {
    projectStore.set(project.id, project);
    return project;
  },
};
