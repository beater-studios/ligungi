import type { AppDeps } from '../app.ts';
import { REPORT_DETAILS_MAX, REPORT_REASONS, SUSPENSION_DAYS, type ModUserView, type ReportReason, type StudyRoot } from '@ligungi/protocol';
import { HttpError, sendJson, type Router } from '../http.ts';
import { USERNAME_PATTERN } from '../users.ts';

/** Reports, and what moderators do: reports, the log, sanctions, voided games and studies. */
export const registerModerationRoutes = (router: Router, deps: AppDeps): void => {
  const { closeSessionSockets, closeUserSockets, discord, discordText, findUser, games, lobby, moderation, notice, publishGame, reasonOf, REPORT_LABELS, reportLimiter, requireModerator, requireUser, sanctionable, sessions, studies, users } = deps;
  router
    .add('POST', '/api/reports', async (ctx) => {
      const userId = requireUser(ctx);
      if (!reportLimiter.allow(userId)) throw new HttpError(429, 'tooManyAttempts');
      const { username, reason, details, gameId, studyId, chapterId, chapterPath } = (await ctx.body()) as Record<string, unknown>;
      const study = typeof studyId === 'string' ? studies.get(studyId) : undefined;
      if (studyId !== undefined && (!study || !studies.canRead(study, userId, false))) throw new HttpError(404, 'studyNotFound');
      // The chapter and move the reporter was on, so a moderator lands on the drawing or comment reported.
      const chapter =
        study && typeof chapterId === 'string' && studies.chapter(study.id, chapterId)
          ? { id: chapterId, path: typeof chapterPath === 'string' && /^\d{1,3}(\.\d{1,3}){0,199}$/.test(chapterPath) ? chapterPath : '' }
          : null;
      const target = study ? users.findById(study.ownerId) : typeof username === 'string' ? users.findByName(username) : undefined;
      if (!target) throw new HttpError(404, 'userNotFound');
      if (target.id === userId) throw new HttpError(400, 'cannotReportSelf');
      const text = typeof details === 'string' ? details.trim() : '';
      if (!REPORT_REASONS.includes(reason as ReportReason) || text.length > REPORT_DETAILS_MAX) throw new HttpError(400, 'invalidReport');
      const game = typeof gameId === 'string' && games.get(gameId) ? gameId : null;
      const result = moderation.report(userId, target.id, reason as ReportReason, text, game, study?.id ?? null, chapter);
      if (result === 'alreadyReported') throw new HttpError(409, 'alreadyReported');
      sendJson(ctx.res, 200, { ok: true });
      // The moderators hear of it on Discord at once, with a link to what was reported.
      const origin = discord.siteOrigin;
      if (origin) {
        const where = study
          ? `${origin}/study/${study.id}${chapter ? `?chapter=${chapter.id}${chapter.path ? `&move=${chapter.path}` : ''}` : ''}`
          : game
            ? `${origin}/${game}`
            : `${origin}/@/${target.name}`;
        const reporter = users.findById(userId)?.name ?? '?';
        const lines = [
          `**New report** · ${REPORT_LABELS[reason as ReportReason]}${study ? ` · study "${discordText(study.title)}"` : ''}`,
          `${discordText(target.name)}, reported by ${discordText(reporter)}`,
          ...(text ? [`> ${discordText(text).replace(/\n/g, '\n> ')}`] : []),
          `<${where}> · <${origin}/mod>`,
        ];
        void discord.notifyModerators(lines.join('\n'));
      }
    })
    .add('POST', '/api/mod/studies/:id/hide', async (ctx) => {
      const moderator = requireModerator(ctx);
      const study = studies.get(ctx.params.id!);
      if (!study) throw new HttpError(404, 'studyNotFound');
      const { hidden, reason } = (await ctx.body()) as { hidden?: unknown; reason?: unknown };
      const text = reasonOf(reason);
      const hide = hidden !== false;
      studies.setHidden(study.id, hide);
      moderation.log(hide ? 'hideStudy' : 'unhideStudy', moderator.name, { id: study.ownerId, name: study.ownerName }, `${study.title} (${study.id}) · ${text}`);
      if (hide !== study.hidden) notice(study.ownerId, hide ? 'studyHidden' : 'studyRestored', { subject: study.title, ref: study.id });
      sendJson(ctx.res, 200, { ok: true });
    })
    .add('POST', '/api/mod/studies/:id/chapters/:chapterId/clear-drawings', async (ctx) => {
      const moderator = requireModerator(ctx);
      const study = studies.get(ctx.params.id!);
      const chapter = study ? studies.chapter(study.id, ctx.params.chapterId!) : undefined;
      if (!study || !chapter) throw new HttpError(404, 'studyNotFound');
      const { reason } = (await ctx.body()) as { reason?: unknown };
      const text = reasonOf(reason);
      // Every arrow and painted square of the chapter goes; the moves and comments stay.
      const strip = <T extends StudyRoot>(node: T): T => ({ ...node, shapes: [], children: node.children.map(strip) });
      studies.updateChapter(study.id, chapter.id, { name: chapter.name, orientation: chapter.orientation, root: strip(chapter.root) });
      moderation.log('clearDrawings', moderator.name, { id: study.ownerId, name: study.ownerName }, `${study.title} (${study.id}) · ${chapter.name} · ${text}`);
      notice(study.ownerId, 'studyDrawingsCleared', { subject: study.title, ref: study.id });
      sendJson(ctx.res, 200, { ok: true });
    })
    .add('POST', '/api/mod/studies/:id/delete', async (ctx) => {
      const moderator = requireModerator(ctx);
      const study = studies.get(ctx.params.id!);
      if (!study) throw new HttpError(404, 'studyNotFound');
      const { reason } = (await ctx.body()) as { reason?: unknown };
      const text = reasonOf(reason);
      studies.delete(study.id);
      moderation.log('deleteStudy', moderator.name, { id: study.ownerId, name: study.ownerName }, `${study.title} (${study.id}) · ${text}`);
      notice(study.ownerId, 'studyDeleted', { subject: study.title });
      sendJson(ctx.res, 200, { ok: true });
    })
    .add('GET', '/api/mod/reports', (ctx) => {
      requireModerator(ctx);
      const status = ctx.url.searchParams.get('status') === 'closed' ? 'closed' : 'open';
      sendJson(ctx.res, 200, moderation.reports(status));
    })
    .add('POST', '/api/mod/reports/:id/close', async (ctx) => {
      const moderator = requireModerator(ctx);
      const report = moderation.reportById(ctx.params.id!);
      if (!report) throw new HttpError(404, 'reportNotFound');
      const { resolution } = (await ctx.body()) as { resolution?: unknown };
      const text = reasonOf(resolution);
      moderation.closeReport(report.id, moderator.name, text);
      moderation.log('closeReport', moderator.name, report.target, text, report.gameId);
      if (report.status === 'open') notice(report.reporter.id, 'reportClosed', { subject: report.target.name });
      sendJson(ctx.res, 200, { ok: true });
    })
    .add('GET', '/api/mod/log', (ctx) => {
      requireModerator(ctx);
      sendJson(ctx.res, 200, moderation.entries());
    })
    .add('GET', '/api/mod/users/:name', (ctx) => {
      requireModerator(ctx);
      const user = findUser(ctx.params.name!);
      const view: ModUserView = {
        user: { id: user.id, name: user.name },
        moderator: moderation.isModerator(user.id),
        suspension: moderation.suspension(user.id),
        openReports: moderation.openReportsAbout(user.id),
        log: moderation.entries(user.id, 50),
      };
      sendJson(ctx.res, 200, view);
    })
    .add('POST', '/api/mod/users/:name/suspend', async (ctx) => {
      const moderator = requireModerator(ctx);
      const target = sanctionable(ctx.params.name!);
      const { days, reason } = (await ctx.body()) as { days?: unknown; reason?: unknown };
      if (!SUSPENSION_DAYS.includes(days as number | null)) throw new HttpError(400, 'invalidSuspension');
      const text = reasonOf(reason);
      moderation.suspend(target.id, days as number | null, text);
      // Out everywhere at once: no session, no socket, nothing left waiting in the lobby, and the games in progress lost.
      lobby.cancelUser(target.id);
      games.forfeitAll(target.id);
      closeSessionSockets(sessions.deleteOtherSessions(target.id, ''));
      closeUserSockets(target.id);
      moderation.log('suspend', moderator.name, { id: target.id, name: target.name }, `${days === null ? '∞' : `${String(days)}d`} · ${text}`);
      sendJson(ctx.res, 200, { ok: true });
    })
    .add('POST', '/api/mod/users/:name/unsuspend', async (ctx) => {
      const moderator = requireModerator(ctx);
      const target = findUser(ctx.params.name!);
      if (!moderation.suspension(target.id)) throw new HttpError(409, 'notSuspended');
      const { reason } = (await ctx.body()) as { reason?: unknown };
      const text = reasonOf(reason);
      moderation.unsuspend(target.id);
      moderation.log('unsuspend', moderator.name, { id: target.id, name: target.name }, text);
      notice(target.id, 'suspensionLifted');
      sendJson(ctx.res, 200, { ok: true });
    })
    .add('POST', '/api/mod/users/:name/rename', async (ctx) => {
      const moderator = requireModerator(ctx);
      const target = sanctionable(ctx.params.name!);
      const { username, reason } = (await ctx.body()) as { username?: unknown; reason?: unknown };
      if (typeof username !== 'string' || !USERNAME_PATTERN.test(username)) throw new HttpError(400, 'invalidUsername');
      const text = reasonOf(reason);
      if (!users.rename(target.id, username)) throw new HttpError(409, 'usernameTaken');
      games.renameUser(target.id, username);
      lobby.renameUser(target.id, username);
      // Their sockets carry the old name: reconnecting picks up the new one.
      closeUserSockets(target.id);
      moderation.log('rename', moderator.name, { id: target.id, name: username }, `${target.name} → ${username} · ${text}`);
      notice(target.id, 'renamed', { subject: username });
      sendJson(ctx.res, 200, { user: { id: target.id, name: username } });
    })
    .add('POST', '/api/mod/users/:name/clear-profile', async (ctx) => {
      const moderator = requireModerator(ctx);
      const target = sanctionable(ctx.params.name!);
      const { reason } = (await ctx.body()) as { reason?: unknown };
      const text = reasonOf(reason);
      // The bio and the linked profiles are what can offend; the country stays.
      users.setDetails(target.id, { ...users.details(target.id), bio: '', links: {} });
      moderation.log('clearProfile', moderator.name, { id: target.id, name: target.name }, text);
      notice(target.id, 'profileCleared');
      sendJson(ctx.res, 200, { ok: true });
    })
    .add('POST', '/api/mod/games/:id/void', async (ctx) => {
      const moderator = requireModerator(ctx);
      const { reason } = (await ctx.body()) as { reason?: unknown };
      const text = reasonOf(reason);
      const room = games.voidGame(ctx.params.id!);
      if (room === 'gameNotFound') throw new HttpError(404, 'gameNotFound');
      if (room === 'gameNotVoidable') throw new HttpError(409, 'gameNotVoidable');
      moderation.log('void', moderator.name, null, text, room.id);
      for (const seat of Object.values(room.seats)) if (seat.userId) notice(seat.userId, 'gameVoided', { ref: room.id });
      publishGame(room);
      sendJson(ctx.res, 200, { ok: true });
    });
};
