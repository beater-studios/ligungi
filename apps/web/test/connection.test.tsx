// @vitest-environment jsdom
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectionToast } from '../src/components/ConnectionToast.tsx';
import { online, watchConnection } from '../src/connection.ts';

afterEach(() => {
  vi.useRealTimers();
  online.set(true);
});

describe('connection', () => {
  it('follows the browser events and runs the callback when the connection returns', () => {
    const onBack = vi.fn();
    const stop = watchConnection(window, onBack);
    window.dispatchEvent(new Event('offline'));
    expect(online.get()).toBe(false);
    expect(onBack).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('online'));
    expect(online.get()).toBe(true);
    expect(onBack).toHaveBeenCalledTimes(1);
    stop();
    window.dispatchEvent(new Event('offline'));
    expect(online.get()).toBe(true);
  });

  it('shows a lasting notice while offline and a short one when back', () => {
    vi.useFakeTimers();
    const root = document.createElement('div');
    act(() => render(h(ConnectionToast, null), root));
    const region = root.querySelector('[role="status"]');
    expect(region?.textContent).toBe('');
    act(() => online.set(false));
    expect(region?.textContent).toMatch(/offline/i);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(region?.textContent).toMatch(/offline/i);
    act(() => online.set(true));
    expect(region?.textContent).toMatch(/back online/i);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(region?.textContent).toBe('');
    expect(root.querySelector('[role="status"]')).toBe(region);
  });
});
