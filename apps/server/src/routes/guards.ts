import { HttpError, type Context } from '../http.ts';

/** The signed-in user's id; a request without a session user is refused with `loginRequired`. */
export const requireUser = (ctx: Context): string => {
  if (!ctx.session.userId) throw new HttpError('loginRequired');
  return ctx.session.userId;
};
