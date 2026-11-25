import { verifyPassword } from '../auth.ts';
import { HttpError, type Context } from '../http.ts';
import type { UserRecord, Users } from '../users.ts';

/** The signed-in user's id; a request without a session user is refused with `loginRequired`. */
export const requireUser = (ctx: Context): string => {
  if (!ctx.session.userId) throw new HttpError('loginRequired');
  return ctx.session.userId;
};

/** The signed-in user, once `password` is their current password; otherwise the request is refused with `wrongPassword`. */
export const requirePassword = async (users: Users, userId: string, password: unknown): Promise<UserRecord> => {
  const user = users.findById(userId);
  if (!user || typeof password !== 'string' || !(await verifyPassword(password, user.passwordHash))) throw new HttpError('wrongPassword');
  return user;
};
