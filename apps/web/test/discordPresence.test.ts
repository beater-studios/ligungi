// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { presenceOf } from '../src/discordActivity.ts';

describe('Discord status inside the Activity', () => {
  it('follows what the page says the player is doing', () => {
    expect(presenceOf({ kind: 'game', mode: 'advanced', status: 'started', role: 'player' })).toEqual({ details: 'Advanced', state: 'Playing a game' });
    expect(presenceOf({ kind: 'game', mode: 'intro', status: 'started', role: 'spectator' })).toEqual({ details: 'Introductory', state: 'Watching a game' });
    expect(presenceOf({ kind: 'game', mode: 'beginner', status: 'ended', role: 'player' })).toEqual({ details: 'Beginner', state: 'Reviewing a game' });
    expect(presenceOf({ kind: 'computer', mode: 'intermediate', level: '3', status: 'started' })).toEqual({ details: 'Intermediate', state: 'Computer · level 3' });
    expect(presenceOf({ kind: 'computer', mode: 'intro' })).toEqual({ details: 'Introductory', state: 'Playing a game' });
    expect(presenceOf({})).toEqual({ state: 'Browsing the site' });
  });
});
