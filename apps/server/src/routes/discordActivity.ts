import type { AppDeps } from '../app.ts';
import { ACTIVITY_TIME_CONTROLS, isErrorCode, parseSettings, type TimeControl } from '@ligungi/protocol';
import { HttpError, sendJson, type Router } from '../http.ts';

/** The Discord Activity: its sign-in and the rooms and race of a voice call. */
export const registerDiscordActivityRoutes = (router: Router, deps: AppDeps): void => {
  const { activities, ACTIVITY_INSTANCE, activityCaller, activityLimiter, activityOrigin, activityPlayers, activityRoomsLimiter, discord, moderation, racers, rememberActivityPlayer, rotateSession, twoFactor, users } = deps;
  router
    .add('GET', '/api/activity/config', (ctx) => {
      if (!activityOrigin) throw new HttpError('activityDisabled');
      sendJson(ctx.res, 200, { clientId: discord.clientId });
    })
    .add('POST', '/api/activity/session', async (ctx) => {
      if (!activityOrigin) throw new HttpError('activityDisabled');
      if (!activityLimiter.allow(ctx.session.id)) throw new HttpError('tooManyAttempts');
      const { code } = (await ctx.body()) as { code?: unknown };
      if (typeof code !== 'string' || code.length === 0 || code.length > 200) throw new HttpError('activitySignInFailed');
      const signed = await discord.activitySignIn(code);
      if (!signed) throw new HttpError('activitySignInFailed');
      // A linked account signs in, unless it is suspended or uses two-step verification, which Discord cannot stand in
      // for; then, as for anyone without a linked account, the player is a guest.
      const reason = !signed.userId
        ? 'unlinked'
        : moderation.suspension(signed.userId)
          ? 'suspended'
          : twoFactor.isEnabled(signed.userId)
            ? 'twoFactor'
            : null;
      const userId = reason === null ? signed.userId : null;
      const next = rotateSession(ctx, userId);
      rememberActivityPlayer(next.id, signed.discordId);
      const user = userId ? users.findById(userId) : undefined;
      sendJson(ctx.res, 200, { user: user ? { id: user.id, name: user.name } : null, reason, accessToken: signed.accessToken });
    })
    .add('GET', '/api/activity/rooms', (ctx) => {
      if (!activityOrigin) throw new HttpError('activityDisabled');
      if (!activityPlayers.has(ctx.session.id)) throw new HttpError('activitySignInRequired');
      if (!activityRoomsLimiter.allow(ctx.session.id)) throw new HttpError('tooManyAttempts');
      const instanceId = ctx.url.searchParams.get('instanceId') ?? '';
      if (!ACTIVITY_INSTANCE.test(instanceId)) throw new HttpError('notInActivity');
      sendJson(ctx.res, 200, { ...activities.view(instanceId, ctx.player), race: racers.callRace(instanceId) });
    })
    .add('POST', '/api/activity/race', async (ctx) => {
      const body = (await ctx.body()) as { instanceId?: unknown };
      const instanceId = await activityCaller(ctx, body.instanceId);
      // The call has one race to join at a time: the one not started yet, else a new one.
      const open = racers.callRace(instanceId);
      if (open && open.status !== 'racing') {
        const joined = racers.join(open.id, ctx.player, instanceId);
        if (joined) throw new HttpError(joined);
        return sendJson(ctx.res, 200, { id: open.id });
      }
      sendJson(ctx.res, 200, { id: racers.create(ctx.player, 'call', instanceId) });
    })
    .add('POST', '/api/activity/rooms', async (ctx) => {
      const body = (await ctx.body()) as { instanceId?: unknown; mode?: unknown; timeControl?: unknown; color?: unknown };
      const instanceId = await activityCaller(ctx, body.instanceId);
      const asked = body.timeControl as Partial<TimeControl> | null | undefined;
      const timeControl = ACTIVITY_TIME_CONTROLS.find((tc) => tc.initial === asked?.initial && tc.increment === asked?.increment);
      if (!timeControl) throw new HttpError('invalidInitialTime');
      const settings = parseSettings({ mode: body.mode, rated: false, timeControl, color: body.color });
      if (isErrorCode(settings)) throw new HttpError(settings);
      const opened = activities.open(instanceId, ctx.player, settings);
      if (typeof opened === 'string') throw new HttpError(opened);
      sendJson(ctx.res, 200, opened);
    })
    .add('POST', '/api/activity/rooms/:id/join', async (ctx) => {
      const body = (await ctx.body()) as { instanceId?: unknown };
      const instanceId = await activityCaller(ctx, body.instanceId);
      const joined = activities.join(instanceId, ctx.params.id!, ctx.player);
      if (typeof joined === 'string') throw new HttpError(joined);
      sendJson(ctx.res, 200, joined);
    });
};
