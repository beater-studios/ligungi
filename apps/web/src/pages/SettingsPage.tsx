import { MESSAGES, themeLabel, useT } from '../i18n/index.ts';
import { BOARD_SIZES, LANGS, THEMES, prefs, updatePrefs, type Prefs } from '../prefs.ts';
import { playSound } from '../sound.ts';
import { useStore } from '../store.ts';
import { RadioGroup } from '../components/ui.tsx';
import { SettingsMenu } from './AccountPage.tsx';

export const SettingsPage = () => {
  const t = useT();
  const s = t.settings;
  const current = useStore(prefs);
  const radio = <K extends keyof Prefs>(key: K, options: Array<[Prefs[K], string]>) => (
    <RadioGroup
      name={`pref-${key}`}
      value={current[key]}
      options={options.map(([value, label]) => ({ value, label }))}
      onChange={(value) => updatePrefs({ [key]: value } as Partial<Prefs>)}
    />
  );
  return (
    <main class="account page-menu">
      <SettingsMenu active="settings" />
      <div class="page-menu__content box box-pad">
        <h1 class="box__top">{s.title}</h1>
        <form class="form3" onSubmit={(e) => e.preventDefault()}>
          <section>
            <h2>{s.language}</h2>
            {radio('lang', [['auto', s.auto], ...LANGS.map((lang): [Prefs['lang'], string] => [lang, MESSAGES[lang].languageName])])}
          </section>
          <section>
            <h2>{s.pieceNames}</h2>
            {radio('pieceNames', [
              ['local', s.pieceNamesLocal],
              ['ja', s.pieceNamesJapanese],
            ])}
          </section>
          <section>
            <h2>{s.theme}</h2>
            {radio('theme', THEMES.map((theme) => [theme, themeLabel(t, theme)]))}
          </section>
          <section>
            <h2>{s.boardSize}</h2>
            {radio('zoom', [
              [BOARD_SIZES[0], s.sizeSmall],
              [BOARD_SIZES[1], s.sizeMedium],
              [BOARD_SIZES[2], s.sizeLarge],
              [BOARD_SIZES[3], s.sizeMax],
            ])}
          </section>
          <section>
            <h2>{s.sound}</h2>
            {radio('sound', [
              [true, s.on],
              [false, s.off],
            ])}
            <button type="button" class="button button-empty" onClick={() => playSound('move')}>
              {s.test}
            </button>
          </section>
          <section>
            <h2>{s.coordinates}</h2>
            {radio('coordinates', [
              [true, s.show],
              [false, s.hide],
            ])}
          </section>
          <section>
            <h2>{s.hoverReach}</h2>
            {radio('hoverReach', [
              [true, s.show],
              [false, s.dontShow],
            ])}
            <small class="form-help">{s.hoverReachHelp}</small>
          </section>
          <section>
            <h2>{s.animation}</h2>
            {radio('animation', [
              [true, s.animationOn],
              [false, s.animationOff],
            ])}
          </section>
        </form>
        <p class="ligungi-notice">{s.saved}</p>
      </div>
    </main>
  );
};
