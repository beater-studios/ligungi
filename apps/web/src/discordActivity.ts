import type { DiscordSDK } from '@discord/embedded-app-sdk';
import type { UserRef } from '@ligungi/protocol';
import { api } from './api.ts';
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
    const { code } = await client.commands.authorize({ client_id: clientId, response_type: 'code', state: '', prompt: 'none', scope: ['identify'] });
    const signed = await api.post<{ user: UserRef | null; reason: GuestReason | null; accessToken: string }>('/api/activity/session', { code });
    await client.commands.authenticate({ access_token: signed.accessToken });
    activity.set({ status: 'ready', instanceId: client.instanceId, reason: signed.reason });
  } catch {
    activity.set({ status: 'failed' });
  }
};

/** Where "play with this call" sends the player: the call's open challenge or its game. */
export const playWithCall = async (mode: string): Promise<string> => {
  const state = activity.get();
  if (state.status !== 'ready') throw new Error('activity not ready');
  const turn = await api.post<{ challengeId: string } | { gameId: string }>('/api/activity/play', { instanceId: state.instanceId, mode });
  return 'gameId' in turn ? `/${turn.gameId}` : `/challenge/${turn.challengeId}`;
};
