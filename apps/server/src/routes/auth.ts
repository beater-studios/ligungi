import type { AppDeps } from '../app.ts';
import type { Me, TwoFactorSetup, TwoFactorView } from '@ligungi/protocol';
import { hashPassword, needsRehash, verifyPassword, type Session } from '../auth.ts';
import { HttpError, sendJson, type Router } from '../http.ts';
import { requireUser } from './guards.ts';
import { otpauthUri } from '../totp.ts';
import { USERNAME_PATTERN } from '../users.ts';

/** Signing up, in and out, the session bootstrap (`/api/me`) and two-step verification. */
export const registerAuthRoutes = (router: Router, deps: AppDeps): void => {
  const { authLimiter, closeSessionSockets, games, loginFailures, moderation, puzzles, rotateSession, sessions, toPlayer, twoFactor, users } = deps;

  /**
   * A code typed on the account page by a user with two-factor on. Wrong codes count with the failed logins of the
   * account, so an open session does not give more guesses than the sign-in form.
   */
  const checkAccountCode = (userId: string, code: unknown): void => {
    const key = users.findById(userId)?.name.toLowerCase() ?? userId;
    if (loginFailures.blocked(key)) throw new HttpError('tooManyAttempts');
    if (typeof code !== 'string' || !twoFactor.verify(userId, code)) {
      loginFailures.allow(key);
      throw new HttpError('wrongTwoFactorCode');
    }
  };

  const userPayload = (session: Session) => {
    const player = toPlayer(session);
    return player.userId ? { id: player.userId, name: player.name } : null;
  };

  router
    .add('GET', '/api/me', (ctx) => {
      const me: Me = {
        user: userPayload(ctx.session),
        playing: games.playingFor(ctx.session.id, ctx.session.userId),
        moderator: moderation.isModerator(ctx.session.userId),
        puzzleRating: ctx.session.userId ? puzzles.ratingView(ctx.session.userId) : null,
      };
      sendJson(ctx.res, 200, me);
    })
    .add('POST', '/api/signup', async (ctx) => {
      if (!authLimiter.allow(ctx.ip)) throw new HttpError('tooManyAttempts');
      const { username, password } = (await ctx.body()) as { username?: unknown; password?: unknown };
      if (typeof username !== 'string' || !USERNAME_PATTERN.test(username)) {
        throw new HttpError('invalidUsername');
      }
      if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
        throw new HttpError('invalidPassword');
      }
      const user = users.create(username, await hashPassword(password));
      if (!user) throw new HttpError('usernameTaken');
      rotateSession(ctx, user.id);
      sendJson(ctx.res, 200, { user: { id: user.id, name: user.name } });
    })
    .add('POST', '/api/login', async (ctx) => {
      if (!authLimiter.allow(ctx.ip)) throw new HttpError('tooManyAttempts');
      const { username, password, code } = (await ctx.body()) as { username?: unknown; password?: unknown; code?: unknown };
      const key = typeof username === 'string' ? username.toLowerCase() : '';
      if (loginFailures.blocked(key)) throw new HttpError('tooManyAttempts');
      const user = typeof username === 'string' ? users.findByName(username) : undefined;
      if (!user || typeof password !== 'string' || !(await verifyPassword(password, user.passwordHash))) {
        loginFailures.allow(key);
        throw new HttpError('wrongCredentials');
      }
      const suspension = moderation.suspension(user.id);
      if (suspension) throw new HttpError('accountSuspended', { until: suspension.until, reason: suspension.reason });
      // The client sends the password again with the code, so no half signed-in state lives on the server.
      if (twoFactor.isEnabled(user.id)) {
        if (code === undefined || code === '') throw new HttpError('twoFactorRequired');
        if (typeof code !== 'string' || !twoFactor.verify(user.id, code)) {
          loginFailures.allow(key);
          throw new HttpError('wrongTwoFactorCode');
        }
      }
      if (needsRehash(user.passwordHash)) users.updatePasswordHash(user.id, await hashPassword(password));
      rotateSession(ctx, user.id);
      sendJson(ctx.res, 200, { user: { id: user.id, name: user.name } });
    })
    .add('POST', '/api/logout', (ctx) => {
      rotateSession(ctx, null);
      sendJson(ctx.res, 200, { user: null });
    })
    .add('GET', '/api/account/two-factor', (ctx) => {
      const userId = requireUser(ctx);
      const { enabled, recoveryCodesLeft } = twoFactor.state(userId);
      const view: TwoFactorView = { enabled, recoveryCodesLeft };
      sendJson(ctx.res, 200, view);
    })
    .add('POST', '/api/account/two-factor/setup', async (ctx) => {
      const userId = requireUser(ctx);
      if (!authLimiter.allow(ctx.ip)) throw new HttpError('tooManyAttempts');
      // The password, so that someone using a forgotten open session cannot lock the owner out.
      const { password } = (await ctx.body()) as { password?: unknown };
      const user = users.findById(userId);
      if (!user || typeof password !== 'string' || !(await verifyPassword(password, user.passwordHash))) {
        throw new HttpError('wrongPassword');
      }
      const secret = twoFactor.begin(userId);
      if (!secret) throw new HttpError('twoFactorEnabled');
      const setup: TwoFactorSetup = { secret, uri: otpauthUri(user.name, secret) };
      ctx.res.setHeader('cache-control', 'no-store');
      sendJson(ctx.res, 200, setup);
    })
    .add('DELETE', '/api/account/two-factor/setup', (ctx) => {
      twoFactor.cancel(requireUser(ctx));
      sendJson(ctx.res, 200, { ok: true });
    })
    .add('POST', '/api/account/two-factor/enable', async (ctx) => {
      const userId = requireUser(ctx);
      if (!authLimiter.allow(ctx.ip)) throw new HttpError('tooManyAttempts');
      const { code, signOutOthers } = (await ctx.body()) as { code?: unknown; signOutOthers?: unknown };
      const result = twoFactor.confirm(userId, typeof code === 'string' ? code : '');
      if (result === 'notSetUp') throw new HttpError('twoFactorNotSetUp');
      if (result === 'wrongCode') throw new HttpError('wrongTwoFactorCode');
      // Sessions opened before only had to pass the password: whoever turns this on may want them gone.
      const revoked = signOutOthers === true ? sessions.deleteOtherSessions(userId, ctx.session.id) : [];
      closeSessionSockets(revoked);
      ctx.res.setHeader('cache-control', 'no-store');
      sendJson(ctx.res, 200, { recoveryCodes: result, revoked: revoked.length });
    })
    .add('POST', '/api/account/two-factor/recovery', async (ctx) => {
      const userId = requireUser(ctx);
      if (!authLimiter.allow(ctx.ip)) throw new HttpError('tooManyAttempts');
      const { code } = (await ctx.body()) as { code?: unknown };
      checkAccountCode(userId, code);
      ctx.res.setHeader('cache-control', 'no-store');
      sendJson(ctx.res, 200, { recoveryCodes: twoFactor.regenerate(userId) });
    })
    .add('POST', '/api/account/two-factor/disable', async (ctx) => {
      const userId = requireUser(ctx);
      if (!authLimiter.allow(ctx.ip)) throw new HttpError('tooManyAttempts');
      const { password, code } = (await ctx.body()) as { password?: unknown; code?: unknown };
      const user = users.findById(userId);
      if (!user || typeof password !== 'string' || !(await verifyPassword(password, user.passwordHash))) {
        throw new HttpError('wrongPassword');
      }
      checkAccountCode(userId, code);
      twoFactor.disable(userId);
      sendJson(ctx.res, 200, { ok: true });
    });
};
