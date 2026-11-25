import { PIECE_STYLES } from '@ligungi/board';
import { useEffect, useState } from 'preact/hooks';
import { setLanguage, themeLabel, useT } from '../i18n/index.ts';
import { languageName, localeOf } from '../i18n/languages.ts';
import { icons } from '../icons.ts';
import { useDropdown } from '../core/useDropdown.ts';
import { Swatch, boardFaces, boardThemeLabel, paletteFaces, paletteLabel, shapeLabel, styleLabel } from '../prefs/looks.tsx';
import { BOARD_THEMES, LANGS, OPPONENT_PIECES, PIECE_PALETTES, PIECE_SHAPES, THEMES, prefs, resolveLang, updatePrefs } from '../prefs/prefs.ts';
import { navigate, useLocation } from '../core/router.ts';
import { logout, session } from '../core/session.ts';
import { useStore } from '../core/store.ts';

type DasherView = 'main' | 'language' | 'theme' | 'board' | 'pieces';

/** One choice in a dasher submenu: marked when it is the current one, with an optional swatch. */
const DasherChoice = ({ current, label, swatch, onPick }: { current: boolean; label: string; swatch?: readonly [string, string]; onPick: () => void }) => (
  <button type="button" class={current ? 'current' : ''} aria-pressed={current} onClick={onPick}>
    {swatch && <Swatch faces={swatch} />}
    {label}
  </button>
);

/**
 * lila's dasher: account and settings links on top, then submenus that open a second panel with a back button,
 * so the language, theme, board and piece choices never hide the link to the full settings page.
 */
export const Dasher = () => {
  const t = useT();
  const { user, moderator } = useStore(session);
  const current = useStore(prefs);
  const { shown, setShown, ref } = useDropdown();
  const [view, setView] = useState<DasherView>('main');
  const { path } = useLocation();
  useEffect(() => setShown(false), [path]);
  useEffect(() => {
    if (!shown) setView('main');
  }, [shown]);
  const lang = resolveLang(current.lang);
  const s = t.settings;
  const palette = current.pieceShape === 'koma' ? current.komaPalette : current.discPalette;
  const more = (
    <a class="ligungi-dasher__more" href="/settings">
      {t.nav.moreLooks}
    </a>
  );

  const back = (label: string) => (
    <button type="button" class="head text" data-icon={icons.LessThan} onClick={() => setView('main')}>
      {label}
    </button>
  );

  return (
    <div class={`dasher${shown ? ' shown' : ''}`} ref={ref}>
      {user ? (
        <button id="user_tag" type="button" class="toggle link" aria-expanded={shown} onClick={() => setShown(!shown)}>
          {user.name}
        </button>
      ) : (
        <button
          type="button"
          class="toggle anon link"
          title={t.nav.settings}
          aria-label={t.nav.settings}
          aria-expanded={shown}
          data-icon={icons.Gear}
          onClick={() => setShown(!shown)}
        />
      )}
      {shown && (
        <div id="dasher_app" class="dropdown ligungi-dasher">
          {view === 'main' && (
            <>
              <div class="links">
                {user && (
                  <>
                    <a class="text" href={`/@/${user.name}`} data-icon={icons.User}>
                      {t.nav.profile}
                    </a>
                    <a class="text" href="/friends" data-icon={icons.Group}>
                      {t.nav.friends}
                    </a>
                  </>
                )}
                <a class="text" href="/settings" data-icon={icons.Gear}>
                  {t.nav.settings}
                </a>
                {user && (
                  <a class="text" href="/account" data-icon={icons.AccountCircle}>
                    {t.nav.account}
                  </a>
                )}
                {moderator && (
                  <a class="text" href="/mod" data-icon={icons.Agent}>
                    {t.nav.moderation}
                  </a>
                )}
                {user && (
                  <form class="logout" onSubmit={(e) => e.preventDefault()}>
                    <button type="button" class="text" data-icon={icons.Power} onClick={() => void logout().then(() => navigate('/'))}>
                      {t.nav.signOut}
                    </button>
                  </form>
                )}
              </div>
              <div class="subs">
                <button type="button" class="sub" data-icon={icons.Language} onClick={() => setView('language')}>
                  <span>{t.nav.language}</span>
                  <span class="ligungi-dasher__value">{languageName(lang)}</span>
                </button>
                <button type="button" class="sub" data-icon={icons.Switch} onClick={() => setView('theme')}>
                  <span>{t.settings.theme}</span>
                  <span class="ligungi-dasher__value">{themeLabel(t, current.theme)}</span>
                </button>
                <button type="button" class="sub ligungi-dasher__look" onClick={() => setView('board')}>
                  <Swatch faces={boardFaces(current.boardTheme, current.customBoard)} />
                  <span>{t.nav.board}</span>
                  <span class="ligungi-dasher__value">{boardThemeLabel(s, current.boardTheme)}</span>
                </button>
                <button type="button" class="sub ligungi-dasher__look" onClick={() => setView('pieces')}>
                  <Swatch faces={paletteFaces(palette, current.customPieces)} />
                  <span>{t.nav.pieces}</span>
                  <span class="ligungi-dasher__value">{current.pieceStyle === 'kanji' ? s.pieceStyleKanjiShort : styleLabel(s, current.pieceStyle)}</span>
                </button>
              </div>
            </>
          )}
          {view === 'language' && (
            <div class="langs">
              {back(t.nav.language)}
              <form onSubmit={(e) => e.preventDefault()}>
                <div role="group" aria-label={t.nav.language}>
                  {(['auto', ...LANGS] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      lang={option === 'auto' ? undefined : localeOf(option)}
                      class={current.lang === option ? 'current' : ''}
                      aria-pressed={current.lang === option}
                      onClick={() => void setLanguage(option)}
                    >
                      {option === 'auto' ? t.settings.auto : languageName(option)}
                    </button>
                  ))}
                </div>
              </form>
            </div>
          )}
          {view === 'theme' && (
            <div class="langs">
              {back(t.settings.theme)}
              <form onSubmit={(e) => e.preventDefault()}>
                <div role="group" aria-label={t.settings.theme}>
                  {THEMES.map((option) => (
                    <button
                      key={option}
                      type="button"
                      class={current.theme === option ? 'current' : ''}
                      aria-pressed={current.theme === option}
                      onClick={() => updatePrefs({ theme: option })}
                    >
                      {themeLabel(t, option)}
                    </button>
                  ))}
                </div>
              </form>
            </div>
          )}
          {view === 'board' && (
            <div class="langs">
              {back(t.nav.board)}
              <form onSubmit={(e) => e.preventDefault()}>
                <div role="group" aria-label={s.boardTheme}>
                  {BOARD_THEMES.map((option) => (
                    <DasherChoice
                      key={option}
                      current={current.boardTheme === option}
                      label={boardThemeLabel(s, option)}
                      swatch={boardFaces(option, current.customBoard)}
                      onPick={() => updatePrefs({ boardTheme: option })}
                    />
                  ))}
                </div>
              </form>
              {more}
            </div>
          )}
          {view === 'pieces' && (
            <div class="langs">
              {back(t.nav.pieces)}
              <form onSubmit={(e) => e.preventDefault()}>
                <p class="ligungi-dasher__group" id="dasher-shape">
                  {s.pieceShape}
                </p>
                <div role="group" aria-labelledby="dasher-shape">
                  {PIECE_SHAPES.map((option) => (
                    <DasherChoice key={option} current={current.pieceShape === option} label={shapeLabel(s, option)} onPick={() => updatePrefs({ pieceShape: option })} />
                  ))}
                </div>
                <p class="ligungi-dasher__group" id="dasher-style">
                  {s.pieceStyle}
                </p>
                <div role="group" aria-labelledby="dasher-style">
                  {PIECE_STYLES.map((option) => (
                    <DasherChoice key={option} current={current.pieceStyle === option} label={styleLabel(s, option)} onPick={() => updatePrefs({ pieceStyle: option })} />
                  ))}
                </div>
                {(current.pieceStyle === 'kanji' || current.pieceStyle === 'letters') && (
                  <>
                    <p class="ligungi-dasher__group" id="dasher-opponent">
                      {s.opponentPieces}
                    </p>
                    <div role="group" aria-labelledby="dasher-opponent">
                      {OPPONENT_PIECES.map((option) => (
                        <DasherChoice
                          key={option}
                          current={current.opponentPieces === option}
                          label={option === 'turned' ? s.opponentPiecesTurned : s.opponentPiecesUpright}
                          onPick={() => updatePrefs({ opponentPieces: option })}
                        />
                      ))}
                    </div>
                  </>
                )}
                <p class="ligungi-dasher__group" id="dasher-colors">
                  {s.pieceColors}
                </p>
                <div role="group" aria-labelledby="dasher-colors">
                  {current.pieceShape === 'koma'
                    ? PIECE_PALETTES.koma.map((option) => (
                        <DasherChoice
                          key={option}
                          current={current.komaPalette === option}
                          label={paletteLabel(s, option)}
                          swatch={paletteFaces(option, current.customPieces)}
                          onPick={() => updatePrefs({ komaPalette: option })}
                        />
                      ))
                    : PIECE_PALETTES.disc.map((option) => (
                        <DasherChoice
                          key={option}
                          current={current.discPalette === option}
                          label={paletteLabel(s, option)}
                          swatch={paletteFaces(option, current.customPieces)}
                          onPick={() => updatePrefs({ discPalette: option })}
                        />
                      ))}
                </div>
              </form>
              {more}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
