import type { ComponentChildren } from 'preact';
import { MoveListPreview } from '../components/MoveListPreview.tsx';
import { PiecePreview } from '../components/PiecePreview.tsx';
import { PIECE_STYLES } from '@ligungi/board';
import { customBoardStyle, DEFAULT_CUSTOM_BOARD, type BoardWarning } from '../boardColors.ts';
import { customPieceStyle, DEFAULT_CUSTOM_PIECES, type PieceWarning } from '../pieceColors.ts';
import { ColorField, FieldRow, OptionCards, SettingRow, Toggle } from '../components/ui.tsx';
import { MESSAGES, themeLabel, useT } from '../i18n/index.ts';
import { Swatch, boardThemeLabel, paletteFaces, paletteLabel, shapeLabel, styleLabel } from '../looks.tsx';
import { BOARD_SIZES, BOARD_THEMES, KANJI_FONTS, LANGS, PIECE_PALETTES, PIECE_SHAPES, THEMES, prefs, updatePrefs, type Prefs } from '../prefs.ts';
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

/** The custom piece palette: face and symbol colors of each side, with what would make the pieces hard to read. */
const CustomPieceColors = () => {
  const s = useT().settings;
  const { customPieces } = useStore(prefs);
  const { warnings } = customPieceStyle(customPieces);
  const set = (patch: Partial<Prefs['customPieces']>) => updatePrefs({ customPieces: { ...customPieces, ...patch } });
  const text: Record<PieceWarning, string> = {
    whiteInk: s.customWarnWhiteInk,
    blackInk: s.customWarnBlackInk,
    sidesAlike: s.customWarnSidesAlike,
  };
  const changed = (Object.keys(DEFAULT_CUSTOM_PIECES) as Array<keyof Prefs['customPieces']>).some((key) => customPieces[key] !== DEFAULT_CUSTOM_PIECES[key]);
  return (
    <div class="ligungi-custom-board">
      <FieldRow>
        <ColorField id="pref-white-face" label={s.customWhiteFace} value={customPieces.whiteFace} onChange={(whiteFace) => set({ whiteFace })} />
        <ColorField id="pref-white-ink" label={s.customWhiteInk} value={customPieces.whiteInk} onChange={(whiteInk) => set({ whiteInk })} />
      </FieldRow>
      <FieldRow>
        <ColorField id="pref-black-face" label={s.customBlackFace} value={customPieces.blackFace} onChange={(blackFace) => set({ blackFace })} />
        <ColorField id="pref-black-ink" label={s.customBlackInk} value={customPieces.blackInk} onChange={(blackInk) => set({ blackInk })} />
      </FieldRow>
      <p class="ligungi-custom-board__help">{s.customPiecesHelp}</p>
      {warnings.length > 0 && (
        <ul class="ligungi-warnings" role="status">
          {warnings.map((warning) => (
            <li key={warning}>{text[warning]}</li>
          ))}
        </ul>
      )}
      {changed && (
        <button type="button" class="button button-empty" onClick={() => updatePrefs({ customPieces: DEFAULT_CUSTOM_PIECES })}>
          {s.customReset}
        </button>
      )}
    </div>
  );
};

/** The colors of the custom board theme, with what would make that board hard to read. */
const CustomBoardColors = () => {
  const s = useT().settings;
  const { customBoard } = useStore(prefs);
  const { warnings } = customBoardStyle(customBoard);
  const set = (patch: Partial<Prefs['customBoard']>) => updatePrefs({ customBoard: { ...customBoard, ...patch } });
  const text: Record<BoardWarning, string> = {
    lines: s.customWarnLines,
    whitePieces: s.customWarnWhitePieces,
    blackPieces: s.customWarnBlackPieces,
    marks: s.customWarnMarks,
  };
  const changed = customBoard.board !== DEFAULT_CUSTOM_BOARD.board || customBoard.line !== DEFAULT_CUSTOM_BOARD.line;
  return (
    <div class="ligungi-custom-board">
      <FieldRow>
        <ColorField id="pref-board-color" label={s.customBoardColor} value={customBoard.board} onChange={(board) => set({ board })} />
        <ColorField id="pref-line-color" label={s.customLineColor} value={customBoard.line} onChange={(line) => set({ line })} />
      </FieldRow>
      <p class="ligungi-custom-board__help">{s.customBoardHelp}</p>
      {warnings.length > 0 && (
        <ul class="ligungi-warnings" role="status">
          {warnings.map((warning) => (
            <li key={warning}>{text[warning]}</li>
          ))}
        </ul>
      )}
      {changed && (
        <button type="button" class="button button-empty" onClick={() => updatePrefs({ customBoard: DEFAULT_CUSTOM_BOARD })}>
          {s.customReset}
        </button>
      )}
    </div>
  );
};

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
            {toggle('byoyomiVoice', s.byoyomiVoice, s.byoyomiVoiceHelp)}
            {toggle('screenReader', t.blind.setting, t.blind.settingHelp)}
          </Group>

          <Group title={s.groupPieces} help={s.groupPiecesHelp} preview={<PiecePreview />}>
            {choice(
              'boardTheme',
              s.boardTheme,
              BOARD_THEMES.map((name) => [name, boardThemeLabel(s, name)]),
              { help: s.boardThemeHelp, layout: 'row' },
            )}
            {current.boardTheme === 'custom' && <CustomBoardColors />}
            {choice(
              'pieceShape',
              s.pieceShape,
              PIECE_SHAPES.map((shape) => [shape, shapeLabel(s, shape)]),
              { help: s.pieceShapeHelp },
            )}
            {choice(
              'pieceStyle',
              s.pieceStyle,
              PIECE_STYLES.map((style) => [style, styleLabel(s, style)]),
              { help: s.pieceStyleHelp },
            )}
            {current.pieceStyle === 'kanji' && (
              <div class="ligungi-setting">
                <OptionCards
                  name="pref-kanjiFont"
                  legend={s.kanjiFont}
                  layout="row"
                  value={current.kanjiFont}
                  options={KANJI_FONTS.map((font) => ({
                    value: font,
                    label: { system: s.kanjiFontSystem, brush: s.kanjiFontBrush, serif: s.kanjiFontSerif, gothic: s.kanjiFontGothic, pop: s.kanjiFontPop }[font],
                    icon: (
                      <span class={`ligungi-font-sample ligungi-font-sample--${font}`} aria-hidden="true">
                        帥
                      </span>
                    ),
                  }))}
                  onChange={(kanjiFont) => updatePrefs({ kanjiFont })}
                  help={s.kanjiFontHelp}
                />
              </div>
            )}
            <div class="ligungi-setting">
              {current.pieceShape === 'koma' ? (
                <OptionCards
                  name="pref-komaPalette"
                  legend={s.pieceColors}
                  layout="row"
                  value={current.komaPalette}
                  options={PIECE_PALETTES.koma.map((palette) => ({
                    value: palette,
                    label: paletteLabel(s, palette),
                    icon: <Swatch faces={paletteFaces(palette, current.customPieces)} />,
                  }))}
                  onChange={(komaPalette) => updatePrefs({ komaPalette })}
                />
              ) : (
                <OptionCards
                  name="pref-discPalette"
                  legend={s.pieceColors}
                  layout="row"
                  value={current.discPalette}
                  options={PIECE_PALETTES.disc.map((palette) => ({
                    value: palette,
                    label: paletteLabel(s, palette),
                    icon: <Swatch faces={paletteFaces(palette, current.customPieces)} />,
                  }))}
                  onChange={(discPalette) => updatePrefs({ discPalette })}
                />
              )}
            </div>
            {(current.pieceShape === 'koma' ? current.komaPalette : current.discPalette) === 'custom' && <CustomPieceColors />}
            <SettingRow title={s.moveGuides} htmlFor="pref-moveGuides" help={current.pieceShape === 'koma' ? s.moveGuidesKoma : s.moveGuidesHelp}>
              <Toggle
                id="pref-moveGuides"
                checked={current.moveGuides && current.pieceShape === 'disc'}
                disabled={current.pieceShape === 'koma'}
                label={s.moveGuides}
                onChange={(moveGuides) => updatePrefs({ moveGuides })}
              />
            </SettingRow>
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
            {toggle('hidePieces', s.hidePieces, s.hidePiecesHelp)}
            {current.hidePieces && toggle('peekPieces', s.peekPieces, s.peekPiecesHelp)}
          </Group>

        </form>
        <p class="ligungi-notice">{s.saved}</p>
    </SettingsShell>
  );
};
