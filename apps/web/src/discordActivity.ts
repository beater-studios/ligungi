import type { DiscordSDK } from '@discord/embedded-app-sdk';
import { MODES, type Mode } from '@ligungi/engine';
import type { ActivityHallView, ColorChoice, TimeControl, UserRef } from '@ligungi/protocol';
import { ACTIVITY_PREFIX } from './activity.ts';
import { api } from './api.ts';
import { getT } from './i18n/index.ts';
import { SITE_URL } from './source.ts';
import { createStore } from './store.ts';

const LAUNCH_KEY = 'ligungi.activity';

/**
 * Discord's launch parameters (`frame_id`, `instance_id`, `platform`), read on the first load and kept for reloads:
 * the site's own navigation drops them from the address, and the SDK needs them.
 */
const readLaunch = (): string | null => {
  if (typeof window === 'undefined' || !window.location?.hostname?.endsWith('.discordsays.com')) return null;
  const search = window.location.search;
  try {
    if (new URLSearchParams(search).has('frame_id')) sessionStorage.setItem(LAUNCH_KEY, search);
    else return sessionStorage.getItem(LAUNCH_KEY);
  } catch {
    // Without storage a reload inside Discord loses the parameters, and the page opens as the plain site.
  }
  return new URLSearchParams(search).has('frame_id') ? search : null;
};

const launch = readLaunch();

/** Whether the site runs as the Discord Activity, inside a voice call. */
export const inActivity = launch !== null;

/** Why a Discord account plays as a guest. */
export type GuestReason = 'unlinked' | 'suspended' | 'twoFactor';

export type ActivityState =
  | { readonly status: 'off' | 'starting' | 'failed' }
  | { readonly status: 'ready'; readonly instanceId: string; readonly reason: GuestReason | null };

export const activity = createStore<ActivityState>({ status: inActivity ? 'starting' : 'off' });

/** Someone in the call, as Discord shows them. */
export interface CallPerson {
  readonly id: string;
  readonly name: string;
  /** Discord's avatar address, or `null` for one without a picture. */
  readonly avatar: string | null;
}

/** Who is in the Activity right now, in the order Discord gives. */
export const callPeople = createStore<readonly CallPerson[]>([]);

const TAB_KEY = 'ligungi.activityTab';

/** Which side the home page shows inside Discord: the call's rooms, or the site's own lobby. */
export type ActivityTab = 'call' | 'site';

const readTab = (): ActivityTab => {
  try {
    return sessionStorage.getItem(TAB_KEY) === 'site' ? 'site' : 'call';
  } catch {
    return 'call';
  }
};

export const activityTab = createStore<ActivityTab>(inActivity ? readTab() : 'call');

export const setActivityTab = (tab: ActivityTab): void => {
  activityTab.set(tab);
  try {
    sessionStorage.setItem(TAB_KEY, tab);
  } catch {
    // The choice then lasts only until the next reload.
  }
};

let sdk: DiscordSDK | null = null;

/** Opens an address outside the Activity in the player's browser: Discord's frame cannot navigate away. */
export const openExternal = (url: string): void => {
  void sdk?.commands.openExternalLink({ url }).catch(() => undefined);
};

const watchExternalLinks = () =>
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    const anchor = (event.target as HTMLElement | null)?.closest('a');
    if (!anchor?.href) return;
    const url = new URL(anchor.href, window.location.href);
    if (url.origin === window.location.origin && !url.pathname.startsWith('/api/') && !anchor.target) return;
    event.preventDefault();
    openExternal(url.origin === window.location.origin ? `${SITE_URL}${url.pathname}${url.search}` : url.href);
  });

/** What the page says the player is doing, from the `data-activity-*` attributes the pages set for PreMiD. */
const pageActivity = (): Readonly<Record<string, string>> =>
  Object.fromEntries(
    [...document.documentElement.attributes].filter((a) => a.name.startsWith(ACTIVITY_PREFIX)).map((a) => [a.name.slice(ACTIVITY_PREFIX.length), a.value]),
  );

export const presenceOf = (page: Readonly<Record<string, string>>): { details?: string; state: string } => {
  const t = getT();
  const p = t.discordActivity.presence;
  const mode = MODES.find((m) => m === page.mode);
  if (page.kind === 'game' && mode) {
    return { details: t.modes[mode], state: page.status !== 'started' ? p.reviewing : page.role === 'player' ? p.playing : p.watching };
  }
  const level = Number(page.level);
  if (page.kind === 'computer' && mode) return { details: t.modes[mode], state: level ? t.computer.bot(level) : p.playing };
  return { state: p.browsing };
};

/**
 * Keeps the player's Discord status in step with the page, as PreMiD does outside Discord: the mode, and whether they
 * play, watch or review. Sent only when it changes, since Discord limits how often it may be set.
 */
const watchPresence = (client: DiscordSDK) => {
  let last = '';
  let place = '';
  let start = Date.now();
  const update = () => {
    const page = pageActivity();
    const presence = presenceOf(page);
    // The time shown restarts with each game; outside games the whole visit counts as one.
    const here = page.kind ? `${page.kind}:${window.location.pathname}` : 'site';
    if (here !== place) {
      place = here;
      start = Date.now();
    }
    const key = JSON.stringify([presence, start]);
    if (key === last) return;
    last = key;
    const activity = { type: 0, ...presence, assets: { large_image: 'ligungi', large_text: new URL(SITE_URL).host }, timestamps: { start } };
    void client.commands.setActivity({ activity }).catch(() => undefined);
  };
  new MutationObserver(update).observe(document.documentElement, { attributes: true });
  update();
};

type Participant = Awaited<ReturnType<DiscordSDK['commands']['getInstanceConnectedParticipants']>>['participants'][number];

const personOf = (p: Participant): CallPerson => ({
  id: p.id,
  name: p.nickname || p.global_name || p.username,
  avatar: p.avatar ? `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.png?size=64` : null,
});

/** Keeps the list of people in the Activity up to date. */
const watchPeople = async (client: DiscordSDK) => {
  try {
    const { participants } = await client.commands.getInstanceConnectedParticipants();
    callPeople.set(participants.map(personOf));
    await client.subscribe('ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE', ({ participants }) => callPeople.set(participants.map(personOf)));
  } catch {
    // Without the list the hub still works; it just does not show who is there.
  }
};

/** Opens Discord's own dialog to invite more people into the Activity. */
export const inviteToCall = (): void => {
  void sdk?.commands.openInviteDialog().catch(() => undefined);
};

/**
 * Connects to Discord and signs the player in: with their ligungi account when it is linked to this Discord account,
 * else as a guest. Resolves once the session cookie is set, so the session can be loaded after it.
 */
export const startActivity = async (): Promise<void> => {
  if (!launch) return;
  try {
    const [{ clientId }, { DiscordSDK }] = await Promise.all([
      api.get<{ clientId: string }>('/api/activity/config'),
      import('@discord/embedded-app-sdk'),
    ]);
    class LaunchedSDK extends DiscordSDK {
      override _getSearch(): string {
        return launch ?? '';
      }
    }
    const client = new LaunchedSDK(clientId, { disableConsoleLogOverride: true });
    sdk = client;
    watchExternalLinks();
    await client.ready();
    const { code } = await client.commands.authorize({ client_id: clientId, response_type: 'code', state: '', prompt: 'none', scope: ['identify', 'rpc.activities.write'] });
    const signed = await api.post<{ user: UserRef | null; reason: GuestReason | null; accessToken: string }>('/api/activity/session', { code });
    await client.commands.authenticate({ access_token: signed.accessToken });
    activity.set({ status: 'ready', instanceId: client.instanceId, reason: signed.reason });
    watchPresence(client);
    void watchPeople(client);
  } catch {
    activity.set({ status: 'failed' });
  }
};

const instanceId = (): string => {
  const state = activity.get();
  if (state.status !== 'ready') throw new Error('activity not ready');
  return state.instanceId;
};

/** The call's rooms waiting for a second player, and its games in progress. */
export const callRooms = (): Promise<ActivityHallView> =>
  api.get<ActivityHallView>(`/api/activity/rooms?instanceId=${encodeURIComponent(instanceId())}`);

/** What a new room in the call is played with. */
export interface RoomSettings {
  readonly mode: Mode;
  readonly timeControl: TimeControl;
  readonly color: ColorChoice;
}

/** Opens a room in the call, closing the one the player had open there. */
export const openRoom = (settings: RoomSettings): Promise<{ challengeId: string }> =>
  api.post<{ challengeId: string }>('/api/activity/rooms', { instanceId: instanceId(), ...settings });

/** Joins a room of the call; the server then sends both players to the game. */
export const joinRoom = (challengeId: string): Promise<{ gameId: string }> =>
  api.post<{ gameId: string }>(`/api/activity/rooms/${encodeURIComponent(challengeId)}/join`, { instanceId: instanceId() });

export const closeRoom = (challengeId: string): Promise<unknown> => api.delete(`/api/challenges/${encodeURIComponent(challengeId)}`);
