import { ROLE_INFO, ROLES, type Color, type Role } from '@ligungi/engine';

export type PieceNames = 'pt' | 'en' | 'es' | 'ja';

const PORTUGUESE_NAMES: Readonly<Record<Role, string>> = {
  marshal: 'Marechal',
  general: 'General',
  lieutenant: 'Tenente-General',
  major: 'Major-General',
  samurai: 'Samurai',
  lancer: 'Lanceiro',
  rider: 'Cavaleiro',
  spy: 'Ninja',
  fortress: 'Fortaleza',
  soldier: 'Soldado',
  cannon: 'Canhão',
  archer: 'Arqueiro',
  musketeer: 'Mosqueteiro',
  tactician: 'Estrategista',
};

const ENGLISH_NAMES: Readonly<Record<Role, string>> = {
  marshal: 'Marshal',
  general: 'General',
  lieutenant: 'Lieutenant General',
  major: 'Major General',
  samurai: 'Samurai',
  lancer: 'Lancer',
  rider: 'Knight',
  spy: 'Ninja',
  fortress: 'Fortress',
  soldier: 'Soldier',
  cannon: 'Cannon',
  archer: 'Archer',
  musketeer: 'Musketeer',
  tactician: 'Tactician',
};

const SPANISH_NAMES: Readonly<Record<Role, string>> = {
  marshal: 'Mariscal',
  general: 'General',
  lieutenant: 'Teniente General',
  major: 'Mayor General',
  samurai: 'Samurái',
  lancer: 'Lancero',
  rider: 'Caballero',
  spy: 'Ninja',
  fortress: 'Fortaleza',
  soldier: 'Soldado',
  cannon: 'Cañón',
  archer: 'Arquero',
  musketeer: 'Mosquetero',
  tactician: 'Estratega',
};

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const JAPANESE_NAMES = Object.fromEntries(
  ROLES.map((role) => [role, capitalize(ROLE_INFO[role].reading)]),
) as Readonly<Record<Role, string>>;

const NAMES: Readonly<Record<PieceNames, Readonly<Record<Role, string>>>> = {
  pt: PORTUGUESE_NAMES,
  en: ENGLISH_NAMES,
  es: SPANISH_NAMES,
  ja: JAPANESE_NAMES,
};

export const pieceName = (role: Role, names: PieceNames): string => NAMES[names][role];

/** Abbreviations of the names longer than 9 letters, so a move fits on one line of the move list. */
const SHORT_NAMES: Readonly<Record<PieceNames, Readonly<Partial<Record<Role, string>>>>> = {
  pt: { lieutenant: 'Ten.-Gen.', major: 'Maj.-Gen.', musketeer: 'Mosq.', tactician: 'Estrat.' },
  en: { lieutenant: 'Lt. Gen.', major: 'Maj. Gen.' },
  es: { lieutenant: 'Tte. Gral.', major: 'May. Gral.', musketeer: 'Mosq.' },
  ja: {},
};

/** The piece's name for tight spaces such as the move list: the abbreviation when there is one. */
export const pieceShortName = (role: Role, names: PieceNames): string => SHORT_NAMES[names][role] ?? NAMES[names][role];

/**
 * Two-letter abbreviations for the letters piece style: the first letter and the one that tells the piece apart, both
 * initials for compound names. No two pieces share one within a language; with Japanese names, the readings' romaji.
 */
const LETTERS: Readonly<Record<PieceNames, Readonly<Record<Role, string>>>> = {
  pt: { marshal: 'Ma', general: 'Ge', lieutenant: 'TG', major: 'MG', samurai: 'Sa', lancer: 'La', rider: 'Cv', spy: 'Ni', fortress: 'Fo', soldier: 'So', cannon: 'Cn', archer: 'Aq', musketeer: 'Mo', tactician: 'Es' },
  en: { marshal: 'Ma', general: 'Ge', lieutenant: 'LG', major: 'MG', samurai: 'Sa', lancer: 'La', rider: 'Kn', spy: 'Ni', fortress: 'Fo', soldier: 'So', cannon: 'Ca', archer: 'Ar', musketeer: 'Mu', tactician: 'Ta' },
  es: { marshal: 'Ma', general: 'Ge', lieutenant: 'TG', major: 'MG', samurai: 'Sa', lancer: 'La', rider: 'Cb', spy: 'Ni', fortress: 'Fo', soldier: 'So', cannon: 'Cn', archer: 'Aq', musketeer: 'Mo', tactician: 'Es' },
  ja: { marshal: 'Su', general: 'Ta', lieutenant: 'Ch', major: 'Sh', samurai: 'Sa', lancer: 'Ya', rider: 'Ki', spy: 'Sn', fortress: 'To', soldier: 'Hy', cannon: 'Oz', archer: 'Yu', musketeer: 'Ts', tactician: 'Bo' },
};

export const pieceLetters = (role: Role, names: PieceNames): string => LETTERS[names][role];

export interface Labels {
  readonly white: string;
  readonly black: string;
  readonly capture: string;
  readonly stack: string;
  readonly betray: string;
  readonly drop: string;
  readonly select: string;
  readonly level: string;
  readonly tower: string;
  readonly hand: string;
}

export const DEFAULT_LABELS: Labels = {
  white: 'Branco',
  black: 'Preto',
  capture: 'Capturar',
  stack: 'Empilhar',
  betray: 'Trair',
  drop: 'Colocar',
  select: 'Selecionar',
  level: 'nível',
  tower: 'Torre',
  hand: 'Mão',
};

export const colorLabel = (color: Color, labels: Labels): string =>
  color === 'white' ? labels.white : labels.black;
