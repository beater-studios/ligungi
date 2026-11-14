import { PROFILE_LINKS, PROFILE_SITES, profileLinkUrl, type ProfileDetails, type ProfileSite } from '@ligungi/protocol';
import { useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { SITE_NAMES, SOCIAL_ICONS } from '../profileSites.ts';

/** The logo of a social network, or a plain link mark for the other game sites (shown without logos). */
export const SiteIcon = ({ site }: { site: ProfileSite }) =>
  site in SOCIAL_ICONS ? (
    <svg class="ligungi-site-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={SOCIAL_ICONS[site as keyof typeof SOCIAL_ICONS]} />
    </svg>
  ) : (
    <span class="ligungi-site-icon" data-icon={icons.Link} aria-hidden="true" />
  );

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
