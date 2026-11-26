/**
 * Ranks on the community Discord server for players who link their account: one role per player, named after a piece
 * (Gungi's pieces are military ranks), from their best established rating across the modes. A provisional rating gives
 * no rank, only the Verified player role of Discord's Linked Roles. Highest first.
 */
export const DISCORD_TIERS = [
  { id: 'general', kanji: '大', name: 'General', min: 2000 },
  { id: 'lieutenantGeneral', kanji: '中', name: 'Lieutenant General', min: 1800 },
  { id: 'majorGeneral', kanji: '小', name: 'Major General', min: 1650 },
  { id: 'samurai', kanji: '侍', name: 'Samurai', min: 1500 },
  { id: 'soldier', kanji: '兵', name: 'Soldier', min: null },
] as const satisfies ReadonlyArray<{ readonly id: string; readonly kanji: string; readonly name: string; readonly min: number | null }>;

export type DiscordTier = (typeof DISCORD_TIERS)[number]['id'];

/** The Linked Roles role on the Discord server, for linked players whose ratings are all still provisional. */
export const DISCORD_VERIFIED_ROLE = 'Verified player';

/** The rank for a best established rating, or null while every rating of the player is provisional. */
export const discordTier = (rating: number | null): DiscordTier | null => {
  if (rating === null) return null;
  return DISCORD_TIERS.find((tier) => tier.min === null || Math.round(rating) >= tier.min)!.id;
};

/** What the account page shows about the Discord link. */
export interface DiscordLinkView {
  /** The site runs with the Discord settings; without them there is nothing to link. */
  readonly enabled: boolean;
  readonly link: {
    readonly discordName: string;
    readonly tier: DiscordTier | null;
    /** The player left the Discord server: nothing is sent until they come back and check again. */
    readonly paused: boolean;
    readonly linkedAt: number;
  } | null;
}

/** Results of the Discord sign-in, sent back to the account page as `?discord=<result>`. */
export const DISCORD_LINK_RESULTS = ['linked', 'denied', 'failed', 'taken', 'disabled'] as const;
export type DiscordLinkResult = (typeof DISCORD_LINK_RESULTS)[number];
