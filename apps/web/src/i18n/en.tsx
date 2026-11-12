import type { Color } from '@ligungi/engine';
import type { ComponentChildren } from 'preact';
import type { Messages } from './pt.tsx';

const LILA = 'https://github.com/lichess-org/lila';
const STUDIO = 'https://beaterstudios.com/';

const colorOf = (color: Color) => (color === 'white' ? 'White' : 'Black');

export const en: Messages = {
  locale: 'en-US',
  languageName: 'English',
  metaDescription: 'Play Gungi, the HUNTER×HUNTER board game, online and for free, with the official rules.',

  modes: {
    intro: 'Introductory',
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
  },
  modeDescriptions: {
    intro: 'Fixed setup, no special pieces, towers up to 2.',
    beginner: 'Fixed setup, archers are the only special pieces, towers up to 2.',
    intermediate: 'Free setup through the draft, all pieces, towers up to 2.',
    advanced: 'Free setup through the draft, all pieces, towers up to 3. The full game.',
  },
  colors: { white: 'White', black: 'Black' },
  colorChoices: { white: 'White', black: 'Black', random: 'Random' },

  reasons: {
    capture: 'capturing the Marshal',
    mate: 'checkmate',
    resign: 'resignation',
    timeout: 'timeout',
    abandon: 'opponent leaving',
    repetition: 'repetition',
    insufficient: 'insufficient material',
    agreement: 'agreement',
  },
  win: (winner, reason) => `${colorOf(winner)} wins by ${reason}`,
  draw: (reason) => `Draw by ${reason}`,
  aborted: 'Game aborted',
  ongoing: 'Playing',
  turnStatus: (draft, color, note) =>
    `${draft ? 'Draft' : 'Game'}: ${colorOf(color)} to play${note === 'you' ? ' (you)' : note === 'thinking' ? ' (thinking...)' : ''}`,

  noClock: 'No clock',
  rated: 'Rated',
  casual: 'Casual',
  freeDraftTag: 'free draft',
  freeDraft: 'Free draft',
  freeDraftHint: 'Each player places pieces until they declare done; the draft only ends when both are done.',
  freeDraftLabel: 'Each player finishes their own draft',
  freeDraftRatedHint: 'Casual games only. Rated games follow the rulebook.',
  done: 'Done',

  errors: {
    invalidSettings: 'Invalid settings.',
    invalidMode: 'Invalid mode.',
    invalidRated: 'Say whether the game is rated.',
    invalidColor: 'Invalid color.',
    invalidFirstPlayer: 'Invalid first player.',
    invalidInitialTime: 'Initial time must be between 1 and 180 minutes.',
    invalidIncrement: 'Increment must be between 0 and 180 seconds.',
    unlimitedNotRated: 'Games without a clock cannot be rated.',
    invalidDraftOption: 'Invalid draft option.',
    ratedNeedsOfficialDraft: 'Rated games follow the official draft rule.',
    tooManyAttempts: 'Too many attempts. Wait a minute.',
    invalidUsername: 'Username: 3 to 20 characters, letters, digits, _ or -.',
    invalidPassword: 'The password needs at least 8 characters.',
    usernameTaken: 'That username is already taken.',
    wrongCredentials: 'Wrong username or password.',
    userNotFound: 'User not found.',
    gameNotFound: 'Game not found.',
    challengeNotFound: 'Challenge not found.',
    seekNotFound: 'Seek not found.',
    routeNotFound: 'Route not found.',
    invalidJson: 'Invalid JSON.',
    requestTooLarge: 'Request too large.',
    forbidden: 'Request refused.',
    internal: 'Internal error.',
    loginForRated: 'Sign in to play rated games.',
    seekUnavailable: 'That seek is no longer available.',
    ownSeek: 'You cannot accept your own seek.',
    tooManySeeks: 'You already have too many open seeks.',
    connectionRequired: 'No connection to the server. Reload the page and try again.',
    challengeUnavailable: 'That challenge is no longer available.',
    ownChallenge: 'Send the link to someone else.',
    gameOver: 'The game is already over.',
    notYourTurn: 'It is not your turn.',
    staleMove: 'Outdated move.',
    invalidMove: 'Invalid move.',
    illegalMove: 'Illegal move.',
    cannotAbort: 'The game can no longer be aborted.',
    cannotClaim: 'You cannot claim victory yet.',
    drawUnavailable: 'A draw is not available now.',
    noDrawOffer: 'There is no draw offer.',
    rematchUnavailable: 'Rematch unavailable.',
    noRematchOffer: 'There is no rematch offer.',
    invalidTopic: 'Invalid topic.',
    tooManySubscriptions: 'Too many subscriptions on this connection.',
    invalidGame: 'Invalid game.',
    notAPlayer: 'You are not playing this game.',
    invalidAction: 'Invalid action.',
    unknownMessage: 'Unknown message.',
    loginRequired: 'Sign in to continue.',
    cannotFollowSelf: 'You cannot follow yourself.',
    tooManyFollows: 'You already follow the maximum number of players.',
    invalidFilter: 'Invalid filter.',
  },
  genericError: 'Something went wrong. Try again.',
  offline: 'No connection. Trying to reconnect...',

  board: {
    white: 'White',
    black: 'Black',
    capture: 'Capture',
    stack: 'Stack',
    betray: 'Betray',
    drop: 'Drop',
    select: 'Select',
    level: 'tier',
    tower: 'Tower',
    hand: 'Hand',
  },

  nav: {
    navigation: 'Navigation',
    play: 'Play',
    createGame: 'Create a game',
    playFriend: 'Play with a friend',
    playComputer: 'Play against the computer',
    learn: 'Learn',
    rules: 'Gungi rules',
    watch: 'Watch',
    liveGames: 'Live games',
    tools: 'Tools',
    analysis: 'Analysis board',
    reconnecting: 'Reconnecting',
    signIn: 'Sign in',
    signUp: 'Sign up',
    settings: 'Settings',
    signOut: 'Sign out',
    language: 'Language',
    community: 'Community',
    players: 'Leaderboard',
    friends: 'Friends',
  },
  notFound: { title: 'Page not found', back: 'Back to the home page' },
  footer: {
    source: (url) => (
      <>
        ligungi is free software: <a href={url}>source code (AGPL-3.0)</a>. Look based on <a href={LILA}>lila</a>, the
        open source code of lichess.org.
      </>
    ),
    trademark: 'Gungi and HUNTER×HUNTER belong to their owners. Fan project, not officially affiliated.',
    studio: (
      <>
        A <a href={STUDIO}>Beater Studios</a> project
      </>
    ),
  },

  common: {
    online: 'Online',
    offline: 'Offline',
    close: 'Close',
    loading: 'Loading...',
    newGame: 'New game',
    you: 'You',
    anonymous: 'Anonymous',
    yourColor: 'Your color',
    whoStarts: 'Who moves first',
    mode: 'Mode',
    flip: 'Flip board',
    first: 'First',
    prev: 'Previous',
    next: 'Next',
    last: 'Last',
    analyse: 'Analyse',
    takeback: 'Take back',
    startsGame: 'Moves first',
    yourTurn: 'Your turn',
  },

  panels: {
    tower: (n) => `Tower of ${n}`,
    piece: 'Piece',
    towerHint: 'Hover or tap a square to see its tower.',
    level: (n) => `tier ${n}`,
    draft: 'Draft',
    draftCount: (board, hand) => `${board} on the board · ${hand} in hand`,
    draftDone: 'done',
    draftFreeNotice: 'Free draft: it ends when both players declare done.',
    draftBookNotice: 'The draft ends when the second player declares done.',
  },

  home: {
    title: 'Gungi online',
    intro: 'The HUNTER×HUNTER board game with the official 2022 rules. Free, no ads, no account needed.',
    learnRules: 'Learn the rules',
    custom: 'Custom',
    player: 'Player',
    rating: 'Rating',
    time: 'Time',
    noSeeks: 'No open games. Create one or join a quick game.',
    cancel: 'Cancel',
    join: 'Join',
    noPlaying: 'You have no ongoing games.',
    quickGame: 'Quick game',
    lobby: 'Lobby',
    playing: 'Playing',
    playersOnline: (n) => (n === 1 ? 'player online' : 'players online'),
    gamesPlaying: (n) => (n === 1 ? 'game in play' : 'games in play'),
    noTv: 'No live games right now.',
    rules: 'Rules',
    source: 'Source code',
  },

  create: {
    friendTitle: 'Play with a friend',
    lobbyTitle: 'Create a game',
    minutes: 'Minutes',
    increment: 'Increment (s)',
    type: 'Type',
    loginForRated: 'Sign in to play rated games',
    createLink: 'Create challenge link',
    create: 'Create game',
  },

  challenge: {
    title: 'Challenge',
    challenger: 'Challenger',
    challengerColor: "challenger's color",
    starts: 'moves first',
    canceled: 'This challenge was canceled.',
    share: 'Send this link to the person you want to challenge. The game starts when they accept.',
    copy: 'Copy',
    copied: 'Copied',
    waiting: 'Waiting for the opponent...',
    cancel: 'Cancel challenge',
    ratedLogin: (
      <>
        This game is rated. <a href="/login">Sign in</a> or <a href="/signup">create an account</a> to accept.
      </>
    ),
    accept: 'Accept challenge',
  },

  auth: {
    username: 'Username',
    password: 'Password',
    passwordHelp: 'At least 8 characters.',
    haveAccount: 'I already have an account',
    playAnonymous: 'Play without an account',
  },

  game: {
    notFound: 'Game not found',
    titleFlash: 'Your turn! · ligungi',
    confirmResign: 'Resign?',
    confirmDraw: 'Offer a draw?',
    confirm: 'Confirm',
    cancel: 'Cancel',
    abort: 'Abort',
    drawOffered: 'Draw offered',
    offerDraw: 'Offer draw',
    resign: 'Resign',
    decline: 'Decline',
    accept: 'Accept',
    opponentOffersDraw: 'Your opponent offers a draw',
    opponentLeft: 'Your opponent left the game.',
    claimVictory: 'Claim victory',
    goToRematch: 'Go to the rematch',
    opponentWantsRematch: 'Your opponent wants a rematch',
    rematchOffered: 'Rematch offered',
    rematch: 'Rematch',
    premove: (move) => `Premove: ${move}. Click the board to cancel.`,
    export: 'Export',
  },

  computer: {
    title: 'Play against the computer',
    strength: 'Strength',
    levels: { 1: 'Level 1 (random)', 2: 'Level 2 (greedy)', 3: 'Level 3 (looks 2 moves ahead)' },
    start: 'Start',
    bot: (level) => `Computer · level ${level}`,
  },

  analysis: {
    title: 'Analysis',
    invalidFen: 'Invalid FEN. Check the pasted text.',
    fromGame: (link: ComponentChildren) => <>Game {link}. New moves create a local variation.</>,
    empty: 'Make a move on the board.',
    newPosition: 'New position',
    pasteFen: 'Paste FEN',
    load: 'Load',
  },

  profile: {
    abortedShort: 'aborted',
    casualShort: 'casual',
    games: (n) => (n === 1 ? 'game' : 'games'),
    memberSince: (date) => `Member since ${date}`,
    wins: (n) => (n === 1 ? 'win' : 'wins'),
    losses: (n) => (n === 1 ? 'loss' : 'losses'),
    draws: (n) => (n === 1 ? 'draw' : 'draws'),
    playingNow: 'Playing now',
    noGames: 'No finished games yet.',
    date: 'Date',
    result: 'Result',
    game: 'Game',
    loadMore: 'Load more',
    rated: () => 'rated',
    follow: 'Follow',
    unfollow: 'Unfollow',
    followers: (n) => (n === 1 ? 'follower' : 'followers'),
    following: 'following',
    rank: (n) => `#${n} on the leaderboard`,
    loginToFollow: 'Sign in to follow players',
    allModes: 'All modes',
    anyColor: 'Any color',
    opponent: 'Opponent',
    filter: 'Filter',
    clearFilters: 'Clear filters',
    noMatch: 'No games match these filters.',
    vsLink: 'Games against this player',
  },

  ranking: {
    title: 'Leaderboard',
    overview: 'Overview',
    top: (n) => `Top ${n}`,
    player: 'Player',
    rating: 'Rating',
    games: 'Games',
    empty: 'Nobody is on this leaderboard yet.',
    rule: 'Players join the leaderboard once their rating is established, after the provisional period (shown with a ? next to the rating).',
  },

  friends: {
    title: 'Friends',
    following: (n) => `Following ${n}`,
    empty: 'You do not follow anyone yet. Open a player profile and click Follow.',
    login: (
      <>
        <a href="/login">Sign in</a> or <a href="/signup">create an account</a> to follow players and see when they are online.
      </>
    ),
    status: 'Status',
    playing: 'Playing',
    watch: 'Watch',
    onlineBox: 'Friends online',
    noneOnline: 'No friends online right now.',
  },

  tv: { empty: 'No games in play right now.' },

  settings: {
    title: 'Preferences',
    language: 'Language',
    auto: 'Automatic',
    pieceNames: 'Piece names',
    pieceNamesLocal: 'English (Lancer, Ninja...)',
    pieceNamesJapanese: 'Japanese (Yari, Shinobi...)',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    boardSize: 'Board size',
    sound: 'Sound',
    on: 'On',
    off: 'Off',
    test: 'Test',
    coordinates: 'Board coordinates',
    show: 'Show',
    hide: 'Hide',
    hoverReach: 'Show reach on hover',
    dontShow: 'Do not show',
    hoverReachHelp: 'When you hover over any piece, including your opponent’s, the squares it can reach are marked.',
    animation: 'Piece animation',
    animationOn: 'On',
    animationOff: 'Off',
    saved: 'Preferences are saved in this browser.',
  },

  trainer: {
    hint: 'Click the piece to see where it can go, and move it freely.',
    level: (n) => `Tier ${n}`,
    enemies: 'Add other pieces (to practice capturing, stacking and the height rule)',
    restart: 'Restart',
  },

  learn: {
    title: 'How to play Gungi',
    lead: 'Gungi (軍儀) is the board game from HUNTER×HUNTER. We use the official rules released in 2022. The full specification, with sources and interpretations, is in the project repository.',
    tryIt: 'Try it',
    objectiveTitle: 'Goal',
    objective: (
      <>
        Capture the opposing Marshal (帥). In practice the game ends in <b>mate</b>: when the player to move has no move
        that keeps their own Marshal safe, they lose, even if the Marshal is not under attack at that moment. A game also
        ends by resignation, time, the same position repeated 4 times (draw) or agreement.
      </>
    ),
    boardTitle: 'Board and pieces',
    board: '9×9 board, 25 pieces per player. The three rows closest to you are your starting territory. Captured pieces leave the game for good.',
    towersTitle: 'Towers (ツケ)',
    towers: [
      'Instead of capturing, you can stack your piece on top of another one, yours or your opponent’s. Towers hold up to 3 pieces (2 in the simpler modes).',
      'Only the top piece moves, and its tier (the tower height) extends its reach: +1 square in each direction at tier 2, +2 at tier 3.',
      'To capture or stack, your piece must be on a tier equal to or higher than the height of the target tower.',
      'When you capture a tower, all of its enemy pieces leave the game; yours stay, with the capturing piece on top.',
      'Nothing can be stacked on the Marshal.',
    ],
    handTitle: 'Pieces in hand (新)',
    hand: 'Pieces you did not place during the draft stay in your hand. On your turn, instead of moving, you can drop one of them on an empty square or on one of your pieces, on any row up to the row of your most advanced piece.',
    setupTitle: 'Setup',
    setup: (
      <>
        In the Introductory and Beginner modes the starting position is fixed. In the Intermediate and Advanced modes the
        players take turns placing pieces in their own territory, starting with the Marshal. A player who does not want to
        place more pieces declares <b>済み (done)</b>. If the first player declares, the second may keep going; when the
        second declares, the draft ends for both. In casual games, whoever creates the game can choose the{' '}
        <b>free draft</b> option, where each player places pieces until declaring done and the draft only ends when both are
        done.
      </>
    ),
    movementTitle: 'How the pieces move',
    tier: (n) => `tier ${n}`,
    notes: {
      marshal: 'If you have no safe move, you lose. Nothing can be stacked on it.',
      general: 'Unlimited straight lines, unaffected by the tier.',
      lieutenant: 'Unlimited diagonals, unaffected by the tier.',
      cannon: 'Jumps forward over towers of equal or lower height.',
      archer: 'Shoots straight ahead and along the forward diagonals, over towers of equal or lower height.',
      musketeer: 'Jumps forward over towers of equal or lower height.',
      tactician: 'Can betray: when stacking on enemy pieces, it swaps all of them for matching pieces from your hand.',
    },
  },
};
