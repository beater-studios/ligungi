import type { ServerMessage, Topic } from '@ligungi/protocol';
import type { WebSocket } from 'ws';
import type { Player } from './games.ts';

export interface Client {
  readonly socket: WebSocket;
  readonly player: Player;
  readonly topics: Set<Topic>;
  alive: boolean;
}

/** Topic-based fan-out over WebSocket clients. */
export class Hub {
  readonly #clients = new Set<Client>();
  readonly #topics = new Map<Topic, Set<Client>>();

  add(client: Client): void {
    this.#clients.add(client);
  }

  /** Removes the client and returns the topics it was subscribed to. */
  remove(client: Client): Topic[] {
    this.#clients.delete(client);
    const topics = [...client.topics];
    for (const topic of topics) this.unsubscribe(client, topic);
    return topics;
  }

  subscribe(client: Client, topic: Topic): void {
    client.topics.add(topic);
    let set = this.#topics.get(topic);
    if (!set) this.#topics.set(topic, (set = new Set()));
    set.add(client);
  }

  unsubscribe(client: Client, topic: Topic): void {
    client.topics.delete(topic);
    const set = this.#topics.get(topic);
    set?.delete(client);
    if (set?.size === 0) this.#topics.delete(topic);
  }

  subscribers(topic: Topic): Client[] {
    return [...(this.#topics.get(topic) ?? [])];
  }

  clients(): Client[] {
    return [...this.#clients];
  }

  hasSession(sessionId: string): boolean {
    return this.clients().some((client) => client.player.sessionId === sessionId);
  }

  /** Distinct sessions connected right now. */
  onlineCount(): number {
    return new Set(this.clients().map((client) => client.player.sessionId)).size;
  }

  send(client: Client, message: ServerMessage): void {
    if (client.socket.readyState === client.socket.OPEN) client.socket.send(JSON.stringify(message));
  }

  publish(topic: Topic, build: (client: Client) => ServerMessage): void {
    for (const client of this.subscribers(topic)) this.send(client, build(client));
  }

  toSession(sessionId: string, userId: string | null, message: ServerMessage): void {
    for (const client of this.#clients) {
      const { player } = client;
      if (player.sessionId === sessionId || (userId !== null && player.userId === userId)) this.send(client, message);
    }
  }
}
