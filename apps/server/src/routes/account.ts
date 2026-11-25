import type { AppDeps } from '../app.ts';
import { CHALLENGE_POLICIES, FOLLOW_POLICIES, isErrorCode, NOTICES_KEPT, parseProfileDetails, type SessionView } from '@ligungi/protocol';
import { hashPassword, sessionHandle, verifyPassword } from '../auth.ts';
import { HttpError, sendJson, type Router } from '../http.ts';
import { ANONYMOUS_NAME } from '../users.ts';

/** The signed-in player's own account: password, deletion, sessions, data export, settings, profile, blocks and read notices. */
export const registerAccountRoutes = (router: Router, deps: AppDeps): void => {
  const { authLimiter, challengeStore, closeSessionSockets, closeUserSockets, config, discord, exportLimiter, games, lobby, moderation, notices, puzzles, racers, requireUser, rotateSession, seekStore, sendNotices, sessions, studies, twoFactor, users } = deps;
  router
    .add('POST', '/api/account/password', async (ctx) => {
      const userId = requireUser(ctx);
      if (!authLimiter.allow(ctx.ip)) throw new HttpError(429, 'tooManyAttempts');
      const { current, next } = (await ctx.body()) as { current?: unknown; next?: unknown };
      const user = users.findById(userId);
      if (!user || typeof current !== 'string' || !(await verifyPassword(current, user.passwordHash))) {
        throw new HttpError(401, 'wrongPassword');
      }
      if (typeof next !== 'string' || next.length < 8 || next.length > 200) throw new HttpError(400, 'invalidPassword');
      users.updatePasswordHash(userId, await hashPassword(next));
      // Every other device must sign in again with the new password.
      sessions.deleteOtherSessions(userId, ctx.session.id);
      closeUserSockets(userId);
      rotateSession(ctx, userId);
      sendJson(ctx.res, 200, { ok: true });
    })
    .add('POST', '/api/account/delete', async (ctx) => {
      const userId = requireUser(ctx);
      if (!authLimiter.allow(ctx.ip)) throw new HttpError(429, 'tooManyAttempts');
      const { password } = (await ctx.body()) as { password?: unknown };
      const user = users.findById(userId);
      if (!user || typeof password !== 'string' || !(await verifyPassword(password, user.passwordHash))) {
        throw new HttpError(401, 'wrongPassword');
      }
      if (games.hasOngoing(userId)) throw new HttpError(409, 'activeGame');
      lobby.removeUser(userId);
      games.anonymizeUser(userId, ANONYMOUS_NAME);
      discord.forget(userId);
      users.delete(userId);
      closeUserSockets(userId);
      rotateSession(ctx, null);
      sendJson(ctx.res, 200, { user: null });
    })
    .add('GET', '/api/account/sessions', (ctx) => {
      const userId = requireUser(ctx);
      const list: SessionView[] = sessions.listForUser(userId).map((session) => ({
        id: sessionHandle(session.id),
        current: session.id === ctx.session.id,
        createdAt: session.createdAt,
        seenAt: session.seenAt,
        userAgent: session.userAgent,
      }));
      sendJson(ctx.res, 200, list);
    })
    .add('DELETE', '/api/account/sessions', (ctx) => {
      const userId = requireUser(ctx);
      const removed = sessions.deleteOtherSessions(userId, ctx.session.id);
      closeSessionSockets(removed);
      sendJson(ctx.res, 200, { revoked: removed.length });
    })
    .add('DELETE', '/api/account/sessions/:id', (ctx) => {
      const userId = requireUser(ctx);
      const removed = sessions.deleteByHandle(userId, ctx.params.id!, ctx.session.id);
      if (!removed) throw new HttpError(404, 'sessionNotFound');
      closeSessionSockets([removed]);
      sendJson(ctx.res, 200, { revoked: 1 });
    })
    .add('GET', '/api/account/export', (ctx) => {
      const userId = requireUser(ctx);
      if (!exportLimiter.allow(userId)) throw new HttpError(429, 'tooManyAttempts');
      const user = users.findById(userId);
      if (!user) throw new HttpError(401, 'loginRequired');
      const iso = (ms: number) => new Date(ms).toISOString();
      const data = {
        about: 'Personal data held by ligungi for this account (LGPD access right). Display preferences live only in your browser.',
        exportedAt: iso(config.now()),
        account: { id: user.id, username: user.name, createdAt: iso(user.createdAt) },
        settings: { challengePolicy: users.social.challengePolicy(userId), followPolicy: users.social.followPolicy(userId) },
        profile: users.details(userId),
        puzzles: (() => {
          const { rating, history } = puzzles.dashboard(userId);
          const { best } = puzzles.runs(userId);
          return { rating, tries: history, solved: puzzles.solved(userId), runs: puzzles.allRuns(userId), best };
        })(),
        racer: racers.allResults(userId).map(({ score, at }) => ({ score, at: iso(at) })),
        bookmarks: games.bookmarks(userId).map((bookmark) => ({ game: bookmark.game.id, note: bookmark.note, bookmarkedAt: iso(bookmark.bookmarkedAt) })),
        studies: studies.byOwner(userId).map((study) => ({
          id: study.id,
          title: study.title,
          description: study.description,
          visibility: study.visibility,
          updatedAt: iso(study.updatedAt),
          chapters: studies.chapters(study.id),
        })),
        lessons: users.training.lessonProgress(userId),
        practice: users.training.practiceProgress(userId),
        // What moderation holds about the account: the suspension in force, the reports it made and the actions taken on
        // it (without naming the moderator).
        moderation: {
          suspension: moderation.suspension(userId),
          reportsMade: moderation.reportsBy(userId).map((report) => ({
            createdAt: iso(report.createdAt),
            player: report.target.name,
            reason: report.reason,
            details: report.details,
            gameId: report.gameId,
            studyId: report.studyId,
            status: report.status,
          })),
          actionsOnAccount: moderation.entries(userId).map((entry) => ({ action: entry.action, date: iso(entry.createdAt), details: entry.details })),
        },
        // Whether it is on, never the secret or the recovery codes (stored only as hashes).
        twoFactor: (({ enabled, enabledAt, recoveryCodesLeft }) => ({
          enabled,
          enabledAt: enabledAt === null ? null : iso(enabledAt),
          recoveryCodesLeft,
        }))(twoFactor.state(userId)),
        ratings: users.ratings(userId),
        discord: discord.exportFor(userId),
        following: users.social.following(userId).map((entry) => entry.name),
        followers: users.social.followers(userId).map((entry) => entry.name),
        blocked: users.social.blocked(userId).map((entry) => entry.name),
        notices: notices.list(userId, NOTICES_KEPT).map(({ kind, actor, subject, ref, createdAt, read }) => ({ kind, player: actor, subject, ref, date: iso(createdAt), read })),
        sessions: sessions.listForUser(userId).map((session) => ({
          current: session.id === ctx.session.id,
          createdAt: iso(session.createdAt),
          lastActive: iso(session.seenAt),
          browser: session.userAgent,
        })),
        games: games.history.exportFor(userId),
        // Only correspondence challenges and seeks are stored; the others live in memory for at most two hours.
        seeks: seekStore.forUser(userId).map((seek) => ({ id: seek.id, createdAt: iso(seek.createdAt), settings: seek.settings })),
        challenges: challengeStore.forUser(userId).map((challenge) => ({
          id: challenge.id,
          createdAt: iso(challenge.createdAt),
          sent: challenge.owner.userId === userId,
          opponent: challenge.owner.userId === userId ? (challenge.destination?.name ?? null) : challenge.owner.name,
          status: challenge.status,
          settings: challenge.settings,
          gameId: challenge.gameId,
        })),
      };
      ctx.res.setHeader('content-disposition', `attachment; filename="ligungi-${user.name}.json"`);
      ctx.res.setHeader('cache-control', 'no-store');
      sendJson(ctx.res, 200, data);
    })
    .add('GET', '/api/account/blocks', (ctx) => {
      const userId = requireUser(ctx);
      sendJson(ctx.res, 200, users.social.blocked(userId).map((user) => user.name));
    })
    .add('GET', '/api/account/settings', (ctx) => {
      const userId = requireUser(ctx);
      sendJson(ctx.res, 200, { challengePolicy: users.social.challengePolicy(userId), followPolicy: users.social.followPolicy(userId) });
    })
    .add('POST', '/api/account/settings', async (ctx) => {
      const userId = requireUser(ctx);
      const { challengePolicy, followPolicy } = (await ctx.body()) as { challengePolicy?: unknown; followPolicy?: unknown };
      const challenge = CHALLENGE_POLICIES.find((value) => value === challengePolicy);
      const follow = FOLLOW_POLICIES.find((value) => value === followPolicy);
      if (challengePolicy !== undefined && !challenge) throw new HttpError(400, 'invalidChallengePolicy');
      if (followPolicy !== undefined && !follow) throw new HttpError(400, 'invalidFollowPolicy');
      if (!challenge && !follow) throw new HttpError(400, 'invalidChallengePolicy');
      if (challenge) users.social.setChallengePolicy(userId, challenge);
      if (follow) users.social.setFollowPolicy(userId, follow);
      sendJson(ctx.res, 200, { challengePolicy: users.social.challengePolicy(userId), followPolicy: users.social.followPolicy(userId) });
    })
    .add('POST', '/api/notices/read', (ctx) => {
      const userId = requireUser(ctx);
      if (notices.markRead(userId)) sendNotices(userId);
      sendJson(ctx.res, 200, { ok: true });
    })
    .add('GET', '/api/account/profile', (ctx) => sendJson(ctx.res, 200, users.details(requireUser(ctx))))
    .add('POST', '/api/account/profile', async (ctx) => {
      const userId = requireUser(ctx);
      const details = parseProfileDetails(await ctx.body());
      if (isErrorCode(details)) throw new HttpError(400, details);
      users.setDetails(userId, details);
      sendJson(ctx.res, 200, details);
    });
};
