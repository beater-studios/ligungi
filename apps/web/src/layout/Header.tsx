import { useEffect, useRef, useState } from 'preact/hooks';
import { useT } from '../i18n/index.ts';
import logoUrl from '../assets/logo.svg';
import { icons } from '../icons.ts';
import { ActivitySwitch } from '../discord/Hub.tsx';
import { inActivity } from '../discord/activity.ts';
import { ChallengeBell } from './ChallengeBell.tsx';
import { HeaderSearch } from './HeaderSearch.tsx';
import { Dasher } from './Dasher.tsx';
import { useLocation } from '../core/router.ts';
import { session } from '../core/session.ts';
import { socket } from '../core/socket.ts';
import { useStore } from '../core/store.ts';

export const Header = () => {
  const t = useT();
  const { user } = useStore(session);
  const status = useStore(socket.status);
  const toggle = useRef<HTMLInputElement>(null);
  const { path } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (toggle.current) toggle.current.checked = false;
  }, [path]);
  // lila's sticky header only gets a background with this class, which its own scripts set while the page is scrolled.
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 0);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  return (
    <header id="top" class={scrolled ? 'scrolled' : undefined}>
      <div class="site-title-nav">
        <input type="checkbox" id="tn-tg" class="topnav-toggle fullscreen-toggle" autocomplete="off" aria-label={t.nav.navigation} ref={toggle} />
        <label for="tn-tg" class="fullscreen-mask" />
        <label for="tn-tg" class="hbg">
          <span class="hbg__in" />
        </label>
        <a class="site-title" href="/">
          <img class="site-icon ligungi-logo" src={logoUrl} alt="" width="32" height="32" />
          <div class="site-name">
            ligungi<span>.org</span>
          </div>
        </a>
        {inActivity && <ActivitySwitch />}
        <nav id="topnav" class="hover" aria-label={t.nav.navigation}>
          <section>
            <a href="/">
              <span class="play">{t.nav.play}</span>
              <span class="home">ligungi.org</span>
            </a>
            <div role="group">
              <a href="/?create=lobby">{t.nav.createGame}</a>
              <a href="/?create=friend">{t.nav.playFriend}</a>
              <a href="/computer">{t.nav.playComputer}</a>
            </div>
          </section>
          <section>
            <a href="/puzzles">{t.nav.puzzles}</a>
            <div role="group">
              <a href="/puzzles">{t.nav.puzzles}</a>
              <a href="/puzzles/daily">{t.nav.puzzleDaily}</a>
              <a href="/streak">{t.nav.streak}</a>
              <a href="/storm">{t.nav.storm}</a>
              <a href="/racer">{t.nav.racer}</a>
              <a href="/puzzles/dashboard">{t.nav.puzzleDashboard}</a>
            </div>
          </section>
          <section>
            <a href="/learn">{t.nav.learn}</a>
            <div role="group">
              <a href="/learn">{t.nav.rules}</a>
              <a href="/lessons">{t.nav.lessons}</a>
              <a href="/practice">{t.nav.practice}</a>
              <a href="/study">{t.nav.studies}</a>
              <a href="/coordinates">{t.nav.coordinates}</a>
            </div>
          </section>
          <section>
            <a href="/players">{t.nav.community}</a>
            <div role="group">
              <a href="/players">{t.nav.playerList}</a>
              <a href="/ranking">{t.nav.players}</a>
              <a href="/friends">{t.nav.friends}</a>
            </div>
          </section>
          <section>
            <a href="/tv">{t.nav.watch}</a>
            <div role="group">
              <a href="/tv">{t.nav.liveGames}</a>
            </div>
          </section>
          <section>
            <a href="/analysis">{t.nav.tools}</a>
            <div role="group">
              <a href="/analysis">{t.nav.analysis}</a>
              <a href="/editor">{t.nav.editor}</a>
              <a href="/analysis?import">{t.nav.importGame}</a>
              <a href="/explorer">{t.nav.explorer}</a>
              <a href="/games">{t.nav.gameSearch}</a>
            </div>
          </section>
        </nav>
      </div>
      <div class="site-buttons">
        {status !== 'open' && (
          <span class="link ligungi-reconnecting" title={t.nav.reconnecting} data-icon={icons.ChasingArrows} />
        )}
        <HeaderSearch />
        {user && <ChallengeBell />}
        {!user && (
          <div class="signin-or-signup">
            <a href="/login" class="button button-empty signin">
              {t.nav.signIn}
            </a>
            <a href="/signup" class="button signup">
              {t.nav.signUp}
            </a>
          </div>
        )}
        <Dasher />
      </div>
    </header>
  );
};
