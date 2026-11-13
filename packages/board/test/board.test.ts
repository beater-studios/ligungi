import { afterEach, describe, expect, it } from 'vitest';
import { ROLES, initialPosition, legalMoves, moveToString, type Move, type Position } from '@ligungi/engine';
import { Gungiground, PIECE_ICONS, guidesSvg, type Api } from '../src/index.ts';
import { build, sq } from '../../engine/test/helpers.ts';

let api: Api | undefined;
let root: HTMLElement;

afterEach(() => {
  api?.destroy();
  root?.remove();
  api = undefined;
});

const mount = (position: Position, extra: Parameters<typeof Gungiground>[1] = {}) => {
  root = document.createElement('div');
  document.body.appendChild(root);
  const played: Move[] = [];
  api = Gungiground(root, {
    position,
    moves: legalMoves(position),
    movableColor: 'both',
    onMove: (move) => played.push(move),
    ...extra,
  });
  return played;
};

const press = (target: Element) => {
  for (const type of ['pointerdown', 'pointerup']) {
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: 0, clientY: 0 }));
  }
};

const squareEl = (name: string) => root.querySelector(`.gg-sq[data-square="${sq(name)}"]`)!;
const click = (name: string) => press(squareEl(name));

describe('Gungiground', () => {
  it('renders 81 squares, rulebook coordinates and both hands', () => {
    mount(initialPosition('intro'));
    expect(root.querySelectorAll('.gg-sq')).toHaveLength(81);
    expect([...root.querySelectorAll('.gg-columns span')].map((n) => n.textContent).join('')).toBe('987654321');
    expect([...root.querySelectorAll('.gg-rows span')].map((n) => n.textContent).join('')).toBe('123456789');
    expect(root.querySelectorAll('.gg-hand-bottom .gg-hand-piece')).toHaveLength(4);
    expect(squareEl('e1').textContent).toBe('帥');
    expect(squareEl('e9').querySelector('.gg-flipped')).not.toBeNull();
  });

  it('selects a piece, shows destinations and plays a move', () => {
    const played = mount(build({ e5: 'S' }));
    click('e5');
    expect(squareEl('e5').classList.contains('gg-selected')).toBe(true);
    expect(root.querySelectorAll('.gg-dest')).toHaveLength(4);
    click('e6');
    expect(played.map(moveToString)).toEqual(['e5e6']);
    expect(squareEl('e6').textContent).toBe('侍');
    expect(squareEl('e5').classList.contains('gg-last')).toBe(true);
  });

  it('deselects when the selected piece is clicked again', () => {
    mount(build({ e5: 'S' }));
    click('e5');
    click('e5');
    expect(root.querySelector('.gg-selected')).toBeNull();
  });

  it('ignores pieces of the side that may not move', () => {
    mount(build({ e5: 'S', d7: 'p' }), { movableColor: 'white' });
    click('d7');
    expect(root.querySelector('.gg-selected')).toBeNull();
  });

  it('asks whether to capture or stack and plays the chosen move', () => {
    const played = mount(build({ e5: 'P', e6: 'p' }));
    click('e5');
    expect(squareEl('e6').classList.contains('gg-dest-occupied')).toBe(true);
    click('e6');
    const buttons = [...root.querySelectorAll('.gg-chooser button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['取Capturar', '付Empilhar']);
    press(buttons[1]!);
    expect(played.map(moveToString)).toEqual(['e5e6=']);
    expect(squareEl('e6').querySelector('.gg-height')?.textContent).toBe('2');
  });

  it('offers betrayal when the tactician can turn a tower', () => {
    mount(build({ e5: 'PT', f6: 'p' }, { hands: { white: { soldier: 1 } } }));
    click('e5');
    click('f6');
    const labels = [...root.querySelectorAll('.gg-chooser button')].map((b) => b.textContent);
    expect(labels).toContain('返Trair');
  });

  it('drops a piece from the hand', () => {
    const played = mount(build({ e1: 'M', c3: 'P' }, { hands: { white: { spy: 1 } } }));
    press(root.querySelector('.gg-hand-bottom .gg-hand-piece[data-role="spy"]')!);
    expect(root.querySelectorAll('.gg-dest').length).toBeGreaterThan(20);
    expect(squareEl('d4').classList.contains('gg-dest')).toBe(false);
    click('d3');
    expect(played.map(moveToString)).toEqual(['Y*d3']);
  });

  it('flips the board for Black', () => {
    mount(initialPosition('intro'), { orientation: 'black' });
    expect(root.querySelector('.gg-sq')!.getAttribute('data-square')).toBe(String(sq('i1')));
    expect([...root.querySelectorAll('.gg-columns span')].map((n) => n.textContent).join('')).toBe('123456789');
    api!.toggleOrientation();
    expect(root.querySelector('.gg-sq')!.getAttribute('data-square')).toBe(String(sq('a9')));
  });

  it('lists the pieces of a tower, top first', () => {
    mount(build({ e5: 'Pp', a3: 'P' }, { turn: 'white' }), { movableColor: 'white' });
    click('e5');
    const inspector = root.querySelector('.gg-inspector')!;
    expect(inspector.hasAttribute('hidden')).toBe(false);
    expect([...inspector.querySelectorAll('.gg-name')].map((n) => n.textContent)).toEqual(['Soldado', 'Soldado']);
    expect([...inspector.querySelectorAll('.gg-level')].map((n) => n.textContent)).toEqual(['nível 2', 'nível 1']);
  });

  it('uses Japanese names when configured', () => {
    mount(build({ e5: 'Pp' }), { movableColor: null, pieceNames: 'ja' });
    click('e5');
    expect(root.querySelector('.gg-inspector .gg-name')!.textContent).toBe('Hyō');
  });

  it('asks whether to stack or select when clicking an own piece in range', () => {
    const played = mount(build({ e5: 'P', e6: 'S' }));
    click('e5');
    click('e6');
    const buttons = [...root.querySelectorAll('.gg-chooser button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['付Empilhar', '選Selecionar']);
    press(buttons[1]!);
    expect(played).toEqual([]);
    expect(squareEl('e6').classList.contains('gg-selected')).toBe(true);
    click('e5');
    expect(root.querySelector('.gg-chooser button')?.textContent).toBe('付Empilhar');
  });

  it('queues a premove while the opponent is thinking and cancels it on an empty click', () => {
    const position = build({ e5: 'S', d7: 'p' }, { turn: 'black' });
    const premoves: Array<string | null> = [];
    mount(position, {
      movableColor: 'white',
      moves: legalMoves(position),
      premoveMoves: legalMoves({ ...position, turn: 'white' }),
      onPremove: (move) => premoves.push(move && moveToString(move)),
    });
    click('e5');
    expect(root.querySelectorAll('.gg-dest.gg-pre').length).toBeGreaterThan(0);
    click('e6');
    expect(premoves).toEqual(['e5e6']);
    expect(squareEl('e6').classList.contains('gg-premove')).toBe(true);
    click('a5');
    expect(premoves).toEqual(['e5e6', null]);
    expect(root.querySelector('.gg-premove')).toBeNull();
  });

  it('reports the tower being looked at, for a fixed side panel', () => {
    const inspected: Array<number | null> = [];
    mount(build({ e5: 'S', d7: 'pp' }), { movableColor: 'white', inspector: false, onInspect: (sq) => inspected.push(sq) });
    click('e5');
    click('d7');
    expect(inspected).toContain(sq('e5'));
    expect(inspected[inspected.length - 1]).toBe(sq('d7'));
    expect(root.querySelector('.gg-inspector')!.hasAttribute('hidden')).toBe(true);
  });

  it('shows the reach of a hovered opponent piece when enabled', () => {
    mount(build({ e5: 'S', e7: 'p' }), { movableColor: 'white', hoverReach: true });
    const event = new MouseEvent('pointerover', { bubbles: true });
    Object.defineProperty(event, 'pointerType', { value: 'mouse' });
    squareEl('e7').dispatchEvent(event);
    expect(squareEl('e6').classList.contains('gg-reach')).toBe(true);
    expect(squareEl('e8').classList.contains('gg-reach')).toBe(true);
    expect(squareEl('d6').classList.contains('gg-reach')).toBe(false);
  });

  it('marks the attacked marshal', () => {
    mount(build({ e1: 'M', e9: 'g', a9: 'm' }));
    expect(squareEl('e1').classList.contains('gg-check')).toBe(true);
  });
});

describe('movement guides', () => {
  const count = (svg: string, pattern: RegExp) => (svg.match(pattern) ?? []).length;
  const dots = (svg: string) => count(svg, /r="3\.6"/g);
  const arrows = (svg: string) => count(svg, /<polygon/g);
  const rings = (svg: string) => count(svg, /fill="none"/g);
  const ticks = (svg: string) => count(svg, /r="1\.8"/g);

  it('draws each role from the engine rules', () => {
    expect([dots(guidesSvg('marshal')), arrows(guidesSvg('marshal'))]).toEqual([8, 0]);
    expect([dots(guidesSvg('general')), arrows(guidesSvg('general'))]).toEqual([4, 4]);
    expect(dots(guidesSvg('lancer'))).toBe(5);
    expect(dots(guidesSvg('spy'))).toBe(8);
    expect([ticks(guidesSvg('cannon')), rings(guidesSvg('cannon')), dots(guidesSvg('cannon'))]).toEqual([2, 1, 3]);
    expect([ticks(guidesSvg('archer')), rings(guidesSvg('archer')), dots(guidesSvg('archer'))]).toEqual([1, 3, 1]);
  });

  it('draws the illustrated style with an icon instead of the kanji, with or without guides', () => {
    mount(initialPosition('beginner'), { pieceStyle: 'illustrated' });
    const piece = root.querySelector('.gg-sq .gg-piece.gg-top')!;
    expect(piece.classList.contains('gg-illustrated')).toBe(true);
    expect(piece.querySelector('svg.gg-icon')).not.toBeNull();
    expect(piece.textContent).toBe('');
    const plain = piece.querySelector('svg.gg-icon')!.innerHTML;
    api!.set({ moveGuides: true });
    const guided = root.querySelector('.gg-sq .gg-piece.gg-top svg.gg-icon')!.innerHTML;
    expect(guided.length).toBeGreaterThan(plain.length);
    expect(guided).not.toContain('scale(');
  });

  it('has an icon for every role', () => {
    for (const role of ROLES) expect(PIECE_ICONS[role].length).toBeGreaterThan(20);
  });

  it('renders the guides only when turned on', () => {
    mount(initialPosition('beginner'));
    expect(root.querySelector('.gg-guided')).toBeNull();
    api!.set({ moveGuides: true });
    expect(root.querySelectorAll('.gg-piece.gg-guided .gg-guides').length).toBeGreaterThan(0);
    expect(root.querySelector('.gg-guided span')!.textContent).toMatch(/[一-鿿]/);
  });
});
