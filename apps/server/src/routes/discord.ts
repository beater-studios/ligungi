import type { AppDeps } from '../app.ts';
import type { DiscordLinkResult } from '@ligungi/protocol';
import { HttpError, redirect, sendJson, type Router } from '../http.ts';
import { requireUser } from './guards.ts';

/** Linking a Discord account, and the rank roles and Linked Roles that follow. */
export const registerDiscordRoutes = (router: Router, deps: AppDeps): void => {
  const { discord, discordLimiter } = deps;
  router
    .add('GET', '/api/discord/link', (ctx) => {
      if (!discord.enabled) return redirect(ctx.res, '/account?discord=disabled');
      // Discord's Linked Roles page sends people here, signed in or not.
      if (!ctx.session.userId) return redirect(ctx.res, `/login?next=${encodeURIComponent('/api/discord/link')}`);
      // A page visit, not a fetch: a refusal goes back to the account page instead of showing raw JSON.
      if (!discordLimiter.allow(ctx.session.userId)) return redirect(ctx.res, '/account?discord=failed');
      redirect(ctx.res, discord.authorizeUrl(ctx.session.userId));
    })
    .add('GET', '/api/discord/callback', async (ctx) => {
      if (!discord.enabled) return redirect(ctx.res, '/account?discord=disabled');
      const code = ctx.url.searchParams.get('code');
      const state = ctx.url.searchParams.get('state');
      if (!ctx.session.userId) {
        if (state) discord.dropState(state);
        return redirect(ctx.res, '/account?discord=failed');
      }
      let result: DiscordLinkResult;
      if (code && state) result = await discord.complete(ctx.session.userId, state, code);
      else {
        if (state) discord.dropState(state);
        result = ctx.url.searchParams.get('error') === 'access_denied' ? 'denied' : 'failed';
      }
      redirect(ctx.res, `/account?discord=${result}`);
    })
    .add('GET', '/api/account/discord', (ctx) => sendJson(ctx.res, 200, discord.view(requireUser(ctx))))
    .add('POST', '/api/account/discord/check', async (ctx) => {
      const userId = requireUser(ctx);
      if (!discord.enabled) throw new HttpError('discordDisabled');
      if (!discord.view(userId).link) throw new HttpError('discordNotLinked');
      if (!discordLimiter.allow(userId)) throw new HttpError('tooManyAttempts');
      await discord.check(userId);
      sendJson(ctx.res, 200, discord.view(userId));
    })
    .add('DELETE', '/api/account/discord', async (ctx) => {
      const userId = requireUser(ctx);
      await discord.unlink(userId);
      sendJson(ctx.res, 200, discord.view(userId));
    });
};
