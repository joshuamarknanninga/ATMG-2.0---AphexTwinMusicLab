const users = new Map();

export const userModel = {
  save(user) {
    users.set(user.id, user);
    return user;
  },
  get(userId) {
    return users.get(userId) ?? null;
  },
};
