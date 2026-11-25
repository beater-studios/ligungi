import { useT } from '../i18n/index.ts';

/** The community tabs shared by the players, ranking and friends pages. */
export const CommunityNav = ({ active }: { active: 'players' | 'ranking' | 'friends' }) => {
  const t = useT();
  const link = (key: typeof active, href: string, label: string) => (
    <a class={active === key ? 'active' : ''} href={href} aria-current={active === key ? 'page' : undefined}>
      {label}
    </a>
  );
  return (
    <nav class="ligungi-segmented ligungi-community-nav" aria-label={t.nav.community}>
      {link('players', '/players', t.nav.playerList)}
      {link('ranking', '/ranking', t.nav.players)}
      {link('friends', '/friends', t.nav.friends)}
    </nav>
  );
};
