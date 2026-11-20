import { ROLE_INFO, ROLES, type Color, type Role } from '@ligungi/engine';

/** What a piece is called: its full name, a short one for tight spaces (the move list) and two letters for the letters style. */
export interface PieceNames {
  readonly names: Readonly<Record<Role, string>>;
  readonly short: Readonly<Record<Role, string>>;
  /** No two pieces share them within a set. */
  readonly letters: Readonly<Record<Role, string>>;
}

/** The English names; the site's translations bring their own sets. */
export const ENGLISH_PIECE_NAMES: PieceNames = {
  names: {
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
  },
  short: {
    marshal: 'Marshal',
    general: 'General',
    lieutenant: 'Lt. Gen.',
    major: 'Maj. Gen.',
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
  },
  letters: { marshal: 'Ma', general: 'Ge', lieutenant: 'LG', major: 'MG', samurai: 'Sa', lancer: 'La', rider: 'Kn', spy: 'Ni', fortress: 'Fo', soldier: 'So', cannon: 'Ca', archer: 'Ar', musketeer: 'Mu', tactician: 'Ta' },
};

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const JAPANESE_NAMES = Object.fromEntries(ROLES.map((role) => [role, capitalize(ROLE_INFO[role].reading)])) as Readonly<Record<Role, string>>;

/** The Japanese readings in romaji, the same in every language; the letters are the readings' too. */
export const JAPANESE_PIECE_NAMES: PieceNames = {
  names: JAPANESE_NAMES,
  short: JAPANESE_NAMES,
  letters: { marshal: 'Su', general: 'Ta', lieutenant: 'Ch', major: 'Sh', samurai: 'Sa', lancer: 'Ya', rider: 'Ki', spy: 'Sn', fortress: 'To', soldier: 'Hy', cannon: 'Oz', archer: 'Yu', musketeer: 'Ts', tactician: 'Bo' },
};

export const pieceName = (role: Role, names: PieceNames): string => names.names[role];

/** The piece's name for tight spaces such as the move list. */
export const pieceShortName = (role: Role, names: PieceNames): string => names.short[role];

/** Two-letter abbreviations for the letters piece style. */
export const pieceLetters = (role: Role, names: PieceNames): string => names.letters[role];

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
