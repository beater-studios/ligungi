import type { Me, UserRef } from '@ligungi/protocol';
import { api } from './api.ts';
import { socket } from './socket.ts';
import { createStore } from './store.ts';

export const session = createStore<{ loaded: boolean; user: UserRef | null }>({ loaded: false, user: null });

export const loadSession = async (): Promise<Me> => {
  const me = await api.get<Me>('/api/me');
  session.set({ loaded: true, user: me.user });
  return me;
};

/** `code` is the two-factor code, sent with the password again once the server asked for it. */
export const login = async (username: string, password: string, signup: boolean, code?: string): Promise<void> => {
  const { user } = await api.post<{ user: UserRef }>(signup ? '/api/signup' : '/api/login', { username, password, ...(code ? { code } : {}) });
  session.set({ loaded: true, user });
  socket.reset();
};

export const logout = async (): Promise<void> => {
  await api.post('/api/logout');
  session.set({ loaded: true, user: null });
  socket.reset();
};
