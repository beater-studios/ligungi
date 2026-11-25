import './styles/fonts.css';
import './styles/site.scss';
import './styles/pages.scss';
import '@ligungi/board/gungiground.css';
import './styles/ligungi.scss';
import { render } from 'preact';
import { App } from './app.tsx';
import { watchIncoming } from './challenges.ts';
import { watchConnection } from './connection.ts';
import { loadPages } from './i18n/content/index.ts';
import { loadLanguage } from './i18n/index.ts';
import { registerServiceWorker, rememberOfflineLang } from './offline.ts';
import { prefs, resolveLang } from './prefs.ts';
import { loadSession, session } from './session.ts';
import { socket } from './socket.ts';

const root = document.getElementById('app')!;
const lang = resolveLang(prefs.get().lang);
// Opened without a connection (a page the service worker kept), the session is read again once the connection is back.
watchConnection(window, () => {
  socket.connect();
  void loadSession().catch(() => undefined);
});
if (import.meta.env.PROD) {
  registerServiceWorker();
  rememberOfflineLang(lang);
  prefs.subscribe(() => rememberOfflineLang(resolveLang(prefs.get().lang)));
}
// The long pages are loaded when first shown; the ones opened directly are waited for, like the language.
const longPage = /^\/(about|faq|contact|sites|terms|privacy|learn)$/.test(window.location.pathname);

// Without the server (offline) the page still opens, as signed out: the computer, the lessons and the analysis board
// need no account, and lesson stars go to the browser until the account is back.
const signedOut = () => {
  if (!session.get().loaded) session.set({ loaded: true, user: null, moderator: false });
};
Promise.all([loadSession().catch(signedOut), loadLanguage(lang), longPage ? loadPages(lang) : undefined])
  .catch(() => undefined)
  .finally(() => {
    watchIncoming();
    socket.connect();
    render(<App />, root);
  });
