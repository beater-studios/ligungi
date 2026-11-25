// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

// The SDK bundles its own copy of its runtime dependencies (zod among them) and installs zod only for its types; the
// root package.json overrides that zod with a release without the high severity advisory. This checks the SDK, as
// shipped, still talks to Discord: the READY handshake and the answer to a command.
describe('Discord Embedded App SDK with the zod override', () => {
  afterEach(() => vi.restoreAllMocks());

  it('becomes ready and gets an authorization code', async () => {
    window.history.replaceState(null, '', '/?frame_id=frame&instance_id=i-1&platform=desktop');
    const sent: unknown[] = [];
    vi.spyOn(window, 'postMessage').mockImplementation((message: unknown) => {
      sent.push(message);
    });
    const { DiscordSDK } = await import('@discord/embedded-app-sdk');
    const sdk = new DiscordSDK('123456789012345678', { disableConsoleLogOverride: true });
    expect(sdk.instanceId).toBe('i-1');

    const fromDiscord = (data: unknown) => window.dispatchEvent(new MessageEvent('message', { data, origin: window.location.origin }));
    const ready = sdk.ready();
    fromDiscord([1, { cmd: 'DISPATCH', evt: 'READY', nonce: 'ready', data: { v: 1, config: { cdn_host: 'cdn.discordapp.com', api_endpoint: '//discord.com/api', environment: 'production' } } }]);
    await ready;

    const authorized = sdk.commands.authorize({ client_id: '123456789012345678', response_type: 'code', state: '', prompt: 'none', scope: ['identify'] });
    await vi.waitFor(() => expect(sent.some((m) => Array.isArray(m) && (m[1] as { cmd?: string }).cmd === 'AUTHORIZE')).toBe(true));
    const request = sent.find((m) => Array.isArray(m) && (m[1] as { cmd?: string }).cmd === 'AUTHORIZE') as [number, { nonce: string }];
    fromDiscord([1, { cmd: 'AUTHORIZE', evt: null, nonce: request[1].nonce, data: { code: 'the-code' } }]);
    expect(await authorized).toEqual({ code: 'the-code' });
  });
});
