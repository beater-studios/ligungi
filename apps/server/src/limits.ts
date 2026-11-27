import { DISCORD_PROXY, RateLimiter } from './http.ts';

/**
 * Every rate limit of the server, in one place. Each counts requests per key (an IP, a session, a user or a username)
 * over a window; the Discord proxy key gets more, since everyone playing inside Discord shares it.
 */
export const createLimits = (now: () => number) => ({
  /** Password checks per IP: signing up and in, and the account changes that ask for the password. */
  authLimiter: new RateLimiter(10, 60_000, now, { [DISCORD_PROXY]: 120 }),
  /** Failed logins per username, whatever the IP, so a botnet cannot brute-force one account. */
  loginFailures: new RateLimiter(20, 15 * 60_000, now),
  /** New sessions per IP: each one is a database row. */
  sessionLimiter: new RateLimiter(30, 60_000, now, { [DISCORD_PROXY]: 600 }),
  /** The export reads every game of the account: a few per minute is plenty. */
  exportLimiter: new RateLimiter(5, 60_000, now),
  /** Reports a player can file per hour: enough for real cases, too few to flood the queue. */
  reportLimiter: new RateLimiter(10, 60 * 60_000, now),
  /** Discord sign-ins and checks per player and minute: each one calls Discord. */
  discordLimiter: new RateLimiter(10, 60_000, now),
  /** Study writes and likes per player and minute: the editor saves on its own after each change, so this is generous. */
  studyLimiter: new RateLimiter(120, 60_000, now),
  /** Game searches and insights per session and minute: each one may read a large part of the games table. */
  searchLimiter: new RateLimiter(30, 60_000, now),
  /** Discord Activity sign-ins and actions per session. */
  activityLimiter: new RateLimiter(30, 60_000, now),
  /** Races created or joined per session: enough to play race after race, too few to fill the server with them. */
  raceLimiter: new RateLimiter(30, 60_000, now),
  /** Views of a call's rooms per session: the page asks every few seconds what the call has going on, so this allows more. */
  activityRoomsLimiter: new RateLimiter(120, 60_000, now),
  /** Joining and pausing an Arena per session: a player toggles it a few times at most. */
  arenaLimiter: new RateLimiter(30, 60_000, now),
});
