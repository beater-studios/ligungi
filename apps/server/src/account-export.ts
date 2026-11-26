import type { AppDeps } from './app.ts';
import { NOTICES_KEPT } from '@ligungi/protocol';
import type { UserRecord } from './users.ts';

/**
 * Everything the site keeps about an account, for its owner to download (LGPD access right). `sessionId` is the
 * session asking, marked as the current one.
 */
export const accountExport = (deps: AppDeps, user: UserRecord, sessionId: string) => {
  const { challengeStore, config, discord, games, moderation, notices, puzzles, racers, seekStore, sessions, studies, twoFactor, users } = deps;

  const userId = user.id;
  const iso = (ms: number) => new Date(ms).toISOString();
  return {
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
    likedStudies: studies.likesBy(userId).map(({ studyId, at }) => ({ study: studyId, likedAt: iso(at) })),
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
      current: session.id === sessionId,
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
};
