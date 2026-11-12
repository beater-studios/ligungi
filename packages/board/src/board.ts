import {
  ROLE_INFO,
  ROLES,
  actionsOn,
  applyMove,
  findMarshal,
  initialPosition,
  isMarshalAttacked,
  moveToString,
  opposite,
  reachableSquares,
  topOf,
  type Color,
  type Move,
  type Piece,
  type Role,
  type Square,
} from '@ligungi/engine';
import { coordinateLabels, visualSquares } from './geometry.ts';
import { DEFAULT_LABELS, colorLabel, pieceName, type Labels } from './labels.ts';
import type { Api, Config, Selection } from './types.ts';

const DRAG_THRESHOLD = 4;

interface Drag {
  readonly selection: Selection;
  readonly wasSelected: boolean;
  readonly startX: number;
  readonly startY: number;
  ghost: HTMLElement | null;
}

type ChooserOption = { readonly move: Move } | { readonly select: Square };

const DEFAULTS: Config = {
  position: initialPosition('advanced'),
  orientation: 'white',
  movableColor: null,
  moves: [],
  lastMove: null,
  coordinates: true,
  pieceNames: 'pt',
  labels: {},
  onMove: null,
  premoveMoves: [],
  premove: null,
  onPremove: null,
  animation: true,
  handElements: null,
  inspector: true,
  onInspect: null,
  hoverReach: false,
};

const sameSelection = (a: Selection | null, b: Selection | null): boolean =>
  !!a &&
  !!b &&
  (a.kind === 'square'
    ? b.kind === 'square' && a.square === b.square
    : b.kind === 'hand' && a.color === b.color && a.role === b.role);

export class Board implements Api {
  #config: Config;
  #selection: Selection | null = null;
  #chooser: { square: Square; options: ChooserOption[] } | null = null;
  #inspected: Square | null = null;
  #drag: Drag | null = null;
  #lastMoveKey: string | null = null;
  #hover: Square | null = null;
  #reported: Square | null | undefined = undefined;
  #squareEls = new Map<Square, HTMLElement>();
  readonly #root: HTMLElement;
  readonly #wrap: HTMLElement;
  readonly #board: HTMLElement;
  readonly #columns: HTMLElement;
  readonly #rows: HTMLElement;
  readonly #hands: Record<'top' | 'bottom', HTMLElement>;
  readonly #chooserEl: HTMLElement;
  readonly #inspectorEl: HTMLElement;
  readonly #cleanup: Array<() => void> = [];

  constructor(root: HTMLElement, config: Partial<Config> = {}) {
    this.#config = { ...DEFAULTS, ...config };
    this.#lastMoveKey = this.#config.lastMove ? moveToString(this.#config.lastMove) : null;
    this.#root = root;
    const doc = root.ownerDocument;
    const el = (className: string, parent: HTMLElement) => {
      const node = doc.createElement('div');
      node.className = className;
      parent.appendChild(node);
      return node;
    };
    this.#wrap = el('gg-wrap', root);
    const external = this.#config.handElements;
    const top = external?.top ?? el('gg-hand gg-hand-top', this.#wrap);
    const main = el('gg-main', this.#wrap);
    const bottom = external?.bottom ?? el('gg-hand gg-hand-bottom', this.#wrap);
    if (external) {
      top.classList.add('gg-hand', 'gg-hand-top');
      bottom.classList.add('gg-hand', 'gg-hand-bottom');
    }
    this.#hands = { top, bottom };
    this.#columns = el('gg-coords gg-columns', main);
    const boardWrap = el('gg-board-wrap', main);
    this.#rows = el('gg-coords gg-rows', main);
    this.#board = el('gg-board', boardWrap);
    for (const [x, y] of [[1, 1], [1, 2], [2, 1], [2, 2]] as const) {
      const star = el('gg-star', this.#board);
      star.style.left = `${(x * 100) / 3}%`;
      star.style.top = `${(y * 100) / 3}%`;
    }
    this.#chooserEl = el('gg-chooser', boardWrap);
    this.#inspectorEl = el('gg-inspector', boardWrap);
    this.#buildSquares();
    this.#bindEvents();
    this.#render();
  }

  get selection(): Selection | null {
    return this.#selection;
  }

  set(config: Partial<Config>): void {
    const orientationChanged =
      config.orientation !== undefined && config.orientation !== this.#config.orientation;
    this.#config = { ...this.#config, ...config };
    if (config.position || config.moves || config.movableColor !== undefined) {
      this.#selection = null;
      this.#chooser = null;
    }
    if (orientationChanged) this.#buildSquares();
    this.#render();
    const lastMove = this.#config.lastMove;
    const key = lastMove ? moveToString(lastMove) : null;
    if (key !== this.#lastMoveKey) {
      this.#lastMoveKey = key;
      if (lastMove && config.position && !orientationChanged) this.#animate(lastMove);
    }
  }

  toggleOrientation(): void {
    this.set({ orientation: opposite(this.#config.orientation) });
  }

  cancel(): void {
    this.#selection = null;
    this.#chooser = null;
    this.#endDrag();
    this.#render();
  }

  destroy(): void {
    this.#endDrag();
    for (const fn of this.#cleanup) fn();
    this.#root.replaceChildren();
    if (this.#config.handElements) for (const hand of Object.values(this.#hands)) hand.replaceChildren();
  }

  get #labels(): Labels {
    return { ...DEFAULT_LABELS, ...this.#config.labels };
  }

  #canMove(color: Color): boolean {
    const { movableColor, position } = this.#config;
    if (!movableColor || position.turn !== color) return false;
    return movableColor === 'both' || movableColor === color;
  }

  #canPremove(color: Color): boolean {
    const { movableColor, position, premoveMoves } = this.#config;
    return (
      movableColor === color &&
      position.turn !== color &&
      position.phase === 'play' &&
      premoveMoves.length > 0
    );
  }

  #canSelect(color: Color): boolean {
    return this.#canMove(color) || this.#canPremove(color);
  }

  #selectionColor(selection: Selection | null): Color | undefined {
    if (!selection) return undefined;
    if (selection.kind === 'hand') return selection.color;
    return topOf(this.#config.position.board[selection.square]!)?.color;
  }

  #isPremoving(): boolean {
    const color = this.#selectionColor(this.#selection);
    return color !== undefined && color !== this.#config.position.turn;
  }

  #movesFor(selection: Selection | null): Move[] {
    if (!selection) return [];
    const list = this.#isPremoving() ? this.#config.premoveMoves : this.#config.moves;
    return list.filter((move) =>
      selection.kind === 'square'
        ? move.kind === 'move' && move.from === selection.square
        : move.kind === 'drop' && move.role === selection.role,
    );
  }

  #destinations(): Map<Square, Move[]> {
    const dests = new Map<Square, Move[]>();
    for (const move of this.#movesFor(this.#selection)) {
      if (move.kind === 'done') continue;
      dests.set(move.to, [...(dests.get(move.to) ?? []), move]);
    }
    return dests;
  }

  #buildSquares(): void {
    this.#board.querySelectorAll('.gg-sq').forEach((node) => node.remove());
    this.#squareEls.clear();
    const doc = this.#root.ownerDocument;
    for (const square of visualSquares(this.#config.orientation)) {
      const node = doc.createElement('div');
      node.className = 'gg-sq';
      node.dataset.square = String(square);
      this.#board.appendChild(node);
      this.#squareEls.set(square, node);
    }
  }

  #bindEvents(): void {
    const win = this.#root.ownerDocument.defaultView!;
    const on = <K extends keyof HTMLElementEventMap>(
      target: HTMLElement | Window,
      type: K,
      handler: (event: HTMLElementEventMap[K]) => void,
    ) => {
      target.addEventListener(type, handler as EventListener);
      this.#cleanup.push(() => target.removeEventListener(type, handler as EventListener));
    };
    on(this.#board, 'pointerdown', (event) => this.#onBoardDown(event));
    on(this.#board, 'pointerover', (event) => this.#onHover(event));
    on(this.#board, 'pointerleave', () => this.#setHover(null));
    on(this.#board, 'contextmenu', (event) => event.preventDefault());
    for (const hand of Object.values(this.#hands)) on(hand, 'pointerdown', (event) => this.#onHandDown(event));
    on(this.#chooserEl, 'pointerdown', (event) => this.#onChooserDown(event));
    on(win, 'pointermove', (event) => this.#onDragMove(event));
    on(win, 'pointerup', (event) => this.#onDragEnd(event));
    on(win, 'keydown', (event) => {
      if (event.key === 'Escape') this.cancel();
    });
  }

  #squareFromEvent(event: Event): Square | undefined {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('.gg-sq');
    return target ? Number(target.dataset.square) : undefined;
  }

  #onBoardDown(event: PointerEvent): void {
    if (event.button > 0) return;
    const square = this.#squareFromEvent(event);
    if (square === undefined) return;
    event.preventDefault();
    if (this.#chooser) {
      this.#chooser = null;
      this.#render();
      return;
    }
    if (this.#selection && this.#destinations().has(square)) {
      this.#complete(square, false);
      return;
    }
    const top = topOf(this.#config.position.board[square]!);
    if (top && this.#canSelect(top.color)) {
      this.#startSelection({ kind: 'square', square }, event);
      return;
    }
    this.#selection = null;
    if (this.#config.premove) this.#setPremove(null);
    this.#inspected = this.#inspected === square ? null : square;
    this.#render();
  }

  #onHandDown(event: PointerEvent): void {
    if (event.button > 0) return;
    const item = (event.target as HTMLElement | null)?.closest<HTMLElement>('.gg-hand-piece');
    if (!item) return;
    event.preventDefault();
    const color = item.dataset.color as Color;
    const role = item.dataset.role as Role;
    this.#chooser = null;
    if (!this.#canMove(color)) {
      this.#selection = null;
      this.#render();
      return;
    }
    this.#startSelection({ kind: 'hand', color, role }, event);
  }

  #startSelection(selection: Selection, event: PointerEvent | null): void {
    const wasSelected = sameSelection(this.#selection, selection);
    this.#selection = selection;
    this.#inspected = null;
    this.#drag = event
      ? { selection, wasSelected, startX: event.clientX, startY: event.clientY, ghost: null }
      : null;
    this.#render();
  }

  #onDragMove(event: PointerEvent): void {
    const drag = this.#drag;
    if (!drag) return;
    if (!drag.ghost) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD) return;
      const piece = this.#selectedPiece();
      if (!piece) return;
      const size = this.#board.getBoundingClientRect().width / 9;
      const ghost = this.#root.ownerDocument.createElement('div');
      ghost.className = 'gg-ghost';
      ghost.style.width = ghost.style.height = `${size}px`;
      ghost.innerHTML = this.#pieceHtml(piece, 'gg-top');
      this.#wrap.appendChild(ghost);
      drag.ghost = ghost;
      this.#wrap.classList.add('gg-dragging');
      this.#inspected = null;
      this.#render();
    }
    drag.ghost.style.transform = `translate(${event.clientX}px, ${event.clientY}px) translate(-50%, -50%)`;
  }

  #onDragEnd(event: PointerEvent): void {
    const drag = this.#drag;
    if (!drag) return;
    this.#drag = null;
    if (drag.ghost) {
      const under = this.#root.ownerDocument.elementFromPoint(event.clientX, event.clientY);
      const target = under?.closest<HTMLElement>('.gg-sq');
      this.#endDrag(drag);
      const square = target && this.#board.contains(target) ? Number(target.dataset.square) : undefined;
      if (square !== undefined && this.#destinations().has(square)) {
        this.#complete(square, true);
        return;
      }
      if (!(drag.selection.kind === 'square' && square === drag.selection.square)) this.#selection = null;
      this.#render();
      return;
    }
    if (drag.wasSelected) {
      this.#selection = null;
      this.#render();
    }
  }

  #endDrag(drag: Drag | null = this.#drag): void {
    drag?.ghost?.remove();
    this.#wrap.classList.remove('gg-dragging');
    if (drag === this.#drag) this.#drag = null;
  }

  #onChooserDown(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const button = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-option]');
    const chooser = this.#chooser;
    if (!button || !chooser) return;
    const option = chooser.options[Number(button.dataset.option)];
    if (!option) return;
    this.#chooser = null;
    if ('select' in option) this.#startSelection({ kind: 'square', square: option.select }, null);
    else this.#commit(option.move, false);
  }

  #onHover(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' || this.#drag?.ghost) return;
    const square = this.#squareFromEvent(event);
    this.#setHover(square ?? null);
  }

  #setHover(square: Square | null): void {
    if (square === this.#hover && square === this.#inspected) return;
    this.#hover = square;
    this.#inspected = square;
    this.#renderInspector();
  }

  /** Tells the page which tower to show: the hovered or tapped one, else the selected one. */
  #notifyInspect(): void {
    const selected = this.#selection?.kind === 'square' ? this.#selection.square : null;
    const target = this.#inspected ?? selected;
    if (target === this.#reported) return;
    this.#reported = target;
    this.#config.onInspect?.(target);
  }

  #renderReach(): void {
    const marks = new Set<Square>();
    const { position, hoverReach } = this.#config;
    const square = this.#hover;
    if (hoverReach && square !== null && !this.#selection && !this.#drag) {
      const tower = position.board[square]!;
      const piece = topOf(tower);
      if (piece) {
        for (const to of reachableSquares(position, square)) {
          if (actionsOn(position, piece, tower.length, to).length) marks.add(to);
        }
      }
    }
    for (const [sq, node] of this.#squareEls) node.classList.toggle('gg-reach', marks.has(sq));
  }

  #complete(square: Square, viaDrag: boolean): void {
    const options: ChooserOption[] = (this.#destinations().get(square) ?? []).map((move) => ({ move }));
    const target = topOf(this.#config.position.board[square]!);
    if (!viaDrag && target && target.color === this.#selectionColor(this.#selection) && this.#canSelect(target.color)) {
      options.push({ select: square });
    }
    const only = options.length === 1 ? options[0] : undefined;
    if (only && 'move' in only) {
      this.#commit(only.move, viaDrag);
    } else if (options.length > 1) {
      this.#chooser = { square, options };
      this.#render();
    }
  }

  #commit(move: Move, viaDrag: boolean): void {
    if (this.#isPremoving()) this.#setPremove(move);
    else this.#play(move, !viaDrag);
  }

  #setPremove(move: Move | null): void {
    this.#config = { ...this.#config, premove: move };
    this.#selection = null;
    this.#chooser = null;
    this.#render();
    this.#config.onPremove?.(move);
  }

  #play(move: Move, animate: boolean): void {
    const position = applyMove(this.#config.position, move);
    this.#config = { ...this.#config, position, moves: [], lastMove: move };
    this.#lastMoveKey = moveToString(move);
    this.#selection = null;
    this.#chooser = null;
    this.#inspected = null;
    this.#render();
    if (animate) this.#animate(move);
    this.#config.onMove?.(move);
  }

  #animate(move: Move): void {
    if (!this.#config.animation || move.kind !== 'move') return;
    const from = this.#squareEls.get(move.from);
    const to = this.#squareEls.get(move.to);
    const piece = to?.querySelector<HTMLElement>('.gg-piece.gg-top');
    if (!from || !to || !piece) return;
    const a = from.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    const dx = a.left - b.left;
    const dy = a.top - b.top;
    if (!dx && !dy) return;
    piece.style.transition = 'none';
    piece.style.translate = `${dx}px ${dy}px`;
    piece.style.zIndex = '10';
    void piece.offsetWidth;
    piece.style.transition = 'translate 0.18s ease-out';
    piece.style.translate = '0px 0px';
    piece.addEventListener(
      'transitionend',
      () => {
        piece.style.zIndex = '';
        piece.style.transition = '';
      },
      { once: true },
    );
  }

  #selectedPiece(): Piece | undefined {
    const selection = this.#selection;
    if (!selection) return undefined;
    if (selection.kind === 'hand') return { role: selection.role, color: selection.color };
    return topOf(this.#config.position.board[selection.square]!);
  }

  #pieceHtml(piece: Piece, extra: string, level = 0): string {
    const flipped = piece.color !== this.#config.orientation ? ' gg-flipped' : '';
    return `<div class="gg-piece gg-${piece.color}${flipped} ${extra}" style="--level:${level}"><span>${ROLE_INFO[piece.role].kanji}</span></div>`;
  }

  #towerHtml(square: Square): string {
    const tower = this.#config.position.board[square]!;
    if (tower.length === 0) return '';
    const pieces = tower
      .map((piece, level) => this.#pieceHtml(piece, level === tower.length - 1 ? 'gg-top' : 'gg-under', level))
      .join('');
    const badge = tower.length > 1 ? `<span class="gg-height">${tower.length}</span>` : '';
    return `<div class="gg-tower" style="--height:${tower.length}">${pieces}${badge}</div>`;
  }

  #squareTitle(square: Square): string {
    const tower = this.#config.position.board[square]!;
    const top = topOf(tower);
    if (!top) return '';
    const labels = this.#labels;
    return `${pieceName(top.role, this.#config.pieceNames)} (${colorLabel(top.color, labels)})${tower.length > 1 ? `, ${labels.tower} ${tower.length}` : ''}`;
  }

  #render(): void {
    const { position, lastMove, coordinates, orientation, premove } = this.#config;
    const dests = this.#destinations();
    const lastSquares = new Set<Square>();
    if (lastMove && lastMove.kind !== 'done') {
      lastSquares.add(lastMove.to);
      if (lastMove.kind === 'move') lastSquares.add(lastMove.from);
    }
    const premoveSquares = new Set<Square>();
    if (premove && premove.kind !== 'done') {
      premoveSquares.add(premove.to);
      if (premove.kind === 'move') premoveSquares.add(premove.from);
    }
    const marshal =
      position.phase === 'play' && isMarshalAttacked(position, position.turn)
        ? findMarshal(position, position.turn)
        : undefined;
    const dragging = this.#drag?.ghost && this.#selection?.kind === 'square' ? this.#selection.square : undefined;
    const premoving = this.#isPremoving();

    this.#wrap.dataset.orientation = orientation;
    this.#wrap.classList.toggle('gg-has-coords', coordinates);
    for (const [square, node] of this.#squareEls) {
      const occupied = position.board[square]!.length > 0;
      const classes = ['gg-sq'];
      if (lastSquares.has(square)) classes.push('gg-last');
      if (premoveSquares.has(square)) classes.push('gg-premove');
      if (this.#selection?.kind === 'square' && this.#selection.square === square) classes.push('gg-selected');
      if (dests.has(square)) classes.push(occupied ? 'gg-dest-occupied' : 'gg-dest', ...(premoving ? ['gg-pre'] : []));
      if (marshal === square) classes.push('gg-check');
      if (dragging === square) classes.push('gg-drag-origin');
      node.className = classes.join(' ');
      node.innerHTML = this.#towerHtml(square);
      node.title = this.#squareTitle(square);
    }

    const { columns, rows } = coordinateLabels(orientation);
    this.#columns.innerHTML = coordinates ? columns.map((c) => `<span>${c}</span>`).join('') : '';
    this.#rows.innerHTML = coordinates ? rows.map((r) => `<span>${r}</span>`).join('') : '';
    this.#renderHand('bottom', orientation);
    this.#renderHand('top', opposite(orientation));
    this.#renderChooser();
    this.#renderInspector();
  }

  #renderHand(slot: 'top' | 'bottom', color: Color): void {
    const hand = this.#config.position.hands[color];
    const selection = this.#selection;
    const active = this.#canMove(color);
    const labels = this.#labels;
    const node = this.#hands[slot];
    node.dataset.color = color;
    node.classList.toggle('gg-hand-active', active);
    node.setAttribute('aria-label', `${labels.hand} (${colorLabel(color, labels)})`);
    node.innerHTML = ROLES.filter((role) => hand[role] > 0)
      .map((role) => {
        const selected =
          selection?.kind === 'hand' && selection.color === color && selection.role === role ? ' gg-selected' : '';
        const count = hand[role] > 1 ? `<span class="gg-count">${hand[role]}</span>` : '';
        const title = pieceName(role, this.#config.pieceNames);
        return `<div class="gg-hand-piece${selected}" data-color="${color}" data-role="${role}" title="${title}">${this.#pieceHtml({ role, color }, 'gg-top')}${count}</div>`;
      })
      .join('');
  }

  #anchor(square: Square): { column: number; row: number } {
    const index = visualSquares(this.#config.orientation).indexOf(square);
    return { column: index % 9, row: Math.floor(index / 9) };
  }

  #renderChooser(): void {
    const chooser = this.#chooser;
    const node = this.#chooserEl;
    if (!chooser) {
      node.hidden = true;
      node.innerHTML = '';
      return;
    }
    const labels = this.#labels;
    const describe = (option: ChooserOption): [string, string] => {
      if ('select' in option) return ['選', labels.select];
      const move = option.move;
      if (move.kind === 'done') return ['', ''];
      if (move.betray?.length) return ['返', labels.betray];
      if (move.kind === 'drop') return ['新', labels.drop];
      return move.action === 'capture' ? ['取', labels.capture] : ['付', labels.stack];
    };
    node.innerHTML = chooser.options
      .map((option, index) => {
        const [kanji, text] = describe(option);
        return `<button type="button" data-option="${index}"><b>${kanji}</b>${text}</button>`;
      })
      .join('');
    const { column, row } = this.#anchor(chooser.square);
    node.style.left = `${((column + 0.5) * 100) / 9}%`;
    node.style.top = `${((row >= 6 ? row : row + 1) * 100) / 9}%`;
    node.classList.toggle('gg-above', row >= 6);
    node.hidden = false;
  }

  #renderInspector(): void {
    this.#notifyInspect();
    this.#renderReach();
    const square = this.#chooser ? null : this.#inspected;
    const tower = square === null ? [] : this.#config.position.board[square]!;
    const node = this.#inspectorEl;
    if (!this.#config.inspector || square === null || tower.length < 2) {
      node.hidden = true;
      node.innerHTML = '';
      return;
    }
    const labels = this.#labels;
    const items = [...tower]
      .map((piece, level) => ({ piece, level }))
      .reverse()
      .map(
        ({ piece, level }) =>
          `<li>${this.#pieceHtml(piece, 'gg-top')}<span class="gg-name">${pieceName(piece.role, this.#config.pieceNames)}</span><span class="gg-level">${labels.level} ${level + 1}</span></li>`,
      )
      .join('');
    node.innerHTML = `<div class="gg-inspector-title">${labels.tower} (${tower.length})</div><ol>${items}</ol>`;
    const { column, row } = this.#anchor(square);
    const right = column >= 5;
    node.style.left = `${((right ? column : column + 1) * 100) / 9}%`;
    node.style.top = `${(row * 100) / 9}%`;
    node.classList.toggle('gg-left', right);
    node.hidden = false;
  }
}
