// @vitest-environment jsdom
import { initialPosition, legalMoves, moveToString } from '@ligungi/engine';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeyboardMove } from '../../src/game/KeyboardMove.tsx';

const position = initialPosition('beginner');
const legal = legalMoves(position);

const mount = (props: { live?: boolean; legal?: typeof legal } = {}) => {
  const root = document.createElement('div');
  document.body.append(root);
  const onMove = vi.fn();
  const onLive = vi.fn();
  act(() => render(h(KeyboardMove, { position, legal: props.legal ?? legal, live: props.live ?? true, onMove, onLive }), root));
  const input = root.querySelector('input')!;
  const submit = (text: string) => {
    act(() => {
      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => {
      root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
  };
  const help = () => root.querySelector('#keyboard-move-help')!.textContent;
  return { root, input, onMove, onLive, submit, help };
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('typed moves', () => {
  it('plays the one move that matches, in words or in notation', () => {
    const { onMove, submit } = mount();
    submit('6-8 general');
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(moveToString(onMove.mock.calls[0]![0])).toBe('d1d2');
    submit('d1d2');
    expect(onMove).toHaveBeenCalledTimes(2);
  });

  it('explains what went wrong instead of playing', () => {
    const { onMove, submit, help } = mount();
    submit('hello');
    expect(help()).toMatch(/could not read/i);
    submit('5-5 general');
    expect(help()).toMatch(/no legal move/i);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('waits for the turn, and goes back to the current position from an earlier move', () => {
    const waiting = mount({ legal: [] });
    waiting.submit('6-8 general');
    expect(waiting.help()).toMatch(/wait for your turn/i);
    expect(waiting.onMove).not.toHaveBeenCalled();
    document.body.innerHTML = '';
    const past = mount({ live: false });
    past.submit('6-8 general');
    expect(past.onLive).toHaveBeenCalledTimes(1);
    expect(past.onMove).not.toHaveBeenCalled();
  });

  it('takes the typing anywhere on the page, but leaves z to the zen mode', () => {
    const { input } = mount();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
    });
    expect(document.activeElement).not.toBe(input);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '6' }));
    });
    expect(document.activeElement).toBe(input);
  });
});
