// @vitest-environment jsdom
import { LESSON_STAGE_IDS, PRACTICE_POSITIONS } from '@ligungi/content';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';

/**
 * An automated accessibility check (axe) of every screen that renders without a server, with the screen reader mode on
 * and off. jsdom has no layout, so the rules that need one (color contrast, sizes) are left to the manual checks in
 * docs/accessibility.md; the rest (names, roles, ARIA, labels, landmarks, headings) runs here.
 */

const PATHS = [
  '/',
  '/learn',
  '/lessons',
  `/lessons/${LESSON_STAGE_IDS[0]}/1`,
  '/practice',
  `/practice/${PRACTICE_POSITIONS[0]!.id}`,
  '/computer',
  '/analysis',
  '/editor',
  '/coordinates',
  '/puzzles',
  '/puzzles/daily',
  '/streak',
  '/storm',
  '/explorer',
  '/games',
  '/study',
  '/tv',
  '/players',
  '/ranking',
  '/settings',
  '/account',
  '/login',
  '/signup',
  '/about',
  '/faq',
  '/contact',
  '/sites',
  '/terms',
  '/privacy',
  '/abcd1234',
  '/@/someone',
  '/nowhere',
];

// No server: every API call fails, as when the site cannot be reached; the screens show their empty or error state.
globalThis.fetch = async () => new Response(JSON.stringify({ error: 'x', code: 'notFound' }), { status: 404, headers: { 'content-type': 'application/json' } });
Object.assign(globalThis, { Worker: class { postMessage() {} terminate() {} addEventListener() {} removeEventListener() {} } });
Element.prototype.scrollIntoView = () => undefined;

const { h, render } = await import('preact');
const { App } = await import('../src/app.tsx');
const { navigate } = await import('../src/core/router.ts');
const { updatePrefs } = await import('../src/prefs/prefs.ts');

const root = document.createElement('div');
document.body.append(root);
render(h(App, null), root);

const settle = () => new Promise((resolve) => setTimeout(resolve, 200));

const check = async (path: string) => {
  navigate(path);
  await settle();
  const result = await axe.run(document, { rules: { 'color-contrast': { enabled: false } } });
  return {
    violations: result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 120)).join(' | ')}`),
    headings: document.querySelectorAll('h1').length,
  };
};

describe.each([true, false])('screens with the screen reader mode %s', (screenReader) => {
  it.each(PATHS)('%s', async (path) => {
    updatePrefs({ screenReader });
    expect(await check(path)).toEqual({ violations: [], headings: 1 });
  });
});

describe('a game against the computer', () => {
  it('is checked while it is played', async () => {
    updatePrefs({ screenReader: true });
    navigate('/computer');
    await settle();
    document.querySelector<HTMLButtonElement>('.ligungi-computer button[type="submit"], form button[type="submit"]')?.click();
    await settle();
    expect(document.querySelector('main.round')).not.toBeNull();
    expect(await check('/computer')).toEqual({ violations: [], headings: 1 });
  });
});
