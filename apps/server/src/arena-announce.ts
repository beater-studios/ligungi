import type { UserRef } from '@ligungi/protocol';
import type { ArenaEvent } from './arenas.ts';

/** A message for the Discord channel: its text and who it may mention. */
export interface ArenaMessage {
  readonly content: string;
  readonly roles: readonly string[];
  readonly users: readonly string[];
}

const ORDINALS = ['1st', '2nd', '3rd'];

/** Discord shows `<t:…:F>` in each reader's own time zone and language. */
const when = (at: number, style: 'F' | 't' = 'F') => `<t:${Math.floor(at / 1000)}:${style}>`;

/**
 * The text the bot posts, in English (the server's main language). Players who linked their Discord account are
 * mentioned; the others are named as on the site. `discordId` returns the linked account, if any.
 */
export const arenaMessage = (event: ArenaEvent, origin: string, roleId: string | null, discordId: (userId: string) => string | null): ArenaMessage => {
  const link = `${origin}/arena/${event.arena}`;
  const users: string[] = [];
  const name = (user: UserRef) => {
    const id = discordId(user.id);
    if (!id) return user.name;
    users.push(id);
    return `<@${id}>`;
  };
  switch (event.kind) {
    case 'soon': {
      const ping = roleId ? `<@&${roleId}> ` : '';
      const joined = event.joined === 1 ? '1 player is in so far' : `${event.joined} players are in so far`;
      return {
        content: `${ping}The Weekly Arena starts in 1 hour, at ${when(event.startsAt, 't')}.\nAdvanced · 5+3 · 90 minutes · rated. ${joined}.\nJoin: ${link}`,
        roles: roleId ? [roleId] : [],
        users,
      };
    }
    case 'started':
      return { content: `The Weekly Arena has started with ${event.joined} players! Jump in anytime in the next 90 minutes: ${link}`, roles: [], users };
    case 'canceled': {
      const next = event.next ? ` See you next time, ${when(event.next)}.` : '';
      const joined = event.joined === 1 ? '1 player joined' : `${event.joined} players joined`;
      return { content: `This week's Arena did not start: ${joined}, and it needs 4.${next}\nUp for a game now? ${origin}`, roles: [], users };
    }
    case 'finished': {
      const lines = [`Weekly Arena results, ${event.players} players:`];
      for (const place of event.podium) lines.push(`${ORDINALS[place.rank - 1] ?? `${place.rank}th`} ${name(place.user)}, ${place.score} points`);
      if (event.champion) lines.push(`${name(event.champion)} is this week's Weekly Champion. Congratulations!`);
      lines.push(`Full standings: ${link}`);
      if (event.next) lines.push(`Next Arena: ${when(event.next)}`);
      return { content: lines.join('\n'), roles: [], users: [...new Set(users)] };
    }
  }
};
