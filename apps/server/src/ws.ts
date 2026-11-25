import {
  ERROR_MESSAGES,
  parseClientMessage,
  type ErrorCode,
  type ClientMessage,
  type Topic,
} from '@ligungi/protocol';
import type { WebSocket } from 'ws';
import type { Player } from './games.ts';
import type { Client } from './hub.ts';
import type { AppDeps } from './app.ts';

/** Topics one socket may follow at once. */
const MAX_TOPICS_PER_CLIENT = 32;

/**
 * What happens on a WebSocket once its upgrade was accepted: topic subscriptions, game commands and race moves, and the
 * presence and lobby updates when it closes. `closing` is true while the server shuts down, when a closed socket changes
 * nothing.
 */
export const createSocketHandler = (deps: AppDeps, closing: () => boolean) => {
  const { games, hub, lobby, lobbyView, publishLobby, racers, seatsBlocked, sendIncoming, sendNotices, sendTurns, tvGames, updatePresence } = deps;

  const validTopic = (topic: unknown): topic is Topic =>
    typeof topic === 'string' && (topic === 'lobby' || topic === 'tv' || /^(game|challenge|race):[A-Za-z0-9]{1,16}$/.test(topic));

  const onConnection = (socket: WebSocket, player: Player) => {
    const client: Client = { socket, player, topics: new Set(), alive: true };
    hub.add(client);
    socket.on('pong', () => (client.alive = true));
    socket.on('message', (data) => {
      const message = parseClientMessage(data.toString());
      if (message) handleMessage(client, message);
    });
    socket.on('close', () => {
      if (closing()) return;
      const topics = hub.remove(client);
      for (const topic of topics) {
        if (topic.startsWith('game:')) {
          const room = games.get(topic.slice(5));
          if (room) updatePresence(room);
        }
      }
      if (!hub.hasSession(player.sessionId)) {
        lobby.removeSeeksOf(player.sessionId);
        lobby.cancelDirectedOf(player.sessionId);
      }
      publishLobby();
    });
    if (player.userId) {
      sendIncoming(player.userId);
      sendTurns(player.userId);
      sendNotices(player.userId);
    }
    publishLobby();
  };

  const handleMessage = (client: Client, message: ClientMessage) => {
    const error = (code: ErrorCode) => hub.send(client, { t: 'error', code, message: ERROR_MESSAGES[code] });
    switch (message.t) {
      case 'ping':
        hub.send(client, { t: 'pong' });
        return;
      case 'sub': {
        const topic = message.topic;
        if (!validTopic(topic)) return error('invalidTopic');
        if (!client.topics.has(topic) && client.topics.size >= MAX_TOPICS_PER_CLIENT) return error('tooManySubscriptions');
        const [kind, id] = topic.split(':') as [string, string | undefined];
        if (kind === 'lobby') {
          hub.subscribe(client, topic);
          hub.send(client, { t: 'lobby', lobby: lobbyView(client.player) });
        } else if (kind === 'tv') {
          hub.subscribe(client, topic);
          hub.send(client, { t: 'tv', games: tvGames() });
        } else if (kind === 'game' && id) {
          const room = games.get(id);
          if (!room) return error('gameNotFound');
          hub.subscribe(client, topic);
          updatePresence(room);
          hub.send(client, { t: 'game', game: room.view(client.player.sessionId, client.player.userId) });
        } else if (kind === 'race' && id) {
          const race = racers.view(id, client.player);
          if (!race) return error('raceNotFound');
          hub.subscribe(client, topic);
          hub.send(client, { t: 'race', race });
        } else if (kind === 'challenge' && id) {
          const challenge = lobby.challenge(id);
          if (!challenge) return error('challengeNotFound');
          hub.subscribe(client, topic);
          hub.send(client, { t: 'challenge', challenge: lobby.challengeView(challenge, client.player) });
        }
        return;
      }
      case 'unsub': {
        if (!validTopic(message.topic)) return;
        hub.unsubscribe(client, message.topic);
        if (message.topic.startsWith('game:')) {
          const room = games.get(message.topic.slice(5));
          if (room) updatePresence(room);
        }
        return;
      }
      case 'raceMove':
      case 'raceSkip': {
        if (typeof message.race !== 'string' || !Number.isInteger(message.puzzle)) return;
        // Late or stale moves (the race is over, or the player already moved on) are dropped: the next race view corrects the page.
        if (message.t === 'raceSkip') racers.skip(message.race, client.player, message.puzzle);
        else if (typeof message.move === 'string') racers.move(message.race, client.player, message.puzzle, message.move);
        return;
      }
      default: {
        if (typeof message.game !== 'string') return error('invalidGame');
        const room = games.get(message.game);
        if (!room) return error('gameNotFound');
        const color = room.colorOf(client.player.sessionId, client.player.userId);
        if (!color) return error('notAPlayer');
        let result: ErrorCode | null;
        if (message.t === 'move') {
          result = typeof message.move === 'string' && Number.isInteger(message.ply)
            ? room.move(color, message.move, message.ply)
            : 'invalidMove';
        } else if (message.t === 'resign') result = room.resign(color);
        else if (message.t === 'abort') result = room.abort(color);
        else if (message.t === 'claim') result = room.claim(color);
        else if (message.t === 'moretime') result = room.giveTime(color);
        else if (message.t === 'draw' || message.t === 'rematch' || message.t === 'takeback') {
          const action = message.action;
          if (action !== 'offer' && action !== 'accept' && action !== 'decline') result = 'invalidAction';
          else if (message.t === 'draw') result = room.draw(color, action);
          else if (message.t === 'takeback') result = room.takeback(color, action);
          else if (action !== 'decline' && seatsBlocked(room)) result = 'blockedPlayer';
          else result = room.rematch(color, action);
        } else result = 'unknownMessage';
        if (result) {
          error(result);
          hub.send(client, { t: 'game', game: room.view(client.player.sessionId, client.player.userId) });
        } else if (message.t === 'rematch' && room.rematchId) {
          const next = games.get(room.rematchId);
          if (next) for (const seat of Object.values(next.seats)) {
            hub.toSession(seat.sessionId, seat.userId, { t: 'redirect', path: `/${next.id}` });
          }
        }
      }
    }
  };

  return onConnection;
};
