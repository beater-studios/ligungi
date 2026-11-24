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
import { loadSession } from './session.ts';
import { socket } from './socket.ts';

const root = document.getElementById('app')!;
const lang = resolveLang(prefs.get().lang);
watchConnection(window, () => socket.connect());
if (import.meta.env.PROD) {
  registerServiceWorker();
  rememberOfflineLang(lang);
  prefs.subscribe(() => rememberOfflineLang(resolveLang(prefs.get().lang)));
}
// The long pages are loaded when first shown; the ones opened directly are waited for, like the language.
const longPage = /^\/(about|faq|contact|sites|terms|privacy|learn)$/.test(window.location.pathname);

Promise.all([loadSession().catch(() => undefined), loadLanguage(lang), longPage ? loadPages(lang) : undefined])
  .catch(() => undefined)
  .finally(() => {
    watchIncoming();
    socket.connect();
    render(<App />, root);
  });
