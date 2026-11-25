import type { Me, UserRef } from '@ligungi/protocol';
import { api } from './api.ts';
import { socket } from './socket.ts';
import { createStore } from './store.ts';

/** `moderator`: the user moderates the site, which shows the moderation links and tools. */
export const session = createStore<{ loaded: boolean; user: UserRef | null; moderator: boolean }>({ loaded: false, user: null, moderator: false });

export const loadSession = async (): Promise<Me> => {
  const me = await api.get<Me>('/api/me');
  session.set({ loaded: true, user: me.user, moderator: me.moderator });
  return me;
};

/** `code` is the two-factor code, sent with the password again once the server asked for it. */
export const login = async (username: string, password: string, signup: boolean, code?: string): Promise<void> => {
  const { user } = await api.post<{ user: UserRef }>(signup ? '/api/signup' : '/api/login', { username, password, ...(code ? { code } : {}) });
  session.set({ loaded: true, user, moderator: false });
  socket.reset();
  // Whether the account moderates comes with /api/me.
  if (!signup) void loadSession().catch(() => undefined);
};

export const logout = async (): Promise<void> => {
  await api.post('/api/logout');
  session.set({ loaded: true, user: null, moderator: false });
  socket.reset();
};
