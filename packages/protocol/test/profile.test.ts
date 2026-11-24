import { describe, expect, it } from 'vitest';
import { PROFILE_BIO_MAX, parseProfileDetails, profileLinkName, profileLinkUrl } from '../src/index.ts';

describe('profile details', () => {
  it('takes only the name on each site, forgiving pasted addresses, and builds the address itself', () => {
    expect(profileLinkName('youtube', '@gon')).toBe('gon');
    expect(profileLinkName('youtube', 'https://www.youtube.com/@gon/')).toBe('gon');
    const started = performance.now();
    expect(profileLinkName('youtube', `gon${'/'.repeat(50_000)}`)).toBe('gon');
    expect(profileLinkName('youtube', `${'/'.repeat(50_000)}x`)).toBeNull();
    expect(performance.now() - started).toBeLessThan(1000);
    expect(profileLinkName('lichess', 'lichess.org/@/Killua_Z')).toBe('Killua_Z');
    expect(profileLinkName('bluesky', 'gon.bsky.social')).toBe('gon.bsky.social');
    expect(profileLinkUrl('lishogi', 'Killua')).toBe('https://lishogi.org/@/Killua');
    expect(profileLinkUrl('tiktok', 'gon')).toBe('https://tiktok.com/@gon');
    expect(profileLinkUrl('libaduk', 'Killua')).toBe('https://libaduk.com/profile/Killua');
    expect(profileLinkName('libaduk', 'https://libaduk.com/profile/Killua')).toBe('Killua');
    // Another site's address, a path or a query never gets through as a name.
    expect(profileLinkName('youtube', 'https://evil.example/@gon')).toBeNull();
    expect(profileLinkName('x', 'gon/status/1')).toBeNull();
    expect(profileLinkName('instagram', 'gon?next=evil')).toBeNull();
    expect(profileLinkName('lichess', '-gon')).toBeNull();
  });

  it('validates what a player saves', () => {
    const valid = { bio: '  Gungi\r\n\r\n\r\nfan  ', country: 'br', links: { youtube: '@gon', lichess: '', x: 'https://x.com/gon' } };
    expect(parseProfileDetails(valid)).toEqual({ bio: 'Gungi\n\nfan', country: 'br', links: { youtube: 'gon', x: 'gon' } });
    expect(parseProfileDetails({ ...valid, country: null })).toMatchObject({ country: null });
    expect(parseProfileDetails({ ...valid, country: 'zz' })).toBe('invalidCountry');
    expect(parseProfileDetails({ ...valid, bio: 'a'.repeat(PROFILE_BIO_MAX + 1) })).toBe('bioTooLong');
    expect(parseProfileDetails({ ...valid, bio: '帥'.repeat(PROFILE_BIO_MAX) })).toMatchObject({ bio: '帥'.repeat(PROFILE_BIO_MAX) });
    expect(parseProfileDetails({ ...valid, links: { myspace: 'gon' } })).toBe('invalidProfileLink');
    expect(parseProfileDetails({ ...valid, links: { toString: 'gon' } })).toBe('invalidProfileLink');
    expect(parseProfileDetails({ ...valid, links: { twitch: 'g' } })).toBe('invalidProfileLink');
    expect(parseProfileDetails({ ...valid, links: { github: 42 } })).toBe('invalidProfileLink');
    expect(parseProfileDetails({ bio: 1, country: null, links: {} })).toBe('invalidProfile');
  });
});
