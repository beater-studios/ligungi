import type { ClientMessage, ServerMessage, Topic } from '@ligungi/protocol';
import { createStore } from './store.ts';

export type SocketStatus = 'connecting' | 'open' | 'closed';

/** Single WebSocket for the whole app, with reconnection and topic subscriptions. */
class Socket {
  readonly status = createStore<SocketStatus>('closed');
  #ws: WebSocket | null = null;
  readonly #topics = new Map<Topic, number>();
  readonly #listeners = new Set<(message: ServerMessage) => void>();
  #retry = 0;
  #ping: ReturnType<typeof setInterval> | null = null;

  connect(): void {
    if (this.#ws) return;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);
    this.#ws = ws;
    this.status.set('connecting');
    ws.onopen = () => {
      this.#retry = 0;
      this.status.set('open');
      for (const topic of this.#topics.keys()) this.#raw({ t: 'sub', topic });
      this.#ping = setInterval(() => this.#raw({ t: 'ping' }), 25_000);
    };
    ws.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as ServerMessage;
      for (const listener of this.#listeners) listener(message);
    };
    ws.onclose = () => {
      if (this.#ping) clearInterval(this.#ping);
      this.#ws = null;
      this.status.set('closed');
      const delay = Math.min(5000, 500 * 2 ** this.#retry++);
      setTimeout(() => this.connect(), delay);
    };
  }

  /** Reconnects so the server sees a new session cookie after login or logout. */
  reset(): void {
    this.#ws?.close();
  }

  subscribe(topic: Topic): () => void {
    const count = this.#topics.get(topic) ?? 0;
    this.#topics.set(topic, count + 1);
    if (count === 0) this.#raw({ t: 'sub', topic });
    return () => {
      const current = this.#topics.get(topic) ?? 0;
      if (current <= 1) {
        this.#topics.delete(topic);
        this.#raw({ t: 'unsub', topic });
      } else this.#topics.set(topic, current - 1);
    };
  }

  on(listener: (message: ServerMessage) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  send(message: ClientMessage): boolean {
    return this.#raw(message);
  }

  #raw(message: ClientMessage): boolean {
    if (this.#ws?.readyState !== WebSocket.OPEN) return false;
    this.#ws.send(JSON.stringify(message));
    return true;
  }
}

export const socket = new Socket();
