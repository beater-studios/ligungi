import type { Color } from '@ligungi/engine';
import type { ComponentChildren, VNode } from 'preact';
import { STUDIO } from './content/shared.tsx';

/**
 * What the code needs to know about the messages that are not plain text: the arguments of each message, in the order
 * the code passes them (the message names them, so a translation can put them in any order), the tags a rich message
 * turns into markup, and the messages that are lists, one item per line. Every other key in the locale files is plain
 * text. The English file (locales/en.json) is the source of the keys; test/i18n.test.ts checks that both agree.
 */

declare const signature: unique symbol;

type Names<A extends readonly unknown[]> = { readonly [K in keyof A]: string };

/** Turns the text inside `<tag>…</tag>` into markup. */
export type Tag = (children: ComponentChildren) => VNode;

export interface TextSpec<A extends readonly unknown[]> {
  readonly kind: 'text';
  readonly names: readonly string[];
  /** Starts with a capital letter even when the first argument does not (a piece name put first). */
  readonly sentence: boolean;
  readonly [signature]?: A;
}

export interface RichSpec<A extends readonly unknown[]> {
  readonly kind: 'rich';
  readonly names: readonly string[];
  readonly tags: Readonly<Record<string, Tag>>;
  readonly [signature]?: A;
}

/** One item per line: `lines` keeps as many items as the English text has, `words` any number (other words a player may type). */
export type ListSpec = { readonly kind: 'lines' } | { readonly kind: 'words' };

export type Spec = TextSpec<readonly unknown[]> | RichSpec<readonly unknown[]> | ListSpec;

const text = <A extends readonly unknown[]>(...names: Names<A>): TextSpec<A> => ({ kind: 'text', names, sentence: false });
const sentence = <A extends readonly unknown[]>(spec: TextSpec<A>): TextSpec<A> => ({ ...spec, sentence: true });
const rich = <A extends readonly unknown[]>(tags: Readonly<Record<string, Tag>>, ...names: Names<A>): RichSpec<A> => ({ kind: 'rich', names, tags });
const lines: ListSpec = { kind: 'lines' };
const words: ListSpec = { kind: 'words' };

const internal =
  (href: string): Tag =>
  (children) => <a href={href}>{children}</a>;
const external =
  (href: string): Tag =>
  (children) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
const bold: Tag = (children) => <b>{children}</b>;
const strong: Tag = (children) => <strong>{children}</strong>;
const onlineCount: Tag = (children) => <strong class="ligungi-friends-page__online">{children}</strong>;
const AUTH = { login: internal('/login'), signup: internal('/signup') };

export const SCHEMA = {
  'win': text<[winner: Color, reason: string]>('winner', 'reason'),
  'draw': text<[reason: string]>('reason'),
  'turnStatus': text<[draft: boolean, color: Color, note: 'you' | 'thinking' | null]>('draft', 'color', 'note'),
  'daysPerMove': text<[n: number]>('n'),
  'days': text<[n: number]>('n'),

  'nav.turnAgainst': text<[name: string]>('name'),
  'nav.timeLeft': text<[time: string]>('time'),

  'footer.studio': rich<[]>({ studio: external(STUDIO) }),

  'consent.text': rich<[]>({ privacy: internal('/privacy') }),

  'account.bioHelp': text<[used: number, max: number]>('used', 'max'),
  'account.sessionDates': text<[since: string, active: string]>('since', 'active'),
  'account.twoFactorOn': text<[left: number]>('left'),
  'account.twoFactorSignedOut': text<[n: number]>('n'),
  'account.recoveryFile': text<[name: string]>('name'),

  'panels.tower': text<[n: number]>('n'),
  'panels.level': text<[n: number]>('n'),
  'panels.draftCount': text<[board: number, hand: number]>('board', 'hand'),

  'home.waiting': text<[n: number]>('n'),
  'home.online': text<[n: number]>('n'),
  'home.lessonsDone': text<[done: number, total: number]>('done', 'total'),

  'create.incrementText': text<[minutes: number, seconds: number]>('minutes', 'seconds'),
  'create.byoyomiText': text<[minutes: number, seconds: number, periods: number]>('minutes', 'seconds', 'periods'),
  'create.challengeTitle': text<[name: string]>('name'),

  'challenge.yourDirect': text<[name: string]>('name'),
  'challenge.challengesYou': rich<[name: ComponentChildren]>({}, 'name'),
  'challenge.challengesOther': rich<[name: ComponentChildren, other: string]>({}, 'name', 'other'),
  'challenge.rating': text<[rating: number, mode: string]>('rating', 'mode'),
  'challenge.ratedLogin': rich<[]>(AUTH),
  'challenge.waitingFor': text<[name: string]>('name'),
  'challenge.declinedBy': text<[name: string]>('name'),

  'auth.pitchItems': lines,
  'auth.suspended': text<[until: string, reason: string]>('until', 'reason'),
  'auth.suspendedForever': text<[reason: string]>('reason'),

  'game.heading': text<[white: string, black: string]>('white', 'black'),
  'game.giveTime': text<[seconds: number]>('seconds'),
  'game.periodsLeft': text<[n: number]>('n'),
  'game.premove': text<[move: string]>('move'),

  'computer.fromPosition': text<[mode: string, turn: Color]>('mode', 'turn'),
  'computer.bot': text<[level: number]>('level'),

  'analysis.importErrors.badMode': text<[line: number, text: string]>('line', 'text'),
  'analysis.importErrors.unreadable': text<[line: number, text: string]>('line', 'text'),
  'analysis.importErrors.illegal': text<[line: number, text: string]>('line', 'text'),
  'analysis.importErrors.ambiguous': text<[line: number, text: string]>('line', 'text'),
  'analysis.importErrors.afterEnd': text<[line: number, text: string]>('line', 'text'),
  'analysis.fromGame': rich<[link: ComponentChildren]>({}, 'link'),

  'crosstable.draws': text<[n: number]>('n'),
  'crosstable.win': text<[name: string]>('name'),

  'profile.memberSince': text<[date: string]>('date'),
  'profile.followers': text<[n: number]>('n'),
  'profile.lengthUpTo': text<[n: number]>('n'),
  'profile.lengthBetween': text<[from: number, to: number]>('from', 'to'),
  'profile.lengthOver': text<[n: number]>('n'),
  'profile.chartLabel': text<[mode: string, games: number, from: number, to: number, peak: number]>('mode', 'games', 'from', 'to', 'peak'),
  'profile.against': text<[name: string]>('name'),
  'profile.moves': text<[n: number]>('n'),
  'profile.ratedGames': text<[n: number]>('n'),
  'profile.inactiveHint': text<[days: number]>('days'),
  'profile.record': text<[wins: number, draws: number, losses: number]>('wins', 'draws', 'losses'),

  'players.heroTitle': text<[online: number, free: number]>('online', 'free'),
  'players.heroText': text<[playing: number]>('playing'),
  'players.recentWinner': text<[name: string]>('name'),
  'players.positionTitle': text<[mode: string]>('mode'),
  'players.distributionTitle': text<[mode: string]>('mode'),
  'players.noRating': text<[mode: string]>('mode'),
  'players.yourPosition': text<[rating: number, percent: number]>('rating', 'percent'),
  'players.viewRanking': text<[mode: string]>('mode'),
  'players.band': text<[from: number, to: number, n: number]>('from', 'to', 'n'),
  'players.chartLabel': text<[mode: string, total: number]>('mode', 'total'),

  'ranking.trendLabel': text<[change: number]>('change'),
  'ranking.inRanking': text<[n: number]>('n'),
  'ranking.playerCount': text<[n: number]>('n'),
  'ranking.detail': text<[games: number, wins: number, draws: number, losses: number]>('games', 'wins', 'draws', 'losses'),
  'ranking.range': text<[from: number, to: number, total: number]>('from', 'to', 'total'),

  'friends.login': rich<[]>(AUTH),
  'friends.summary': rich<[n: number, online: number]>({ strong, online: onlineCount }, 'n', 'online'),

  'info.updated': text<[date: string]>('date'),

  'lessons.stage': text<[n: number]>('n'),
  'lessons.exerciseOf': text<[n: number, total: number]>('n', 'total'),
  'lessons.stars': text<[n: number, max: number]>('n', 'max'),
  'lessons.moves': text<[n: number]>('n'),
  'lessons.par': text<[n: number]>('n'),

  'explorer.games': text<[n: number]>('n'),
  'explorer.resultsLabel': text<[white: number, draws: number, black: number]>('white', 'draws', 'black'),
  'explorer.updated': text<[date: string]>('date'),

  'coordinates.best': text<[n: number]>('n'),
  'coordinates.score': text<[n: number]>('n'),
  'coordinates.result': text<[n: number]>('n'),

  'puzzleRuns.bonus': text<[seconds: number]>('seconds'),
  'puzzleRuns.penalty': text<[seconds: number]>('seconds'),

  'practice.goalMate': text<[n: number]>('n'),
  'practice.goalWin': text<[n: number]>('n'),
  'practice.goalSurvive': text<[n: number]>('n'),
  'practice.movesUsed': text<[used: number, limit: number]>('used', 'limit'),
  'practice.doneIn': text<[n: number]>('n'),
  'practice.won': text<[n: number]>('n'),

  'puzzles.taskMate': text<[color: Color, n: number]>('color', 'n'),
  'puzzles.taskMaterial': text<[color: Color]>('color'),
  'puzzles.progress': text<[solved: number, total: number]>('solved', 'total'),
  'puzzles.ratingChange': text<[change: string, rating: number]>('change', 'rating'),
  'puzzles.details': text<[id: string, rating: number, plays: number]>('id', 'rating', 'plays'),
  'puzzles.ratingSummary': text<[games: number, rate: number]>('games', 'rate'),

  'tv.liveCount': text<[n: number]>('n'),
  'tv.move': text<[n: number]>('n'),

  'report.title': text<[name: string]>('name'),

  'study.chapterCount': text<[n: number]>('n'),
  'study.by': rich<[name: ComponentChildren]>({}, 'name'),
  'study.chapterNumber': text<[n: number]>('n'),
  'study.counts': text<[arrows: number, arrowsMax: number, squares: number, squaresMax: number]>('arrows', 'arrowsMax', 'squares', 'squaresMax'),
  'study.limit': text<[arrows: number, squares: number]>('arrows', 'squares'),
  'study.updated': text<[time: string]>('time'),

  'mod.reportedBy': text<[reporter: string, date: string]>('reporter', 'date'),
  'mod.closedBy': text<[moderator: string, date: string]>('moderator', 'date'),
  'mod.suspendedUntil': text<[date: string]>('date'),
  'mod.reasonLabel': text<[reason: string]>('reason'),
  'mod.openReports': text<[n: number]>('n'),
  'mod.days': text<[n: number]>('n'),

  'editor.addToHand': text<[name: string]>('name'),
  'editor.removeFromHand': text<[name: string]>('name'),
  'editor.square': text<[square: string, contents: string]>('square', 'contents'),
  'editor.problems.marshalCount': text<[color: string, count: number]>('color', 'count'),
  'editor.problems.marshalInHand': text<[color: string]>('color'),
  'editor.problems.tooMany': text<[color: string, piece: string, count: number, max: number]>('color', 'piece', 'count', 'max'),
  'editor.problems.tooHigh': text<[square: string, height: number, max: number]>('square', 'height', 'max'),
  'editor.problems.marshalCovered': text<[square: string]>('square'),
  'editor.problems.marshalStacked': text<[square: string]>('square'),
  'editor.problems.waitingInCheck': text<[color: string]>('color'),

  'trainer.level': text<[n: number]>('n'),

  'learn.objective': rich<[]>({ b: bold }),
  'learn.towers': lines,
  'learn.setup': rich<[]>({ b: bold }),
  'learn.tier': text<[n: number]>('n'),

  'notices.follow': text<[name: string]>('name'),
  'notices.reportClosed': text<[name: string]>('name'),
  'notices.renamed': text<[name: string]>('name'),
  'notices.studyHidden': text<[title: string]>('title'),
  'notices.studyRestored': text<[title: string]>('title'),
  'notices.studyDeleted': text<[title: string]>('title'),

  'notify.challenge': text<[name: string]>('name'),
  'notify.lastMove': text<[move: string]>('move'),

  'speech.move': text<[piece: string, to: string]>('piece', 'to'),
  'speech.stack': text<[piece: string, to: string, level: number]>('piece', 'to', 'level'),
  'speech.capture': text<[piece: string, to: string]>('piece', 'to'),
  'speech.drop': text<[piece: string, to: string, level: number]>('piece', 'to', 'level'),

  'blind.help': lines,
  'blind.arrow': text<[color: string, from: string, to: string]>('color', 'from', 'to'),
  'blind.painted': text<[color: string, square: string]>('color', 'square'),
  'blind.drawings': text<[text: string]>('text'),
  'blind.comment': text<[text: string]>('text'),
  'blind.drawn': text<[text: string]>('text'),
  'blind.erased': text<[text: string]>('text'),
  'blind.atMove': text<[index: number, text: string]>('index', 'text'),
  'blind.selected': sentence(text<[piece: string, square: string]>('piece', 'square')),
  'blind.selectedHand': text<[name: string]>('name'),
  'blind.handOf': text<[color: Color]>('color'),
  'blind.placed': text<[text: string]>('text'),
  'blind.removed': text<[text: string]>('text'),
  'blind.diagram': text<[piece: string, square: string, parts: string]>('piece', 'square', 'parts'),
  'blind.diagramTier': text<[tier: number, squares: string]>('tier', 'squares'),
  'blind.coordsCell': text<[column: number, row: number]>('column', 'row'),
  'blind.coordsMarked': text<[cell: string]>('cell'),
  'blind.variations': text<[list: string]>('list'),
  'blind.movesLoaded': text<[count: number]>('count'),
  'blind.targets': text<[squares: string]>('squares'),
  'blind.piece': text<[name: string, color: Color]>('name', 'color'),
  'blind.move': text<[color: Color, piece: string, from: string, to: string]>('color', 'piece', 'from', 'to'),
  'blind.stack': text<[color: Color, piece: string, from: string, to: string, below: string, level: number]>('color', 'piece', 'from', 'to', 'below', 'level'),
  'blind.capture': text<[color: Color, piece: string, from: string, to: string, captured: string, count: number]>('color', 'piece', 'from', 'to', 'captured', 'count'),
  'blind.drop': text<[color: Color, piece: string, to: string, level: number]>('color', 'piece', 'to', 'level'),
  'blind.betray': text<[pieces: string, count: number, color: Color]>('pieces', 'count', 'color'),
  'blind.atLevel': text<[piece: string, level: number]>('piece', 'level'),
  'blind.done': text<[color: Color]>('color'),
  'blind.check': text<[color: Color]>('color'),
  'blind.side': text<[color: Color, entries: string]>('color', 'entries'),
  'blind.noPieces': text<[color: Color]>('color'),
  'blind.onSquare': text<[piece: string, square: string]>('piece', 'square'),
  'blind.over': text<[pieces: string]>('pieces'),
  'blind.emptySquare': text<[square: string]>('square'),
  'blind.square': text<[square: string, piece: string]>('square', 'piece'),
  'blind.tower': text<[square: string, count: number, levels: string]>('square', 'count', 'levels'),
  'blind.level': text<[level: number, piece: string]>('level', 'piece'),
  'blind.hand': text<[color: Color, pieces: string]>('color', 'pieces'),
  'blind.emptyHand': text<[color: Color]>('color'),
  'blind.handPiece': text<[name: string, count: number]>('name', 'count'),
  'blind.turn': text<[color: Color, draft: boolean]>('color', 'draft'),
  'blind.draftDone': text<[color: Color]>('color'),
  'blind.reach': sentence(text<[piece: string, square: string, parts: string]>('piece', 'square', 'parts')),
  'blind.moveTo': text<[squares: string]>('squares'),
  'blind.stackOn': text<[squares: string]>('squares'),
  'blind.captureOn': text<[squares: string]>('squares'),
  'blind.noMoves': sentence(text<[piece: string, square: string]>('piece', 'square')),
  'blind.clock': text<[name: string, time: string]>('name', 'time'),
  'blind.options': text<[count: number]>('count'),
  'blind.option': text<[index: number, text: string]>('index', 'text'),
  'blind.words.position': words,
  'blind.words.square': words,
  'blind.words.hands': words,
  'blind.words.reach': words,
  'blind.words.last': words,
  'blind.words.clocks': words,
  'blind.words.help': words,
  'blind.words.done': words,
  'blind.words.draw': words,
  'blind.words.resign': words,
  'blind.words.capture': words,
  'blind.words.stack': words,
  'blind.words.betray': words,
  'blind.words.drop': words,
  'blind.words.goal': words,
  'blind.words.prev': words,
  'blind.words.next': words,
  'blind.words.first': words,
  'blind.words.end': words,
  'blind.words.arrow': words,
  'blind.words.paint': words,
  'blind.words.clear': words,
  'blind.words.drawings': words,
  'blind.words.remove': words,
  'blind.words.turn': words,
  'blind.words.variation': words,

  'gameSearch.page': text<[n: number]>('n'),
  'gameSearch.versus': text<[white: string, black: string]>('white', 'black'),

  'activity.games': text<[count: number, mode: string]>('count', 'mode'),
  'activity.wins': text<[n: number]>('n'),
  'activity.draws': text<[n: number]>('n'),
  'activity.losses': text<[n: number]>('n'),
  'activity.puzzles': text<[won: number, total: number]>('won', 'total'),
  'activity.lessons': text<[count: number]>('count'),
  'activity.practice': text<[count: number]>('count'),
  'activity.run': text<[name: string, score: number]>('name', 'score'),
  'activity.feedWon': text<[opponent: string, mode: string]>('opponent', 'mode'),
  'activity.feedLost': text<[opponent: string, mode: string]>('opponent', 'mode'),
  'activity.feedDrew': text<[opponent: string, mode: string]>('opponent', 'mode'),

  'insights.title': text<[name: string]>('name'),
  'insights.games': text<[count: number]>('count'),
  'insights.bands': lines,
  'insights.lengthValue': text<[moves: number]>('moves'),
  'insights.held': lines,
} as const;
