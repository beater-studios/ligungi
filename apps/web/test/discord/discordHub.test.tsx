// @vitest-environment jsdom
import type { ActivityHallView } from '@ligungi/protocol';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { ActivityHubView } from '../../src/discord/Hub.tsx';

const settings = { mode: 'beginner', rated: false, timeControl: { initial: 600, increment: 5 }, daysPerMove: null, color: 'white', freeDraft: false } as const;

const hall: ActivityHallView = {
  rooms: [
    { challengeId: 'theirs', settings, challenger: { name: 'Ana', user: { id: 'ana', name: 'Ana' }, rating: 1512 }, mine: false },
    { challengeId: 'mine', settings: { ...settings, color: 'random' }, challenger: { name: '', user: null, rating: null }, mine: true },
  ],
  games: [],
  race: null,
};

const mount = (props: Partial<Parameters<typeof ActivityHubView>[0]> = {}) => {
  const handlers = { onOpen: vi.fn(async () => undefined), onJoin: vi.fn(async () => undefined), onClose: vi.fn(async () => undefined), onInvite: vi.fn(), onRace: vi.fn(async () => undefined) };
  const root = document.body.appendChild(document.createElement('div'));
  act(() =>
    render(h(ActivityHubView, { state: { status: 'ready', instanceId: 'call', reason: null }, hall, people: [{ id: '1', name: 'Ana', avatar: null }], ...handlers, ...props }), root),
  );
  const button = (text: string) => [...root.querySelectorAll('button')].find((b) => b.textContent === text)!;
  return { root, handlers, button };
};

describe('Discord hub', () => {
  it('offers to join the rooms of others, from the joiner’s side, and to cancel one’s own', async () => {
    const { root, handlers, button } = mount();
    const rows = [...root.querySelectorAll('.ligungi-hub__row')];
    expect(rows[0]!.textContent).toContain('Ana');
    // Ana plays White, so whoever joins plays Black.
    expect(rows[0]!.textContent).toContain('you play Black');
    expect(rows[1]!.textContent).toContain('Your room');
    await act(async () => button('Join').click());
    expect(handlers.onJoin).toHaveBeenCalledWith('theirs');
    await act(async () => button('Cancel').click());
    expect(handlers.onClose).toHaveBeenCalledWith('mine');
    button('Invite to the Activity').click();
    expect(handlers.onInvite).toHaveBeenCalled();
    expect(root.querySelector('[aria-label="Ana"]')?.textContent).toBe('A');
  });

  it('opens a room with the chosen mode, time and color', async () => {
    const { root, handlers } = mount({ hall: { rooms: [], games: [], race: null } });
    expect(root.textContent).toContain('No rooms yet');
    act(() => (root.querySelector('#hub-mode-advanced') as HTMLInputElement).click());
    act(() => (root.querySelector('#hub-time-0') as HTMLInputElement).click());
    act(() => (root.querySelector('#hub-color-black') as HTMLInputElement).click());
    await act(async () => {
      root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    });
    expect(handlers.onOpen).toHaveBeenCalledWith({ mode: 'advanced', timeControl: { initial: 180, increment: 2 }, color: 'black' });
  });

  it('opens the call\'s race, offers to join the waiting one and to watch the one going on', async () => {
    const empty = mount({ hall: { rooms: [], games: [], race: null } });
    await act(async () => empty.button('Race with the call').click());
    expect(empty.handlers.onRace).toHaveBeenCalled();
    const waiting = mount({ hall: { rooms: [], games: [], race: { id: 'r1', status: 'waiting', players: 3 } } });
    expect(waiting.button('Join the race (3 players)')).toBeTruthy();
    const racing = mount({ hall: { rooms: [], games: [], race: { id: 'r1', status: 'racing', players: 3 } } });
    expect(racing.root.querySelector('a[href="/racer/r1"]')?.textContent).toBe('Watch the race');
  });

  it('says when it is still connecting', () => {
    const { root } = mount({ state: { status: 'starting' } });
    expect(root.querySelector('[role="status"]')?.textContent).toMatch(/connecting/i);
  });
});
