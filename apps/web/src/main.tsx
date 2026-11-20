import './styles/fonts.css';
import './styles/site.scss';
import './styles/pages.scss';
import '@ligungi/board/gungiground.css';
import './styles/ligungi.scss';
import { render } from 'preact';
import { App } from './app.tsx';
import { watchIncoming } from './challenges.ts';
import { loadLanguage } from './i18n/index.ts';
import { prefs, resolveLang } from './prefs.ts';
import { loadSession } from './session.ts';
import { socket } from './socket.ts';

const root = document.getElementById('app')!;

Promise.all([loadSession().catch(() => undefined), loadLanguage(resolveLang(prefs.get().lang))])
  .catch(() => undefined)
  .finally(() => {
    watchIncoming();
    socket.connect();
    render(<App />, root);
  });
