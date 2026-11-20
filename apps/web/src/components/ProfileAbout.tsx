import { PROFILE_LINKS, PROFILE_SITES, profileLinkUrl, type ProfileDetails, type ProfileSite } from '@ligungi/protocol';
import type { ComponentChildren } from 'preact';
import { useT } from '../i18n/index.ts';
import { SITE_NAMES, SOCIAL_ICONS } from '../profileSites.ts';

/**
 * The other game sites are shown by the game they are for, not by their logo: the project does not use the lichess
 * logo, and the others' logos have no clear license. Drawn for ligungi (AGPL), in the text color like the social logos.
 */
const GAME_ICONS = {
  // A chess knight.
  lichess: <path d="M7 21h11v-2.2H7zM8.2 17.6h8.6l-.9-4.1c1.8-1 2.9-2.9 2.9-5.4C18.8 4.9 16 3 12.8 3l-2.4.2-.9 1.9-3.3 3.3.7 2.1 2.1-.8 1.2.9-2.6 3.6z" />,
  // A shogi piece.
  lishogi: <path d="M12 2l6.5 3 2 17h-17l2-17z" />,
  // A draughts man, with its rings.
  lidraughts: <path fill-rule="evenodd" d="M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19zm0 3a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />,
  // A black and a white go stone.
  libaduk: (
    <>
      <circle cx="6.8" cy="12" r="5.6" />
      <circle cx="17.4" cy="12" r="4.9" fill="none" stroke="currentColor" stroke-width="1.4" />
    </>
  ),
};

const SOCIAL: Partial<Record<ProfileSite, string>> = SOCIAL_ICONS;
const GAMES: Partial<Record<ProfileSite, ComponentChildren>> = GAME_ICONS;

/** The logo of a social network, or the game of another game site. */
export const SiteIcon = ({ site }: { site: ProfileSite }) => {
  const path = SOCIAL[site];
  return (
    <svg class="ligungi-site-icon" viewBox="0 0 24 24" aria-hidden="true">
      {path ? <path d={path} /> : GAMES[site]}
    </svg>
  );
};

const LinkList = ({ title, sites, links }: { title: string; sites: readonly ProfileSite[]; links: ProfileDetails['links'] }) => (
  <div class="ligungi-profile-about__links">
    <h2>{title}</h2>
    <ul>
      {sites.map((site) => {
        const name = links[site]!;
        return (
          <li key={site}>
            <a href={profileLinkUrl(site, name)} target="_blank" rel="nofollow ugc noopener noreferrer">
              <SiteIcon site={site} />
              <span class="ligungi-profile-about__site">{SITE_NAMES[site]}</span>
              <span class="ligungi-profile-about__name">{name}</span>
            </a>
          </li>
        );
      })}
    </ul>
  </div>
);

/** What the player tells about themselves: the bio, their social networks and their profiles on other game sites. */
export const ProfileAbout = ({ details }: { details: ProfileDetails }) => {
  const t = useT();
  const linked = PROFILE_SITES.filter((site) => details.links[site]);
  const social = linked.filter((site) => PROFILE_LINKS[site].group === 'social');
  const games = linked.filter((site) => PROFILE_LINKS[site].group === 'games');
  if (!details.bio && linked.length === 0) return null;
  return (
    <section class="ligungi-card ligungi-profile-about" aria-label={t.profile.aboutLabel}>
      {details.bio && <p class="ligungi-profile-about__bio">{details.bio}</p>}
      {social.length > 0 && <LinkList title={t.profile.socialTitle} sites={social} links={details.links} />}
      {games.length > 0 && <LinkList title={t.profile.otherGamesTitle} sites={games} links={details.links} />}
    </section>
  );
};
