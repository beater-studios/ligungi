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
