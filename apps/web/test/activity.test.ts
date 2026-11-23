// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyActivity } from '../src/activity.ts';

describe('page activity', () => {
  it('writes the activity as data attributes and removes only its own', () => {
    const root = document.documentElement;
    root.setAttribute('data-theme', 'dark');
    const clear = applyActivity(root, { kind: 'game', mode: 'advanced', role: 'player', white: 'Gon', black: '' });
    expect(root.getAttribute('data-activity-kind')).toBe('game');
    expect(root.getAttribute('data-activity-mode')).toBe('advanced');
    expect(root.getAttribute('data-activity-black')).toBe('');
    clear();
    expect([...root.attributes].map((attribute) => attribute.name).filter((name) => name.startsWith('data-activity-'))).toEqual([]);
    expect(root.getAttribute('data-theme')).toBe('dark');
  });
});
