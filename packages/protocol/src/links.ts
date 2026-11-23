/** The invite to the community Discord server (see docs/community/discord.md). */
export const DISCORD_INVITE = 'https://discord.gg/RgtNN7yXU5';

/**
 * The address the site and its documents link to, never the raw invite: it redirects to the same invite as `/discord`
 * below, so a new invite never breaks a link already copied or posted.
 */
export const DISCORD_LINK = 'https://discord.ligungi.org';

/**
 * Short addresses of the site that redirect elsewhere, to share outside it (`ligungi.org/discord`). The redirect is
 * temporary, so browsers do not keep the target and a new invite takes effect at once.
 */
export const SHORT_LINKS: Readonly<Record<string, string>> = { '/discord': DISCORD_INVITE };
