import type { ComponentChildren } from 'preact';
import { MoveListPreview } from '../components/MoveListPreview.tsx';
import { PiecePreview } from '../components/PiecePreview.tsx';
import { OptionCards, SettingRow, Toggle } from '../components/ui.tsx';
import { MESSAGES, themeLabel, useT } from '../i18n/index.ts';
import { BOARD_SIZES, BOARD_THEMES, LANGS, THEMES, prefs, updatePrefs, type Prefs } from '../prefs.ts';
import { playSound } from '../sound.ts';
import { useStore } from '../store.ts';
import { SettingsShell } from './AccountPage.tsx';

/** A titled group of settings; with a preview, the rows sit on the left and the preview on the right. */
const Group = ({ title, help, preview, children }: { title: string; help?: string; preview?: ComponentChildren; children: ComponentChildren }) => (
  <section class={`ligungi-card ligungi-settings__card ligungi-prefs-group${preview ? ' ligungi-prefs-group--preview' : ''}`}>
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
  const choice = <K extends keyof Prefs>(
    key: K,
    title: string,
    options: Array<[Prefs[K], string]>,
    extra: { help?: ComponentChildren; layout?: 'row' | 'segmented' } = {},
  ) => (
    <div class="ligungi-setting">
      <OptionCards
        name={`pref-${key}`}
        legend={title}
        layout={extra.layout ?? 'segmented'}
        value={current[key]}
        options={options.map(([value, label]) => ({ value, label }))}
        onChange={(value) => updatePrefs({ [key]: value } as Partial<Prefs>)}
        {...(extra.help !== undefined ? { help: extra.help } : {})}
      />
    </div>
  );
  const toggle = (key: BooleanPref, title: string, help?: string) => (
    <SettingRow title={title} htmlFor={`pref-${key}`} {...(help ? { help } : {})}>
      <Toggle id={`pref-${key}`} checked={current[key]} label={title} onChange={(value) => updatePrefs({ [key]: value })} />
    </SettingRow>
  );

  return (
    <SettingsShell active="settings" title={s.title}>
        <form class="form3 ligungi-prefs" onSubmit={(e) => e.preventDefault()}>
          <Group title={s.groupGeneral}>
            {choice('lang', s.language, [['auto', s.auto], ...LANGS.map((lang): [Prefs['lang'], string] => [lang, MESSAGES[lang].languageName])])}
            {choice('theme', s.theme, THEMES.map((theme) => [theme, themeLabel(t, theme)]))}
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
            {choice(
              'boardTheme',
              s.boardTheme,
              BOARD_THEMES.map((name) => [
                name,
                { wood: s.boardThemeWood, walnut: s.boardThemeWalnut, slate: s.boardThemeSlate, contrast: s.boardThemeContrast }[name],
              ]),
              { help: s.boardThemeHelp, layout: 'row' },
            )}
            {choice('pieceStyle', s.pieceStyle, [
              ['illustrated', s.pieceStyleIllustrated],
              ['kanji', s.pieceStyleKanji],
            ])}
            {toggle('moveGuides', s.moveGuides, s.moveGuidesHelp)}
            {toggle('coordinates', s.coordinates, s.coordinatesHelp)}
          </Group>

          <Group title={s.groupRecord} help={s.groupRecordHelp} preview={<MoveListPreview />}>
            {choice(
              'pieceNames',
              s.pieceNames,
              [
                ['local', s.pieceNamesLocal],
                ['ja', s.pieceNamesJapanese],
              ],
              { help: s.pieceNamesHelp },
            )}
            {choice(
              'notation',
              s.notation,
              [
                ['named', s.notationNamed],
                ['rulebook', s.notationRulebook],
                ['machine', s.notationMachine],
              ],
              { help: s.notationHelp },
            )}
          </Group>

          <Group title={s.groupBoard}>
            {choice(
              'zoom',
              s.boardSize,
              [
                [BOARD_SIZES[0], s.sizeSmall],
                [BOARD_SIZES[1], s.sizeMedium],
                [BOARD_SIZES[2], s.sizeLarge],
                [BOARD_SIZES[3], s.sizeMax],
              ],
              {
                help: (
                  <a href="/analysis" target="_blank" rel="noopener">
                    {s.viewOnBoard}
                  </a>
                ),
              },
            )}
            {toggle('hoverReach', s.hoverReach, s.hoverReachHelp)}
            {toggle('animation', s.animation, s.animationHelp)}
          </Group>

        </form>
        <p class="ligungi-notice">{s.saved}</p>
    </SettingsShell>
  );
};
