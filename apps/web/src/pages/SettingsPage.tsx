import type { ComponentChildren } from 'preact';
import { MoveListPreview } from '../components/MoveListPreview.tsx';
import { PiecePreview } from '../components/PiecePreview.tsx';
import { RadioGroup, SettingRow, Toggle } from '../components/ui.tsx';
import { MESSAGES, themeLabel, useT } from '../i18n/index.ts';
import { BOARD_SIZES, BOARD_THEMES, LANGS, THEMES, prefs, updatePrefs, type Prefs } from '../prefs.ts';
import { playSound } from '../sound.ts';
import { useStore } from '../store.ts';
import { SettingsMenu } from './AccountPage.tsx';

/** A titled group of settings; with a preview, the rows sit on the left and the preview on the right. */
const Group = ({ title, help, preview, children }: { title: string; help?: string; preview?: ComponentChildren; children: ComponentChildren }) => (
  <section class={`ligungi-prefs-group${preview ? ' ligungi-prefs-group--preview' : ''}`}>
    <h2>{title}</h2>
    {help && <p class="ligungi-prefs-group__help">{help}</p>}
    <div class="ligungi-prefs-group__body">
      <div class="ligungi-prefs-group__rows">{children}</div>
      {preview && <div class="ligungi-prefs-group__preview">{preview}</div>}
    </div>
  </section>
);

type BooleanPref = { [K in keyof Prefs]: Prefs[K] extends boolean ? K : never }[keyof Prefs];

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
  const toggle = (key: BooleanPref, title: string, help?: string) => (
    <SettingRow title={title} htmlFor={`pref-${key}`} {...(help ? { help } : {})}>
      <Toggle id={`pref-${key}`} checked={current[key]} label={title} onChange={(value) => updatePrefs({ [key]: value })} />
    </SettingRow>
  );

  return (
    <main class="account page-menu">
      <SettingsMenu active="settings" />
      <div class="page-menu__content box box-pad">
        <h1 class="box__top">{s.title}</h1>
        <form class="form3 ligungi-prefs" onSubmit={(e) => e.preventDefault()}>
          <Group title={s.groupGeneral}>
            <SettingRow title={s.language} stacked>
              {radio('lang', [['auto', s.auto], ...LANGS.map((lang): [Prefs['lang'], string] => [lang, MESSAGES[lang].languageName])])}
            </SettingRow>
            <SettingRow title={s.theme} stacked>
              {radio('theme', THEMES.map((theme) => [theme, themeLabel(t, theme)]))}
            </SettingRow>
            <SettingRow title={s.sound} htmlFor="pref-sound" help={s.soundHelp}>
              <div class="ligungi-setting__inline">
                <button type="button" class="button button-empty" onClick={() => playSound('move')}>
                  {s.test}
                </button>
                <Toggle id="pref-sound" checked={current.sound} label={s.sound} onChange={(sound) => updatePrefs({ sound })} />
              </div>
            </SettingRow>
          </Group>

          <Group title={s.groupPieces} help={s.groupPiecesHelp} preview={<PiecePreview />}>
            <SettingRow title={s.boardTheme} help={s.boardThemeHelp} stacked>
              {radio(
                'boardTheme',
                BOARD_THEMES.map((name) => [
                  name,
                  { wood: s.boardThemeWood, walnut: s.boardThemeWalnut, slate: s.boardThemeSlate, contrast: s.boardThemeContrast }[name],
                ]),
              )}
            </SettingRow>
            <SettingRow title={s.pieceStyle} stacked>
              {radio('pieceStyle', [
                ['illustrated', s.pieceStyleIllustrated],
                ['kanji', s.pieceStyleKanji],
              ])}
            </SettingRow>
            {toggle('moveGuides', s.moveGuides, s.moveGuidesHelp)}
            {toggle('coordinates', s.coordinates, s.coordinatesHelp)}
          </Group>

          <Group title={s.groupRecord} help={s.groupRecordHelp} preview={<MoveListPreview />}>
            <SettingRow title={s.pieceNames} help={s.pieceNamesHelp} stacked>
              {radio('pieceNames', [
                ['local', s.pieceNamesLocal],
                ['ja', s.pieceNamesJapanese],
              ])}
            </SettingRow>
            <SettingRow title={s.notation} help={s.notationHelp} stacked>
              {radio('notation', [
                ['named', s.notationNamed],
                ['rulebook', s.notationRulebook],
                ['machine', s.notationMachine],
              ])}
            </SettingRow>
          </Group>

          <Group title={s.groupBoard}>
            <SettingRow
              title={s.boardSize}
              help={
                <a href="/analysis" target="_blank" rel="noopener">
                  {s.viewOnBoard}
                </a>
              }
              stacked
            >
              {radio('zoom', [
                [BOARD_SIZES[0], s.sizeSmall],
                [BOARD_SIZES[1], s.sizeMedium],
                [BOARD_SIZES[2], s.sizeLarge],
                [BOARD_SIZES[3], s.sizeMax],
              ])}
            </SettingRow>
            {toggle('hoverReach', s.hoverReach, s.hoverReachHelp)}
            {toggle('animation', s.animation, s.animationHelp)}
          </Group>

        </form>
        <p class="ligungi-notice">{s.saved}</p>
      </div>
    </main>
  );
};
