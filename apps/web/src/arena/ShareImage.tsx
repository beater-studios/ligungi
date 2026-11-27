import type { ArenaStanding, ArenaView, TrophyKind } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { useDropdown } from '../core/useDropdown.ts';
import { formatDate, useT, type Messages } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { seasonLabel } from './arena.ts';

const METALS: Record<string, readonly [string, string]> = {
  arenaChampion: ['#f3cd5b', '#b5861c'],
  arenaSecond: ['#e4e7eb', '#959ca5'],
  arenaThird: ['#e3a46c', '#975a2a'],
};
const PLINTH_EDGE: Record<number, string> = { 1: '#f3cd5b', 2: '#c9ced4', 3: '#e3a46c' };
const DISCS: Partial<Record<TrophyKind, number>> = { arenaChampion: 3, arenaSecond: 2, arenaThird: 1 };

/** The same tower of discs as the site's trophy, drawn at `size` with its bottom at `bottom`. */
const drawTrophy = (ctx: CanvasRenderingContext2D, kind: TrophyKind, cx: number, bottom: number, size: number) => {
  const s = size / 64;
  const x = (v: number) => cx + (v - 32) * s;
  const y = (v: number) => bottom + (v - 62) * s;
  const [top, side] = METALS[kind] ?? METALS.arenaChampion!;
  const ellipse = (vx: number, vy: number, rx: number, ry: number, fill: string, alpha = 1) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(x(vx), y(vy), rx * s, ry * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  ellipse(32, 60, 22, 3, '#000', 0.25);
  for (const level of [41.5, 29.5, 17.5].slice(0, DISCS[kind] ?? 3)) {
    ellipse(32, level + 8.5, 24, 8.5, side);
    ctx.fillStyle = side;
    ctx.fillRect(x(8), y(level), 48 * s, 8.5 * s);
    ellipse(32, level, 24, 8.5, top);
    ellipse(25, level - 2, 8, 2.4, '#fff', 0.32);
  }
};

/** Text that fits `max` pixels: the font shrinks until it does. */
const fitText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, weight: number, size: number, family: string) => {
  let px = size;
  ctx.font = `${weight} ${px}px ${family}`;
  while (px > 12 && ctx.measureText(text).width > max) {
    px -= 2;
    ctx.font = `${weight} ${px}px ${family}`;
  }
  ctx.fillText(text, x, y);
};

interface Layout {
  readonly width: number;
  readonly height: number;
  /** Where the podium sits: its center, the width of each step and the floor line. */
  readonly podium: { readonly cx: number; readonly step: number; readonly floor: number; readonly scale: number };
  readonly text: { readonly x: number; readonly align: CanvasTextAlign; readonly lines: readonly number[]; readonly scale: number };
}

const LAYOUTS: Record<'instagram' | 'x', Layout> = {
  instagram: { width: 1080, height: 1350, podium: { cx: 540, step: 300, floor: 1150, scale: 1.15 }, text: { x: 540, align: 'center', lines: [120, 270, 335, 1265], scale: 1 } },
  x: { width: 1200, height: 675, podium: { cx: 880, step: 190, floor: 640, scale: 0.62 }, text: { x: 70, align: 'left', lines: [110, 250, 310, 590], scale: 0.85 } },
};

/** Draws the podium image: the site's name, the Arena and its date, the three steps with trophies and points, and when the next one is. */
const drawPodium = async (t: Messages, view: ArenaView, layout: Layout): Promise<Blob | null> => {
  await document.fonts?.ready;
  const family = getComputedStyle(document.body).fontFamily || "'Noto Sans', sans-serif";
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const glow = ctx.createRadialGradient(layout.podium.cx, layout.height * 0.35, 0, layout.podium.cx, layout.height * 0.35, Math.max(layout.width, layout.height) * 0.8);
  glow.addColorStop(0, '#2b2723');
  glow.addColorStop(1, '#161512');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, layout.width, layout.height);

  const { text } = layout;
  const k = text.scale;
  ctx.textAlign = text.align;
  ctx.textBaseline = 'alphabetic';
  // The site's name, with ".org" in the dimmer color, as in the logo.
  ctx.font = `600 ${Math.round(46 * k)}px ${family}`;
  const name = 'ligungi';
  const org = '.org';
  const full = ctx.measureText(name + org).width;
  const start = text.align === 'center' ? text.x - full / 2 : text.x;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8e6e3';
  ctx.fillText(name, start, text.lines[0]!);
  ctx.fillStyle = '#8f8a83';
  ctx.fillText(org, start + ctx.measureText(name).width, text.lines[0]!);
  ctx.textAlign = text.align;
  ctx.fillStyle = '#e8e6e3';
  ctx.font = `700 ${Math.round(88 * k)}px ${family}`;
  ctx.fillText(t.arena.title, text.x, text.lines[1]!);
  ctx.fillStyle = '#8f8a83';
  fitText(ctx, [formatDate(t, view.startsAt), t.arena.playersCount(view.players), seasonLabel(t, view.season)].join(' · '), text.x, text.lines[2]!, text.align === 'center' ? layout.width - 120 : 400, 400, Math.round(36 * k), family);
  ctx.fillStyle = '#c9c4bd';
  fitText(ctx, t.arena.imageFooter, text.x, text.lines[3]!, text.align === 'center' ? layout.width - 120 : 400, 400, Math.round(32 * k), family);

  const { podium } = layout;
  const p = podium.scale;
  const steps: Array<{ standing: ArenaStanding; offset: number; height: number; trophy: number }> = [];
  const [first, second, third] = view.standings;
  if (second) steps.push({ standing: second, offset: -1, height: 230, trophy: 160 });
  if (first) steps.push({ standing: first, offset: 0, height: 310, trophy: 210 });
  if (third) steps.push({ standing: third, offset: 1, height: 175, trophy: 130 });
  for (const { standing, offset, height, trophy } of steps) {
    const cx = podium.cx + offset * (podium.step + 18 * p);
    const h = height * p;
    const top = podium.floor - h;
    const w = podium.step;
    ctx.fillStyle = '#2e2b28';
    ctx.fillRect(cx - w / 2, top, w, h);
    ctx.fillStyle = PLINTH_EDGE[standing.rank] ?? '#8f8a83';
    ctx.fillRect(cx - w / 2, top, w, 5 * p);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8e6e3';
    ctx.font = `700 ${Math.round(72 * p)}px ${family}`;
    ctx.fillText(String(standing.score), cx, top + h / 2 + 18 * p);
    ctx.fillStyle = '#8f8a83';
    ctx.font = `400 ${Math.round(28 * p)}px ${family}`;
    ctx.fillText(t.arena.points.toLowerCase(), cx, top + h / 2 + 58 * p);
    ctx.fillStyle = '#e8e6e3';
    fitText(ctx, standing.user.name, cx, top - 22 * p, w - 10, 600, Math.round(38 * p), family);
    if (standing.trophy) drawTrophy(ctx, standing.trophy, cx, top - 72 * p, trophy * p);
    else {
      ctx.fillStyle = '#8f8a83';
      ctx.font = `400 ${Math.round(80 * p)}px ${family}`;
      ctx.fillText(String(standing.rank), cx, top - 90 * p);
    }
  }
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
};

/** "Download the podium image": the finished Arena as a picture for Instagram (1080×1350) or X (1200×675), drawn in the browser. */
export const ShareImage = ({ view }: { view: ArenaView }) => {
  const t = useT();
  const a = t.arena;
  // Closes on a click elsewhere, as the header's menus do, and on Escape.
  const { shown: open, setShown: setOpen, ref } = useDropdown();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  const download = async (kind: 'instagram' | 'x') => {
    setBusy(true);
    try {
      const blob = await drawPodium(t, view, LAYOUTS[kind]);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ligungi-arena-${new Date(view.startsAt).toISOString().slice(0, 10)}-${kind}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };
  return (
    <div class="ligungi-share-image" ref={ref}>
      <button type="button" class="button button-empty" data-icon={icons.Download} aria-expanded={open} onClick={() => setOpen(!open)}>
        {a.shareImage}
      </button>
      {open && (
        <span class="ligungi-share-image__menu" role="group" aria-label={a.shareImage}>
          <button type="button" disabled={busy} onClick={() => void download('instagram')}>
            Instagram <small>1080×1350</small>
          </button>
          <button type="button" disabled={busy} onClick={() => void download('x')}>
            X <small>1200×675</small>
          </button>
        </span>
      )}
    </div>
  );
};
