"""Frames of the animated Discord emojis and stickers, as one SVG per frame.

Usage: python3 frames.py <out-dir>. Writes <out-dir>/<name>/NNNN.svg and <out-dir>/manifest.json. Each frame is
then rendered to a transparent PNG with the kanji font loaded as `ligungi kanji serif` (see ../README.md), and the
PNGs are joined into a GIF (emojis) or an APNG (stickers).
"""

import json
import math
import os
import sys

KANJI = "'ligungi kanji serif','Hiragino Mincho ProN','Yu Mincho','Noto Serif JP',serif"
SANS = "'Noto Sans','Helvetica Neue',Arial,sans-serif"
INK_WHITE, INK_BLACK = "#1b1b1b", "#f4f1ea"

DEFS = """<defs>
  <radialGradient id="w" cx="50%" cy="42%" r="58%"><stop offset="0" stop-color="#fff"/><stop offset=".62" stop-color="#f6f1e7"/><stop offset="1" stop-color="#cfc6b5"/></radialGradient>
  <radialGradient id="b" cx="50%" cy="42%" r="58%"><stop offset="0" stop-color="#3a3a3a"/><stop offset=".62" stop-color="#232323"/><stop offset="1" stop-color="#000"/></radialGradient>
</defs>"""


def clamp(x):
    return max(0.0, min(1.0, x))


def seg(t, a, b):
    return clamp((t - a) / (b - a))


def ease_out(x):
    return 1 - (1 - x) ** 3


def ease_in_out(x):
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def bounce(x):
    n, d = 7.5625, 2.75
    if x < 1 / d:
        return n * x * x
    if x < 2 / d:
        x -= 1.5 / d
        return n * x * x + 0.75
    if x < 2.5 / d:
        x -= 2.25 / d
        return n * x * x + 0.9375
    x -= 2.625 / d
    return n * x * x + 0.984375


def svg(size, body, defs=DEFS):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">\n{defs}\n{body}\n</svg>\n'


def disc(cx, cy, r, color="w", kanji=None, size=None, sx=1.0, rotate=0.0, opacity=1.0):
    border = "rgba(0,0,0,.45)" if color == "w" else "rgba(0,0,0,.85)"
    ink = INK_WHITE if color == "w" else INK_BLACK
    size = size or r * 1.28
    body = f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#{color})" stroke="{border}" stroke-width="{max(2.5, r / 24):.1f}"/>'
    if kanji:
        body += (f'<text x="{cx}" y="{cy + size * 0.04:.1f}" font-family="{KANJI}" font-weight="700" font-size="{size:.1f}" '
                 f'fill="{ink}" text-anchor="middle" dominant-baseline="central">{kanji}</text>')
    transform = f"translate({cx} {cy}) rotate({rotate:.2f}) scale({max(abs(sx), 0.02):.4f} 1) translate({-cx} {-cy})"
    return f'<g transform="{transform}" opacity="{opacity:.3f}">{body}</g>'


def side(y, color, scale=1.0, cx=64):
    face, edge = ("#f6f1e7", "#cfc6b5") if color == "w" else ("#3a3a3a", "#111")
    rx, ry, h = 56 * scale, 15 * scale, 14 * scale
    return (f'<path d="M{cx - rx} {y} v{h} a{rx} {ry} 0 0 0 {2 * rx} 0 v{-h}" fill="{edge}" stroke="rgba(0,0,0,.5)" stroke-width="2"/>'
            f'<ellipse cx="{cx}" cy="{y}" rx="{rx}" ry="{ry}" fill="{face}" stroke="rgba(0,0,0,.5)" stroke-width="2"/>')


def stamp(cx, cy, w, text, color, size, scale=1.0, rotate=-8.0, opacity=1.0, round_shape=False):
    if round_shape:
        shape = (f'<circle cx="{cx}" cy="{cy}" r="{w / 2}" fill="{color}" stroke="rgba(0,0,0,.35)" stroke-width="3"/>'
                 f'<circle cx="{cx}" cy="{cy}" r="{w / 2 - w * 0.07}" fill="none" stroke="#fff" stroke-width="{w * 0.03:.1f}" opacity=".85"/>')
    else:
        shape = (f'<rect x="{cx - w / 2}" y="{cy - w / 2}" width="{w}" height="{w}" rx="{w * 0.16}" fill="{color}" stroke="rgba(0,0,0,.35)" stroke-width="3"/>'
                 f'<rect x="{cx - w / 2 + w * 0.08}" y="{cy - w / 2 + w * 0.08}" width="{w * 0.84}" height="{w * 0.84}" rx="{w * 0.1}" fill="none" stroke="#fff" stroke-width="{w * 0.03:.1f}" opacity=".85"/>')
    label = (f'<text x="{cx}" y="{cy + size * 0.05:.1f}" font-family="{KANJI}" font-weight="700" font-size="{size}" fill="#fff" '
             f'text-anchor="middle" dominant-baseline="central">{text}</text>')
    transform = f"translate({cx} {cy}) rotate({rotate}) scale({scale:.4f}) translate({-cx} {-cy})"
    return f'<g transform="{transform}" opacity="{opacity:.3f}">{shape}{label}</g>'


def caption(text, y, size=46, opacity=1.0, scale=1.0, cx=160):
    transform = f"translate({cx} {y}) scale({scale:.4f}) translate({-cx} {-y})"
    return (f'<g transform="{transform}" opacity="{opacity:.3f}"><text x="{cx}" y="{y}" font-family="{SANS}" font-weight="800" font-size="{size}" '
            f'fill="#fff" stroke="#1b1b1b" stroke-width="{size * 0.22:.1f}" stroke-linejoin="round" paint-order="stroke" '
            f'text-anchor="middle" dominant-baseline="central" letter-spacing="1">{text}</text></g>')


def clock(cx, cy, r, remaining=None, hand=None):
    """A clock face. `remaining` (0 to 1) draws the red sector of time left; `hand` is the hand's angle in degrees."""
    body = f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#w)" stroke="#1b1b1b" stroke-width="{r * 0.07:.1f}"/>'
    if remaining is not None and remaining > 0.002:
        angle = 360 * remaining
        end = math.radians(angle - 90)
        ex, ey = cx + (r - 6) * math.cos(end), cy + (r - 6) * math.sin(end)
        large = 1 if angle > 180 else 0
        body += f'<path d="M{cx} {cy} L{cx} {cy - r + 6} A{r - 6} {r - 6} 0 {large} 1 {ex:.2f} {ey:.2f} Z" fill="#d62828" opacity=".85"/>'
        hand = angle
    for i in range(12):
        a = math.radians(i * 30 - 90)
        x1, y1 = cx + (r - 5) * math.cos(a), cy + (r - 5) * math.sin(a)
        x2, y2 = cx + (r - 5 - r * 0.14) * math.cos(a), cy + (r - 5 - r * 0.14) * math.sin(a)
        body += f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="#1b1b1b" stroke-width="{r * 0.05:.1f}" stroke-linecap="round"/>'
    if hand is not None:
        a = math.radians(hand - 90)
        hx, hy = cx + (r * 0.78) * math.cos(a), cy + (r * 0.78) * math.sin(a)
        body += f'<line x1="{cx}" y1="{cy}" x2="{hx:.2f}" y2="{hy:.2f}" stroke="#1b1b1b" stroke-width="{r * 0.09:.1f}" stroke-linecap="round"/>'
    body += f'<circle cx="{cx}" cy="{cy}" r="{r * 0.09:.1f}" fill="#1b1b1b"/>'
    return body


LOGO_LAYERS = [
    '<ellipse cx="32" cy="50" rx="26" ry="9" fill="#1d1d1d"/><rect x="6" y="41" width="52" height="9" fill="#1d1d1d"/><ellipse cx="32" cy="41" rx="26" ry="9" fill="#3a3a3a"/>',
    '<ellipse cx="32" cy="38" rx="26" ry="9" fill="#efe8da"/><rect x="6" y="29" width="52" height="9" fill="#efe8da"/><ellipse cx="32" cy="29" rx="26" ry="9" fill="#d9cfbd"/>',
    '<ellipse cx="32" cy="26" rx="26" ry="9" fill="#b8322f"/><rect x="6" y="17" width="52" height="9" fill="#b8322f"/><ellipse cx="32" cy="17" rx="26" ry="9" fill="#d8443f"/>'
    f'<text x="32" y="22" font-size="13" text-anchor="middle" fill="#fff7ee" font-family="{KANJI}" font-weight="700">軍</text>',
]


def logo(offsets, scale, tx=0, ty=0, outline=True):
    """The site's logo, one group per layer, each moved up by its offset (in logo units)."""
    edge = '<path d="M6 17 v33 a26 9 0 0 0 52 0 v-33 a26 9 0 0 0 -52 0" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="1.2"/>' if outline and all(o == 0 for o in offsets) else ""
    layers = "".join(f'<g transform="translate(0 {-o:.2f})">{layer}</g>' for layer, o in zip(LOGO_LAYERS, offsets) if o < 90)
    return f'<g transform="translate({tx} {ty}) scale({scale})">{edge}{layers}</g>'


# Emojis, 128 px.

def stack(t):
    body = ""
    for i, (y_end, color) in enumerate([(92, "b"), (64, "w"), (36, "w")]):
        start = 0.04 + i * 0.17
        if t < start:
            continue
        y = -30 + (y_end + 30) * bounce(seg(t, start, start + 0.17))
        body += side(y, color)
        if i == 2:
            body += (f'<text x="64" y="{y + 2:.1f}" font-family="{KANJI}" font-weight="700" font-size="26" fill="{INK_WHITE}" '
                     'text-anchor="middle" dominant-baseline="central">兵</text>')
    return svg(128, f'<g opacity="{1 - seg(t, 0.88, 0.98):.3f}">{body}</g>')


def flip(t):
    a = math.pi * ease_in_out(seg(t, 0.12, 0.38)) + math.pi * ease_in_out(seg(t, 0.62, 0.88))
    sx = math.cos(a)
    return svg(128, disc(64, 64, 59, "w" if sx >= 0 else "b", "兵", 76, sx=sx))


def dropping(t):
    p = bounce(seg(t, 0.04, 0.42))
    cy = -40 + (84 + 40) * p
    fade = 1 - seg(t, 0.86, 0.97)
    board = ('<rect x="10" y="66" width="108" height="58" rx="6" fill="#e3c389" stroke="#9a7a3e" stroke-width="2.5"/>'
             '<path d="M46 66 v58 M82 66 v58 M10 95 h108" stroke="rgba(60,40,15,.55)" stroke-width="2"/>')
    shadow = f'<ellipse cx="64" cy="100" rx="{8 + 20 * p:.1f}" ry="{2 + 5 * p:.1f}" fill="rgba(0,0,0,{0.1 + 0.25 * p:.2f})"/>'
    return svg(128, board + f'<g opacity="{fade:.3f}">{shadow}{disc(64, cy, 32, "w", "新", 44)}</g>')


def check_pulse(t):
    k = 0.5 - 0.5 * math.cos(2 * math.pi * t)
    glow = (f'<radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset=".7" stop-color="#d62828" stop-opacity="{0.55 + 0.45 * k:.2f}"/>'
            '<stop offset="1" stop-color="#d62828" stop-opacity="0"/></radialGradient>')
    r = 50 + 13 * k
    return svg(128, f'<circle cx="64" cy="64" r="{r:.1f}" fill="url(#g)"/>' + disc(64, 64, 46, "w", "帥", 62),
               DEFS.replace("</defs>", glow + "</defs>"))


def done_stamp(t):
    p = ease_out(seg(t, 0.0, 0.14))
    shake = 3 * math.sin(seg(t, 0.14, 0.26) * math.pi * 4) * (1 - seg(t, 0.14, 0.26))
    opacity = seg(t, 0.0, 0.06) * (1 - seg(t, 0.86, 0.97))
    return svg(128, f'<g transform="translate({shake:.2f} 0)">'
                    + stamp(64, 64, 104, "済", "#c8312b", 72, scale=1.8 - 0.8 * p, opacity=opacity) + '</g>')


def flag(t):
    remaining = 1 - seg(t, 0.0, 0.55)
    fall = bounce(seg(t, 0.55, 0.78))
    opacity = 1 - seg(t, 0.9, 0.99)
    pole = ('<line x1="64" y1="30" x2="64" y2="4" stroke="#1b1b1b" stroke-width="4" stroke-linecap="round"/>'
            '<path d="M64 4 L94 11 L64 18 Z" fill="#d62828" stroke="#1b1b1b" stroke-width="2" stroke-linejoin="round"/>')
    body = f'<g transform="rotate({150 * fall:.2f} 64 30)">{pole}</g>' + clock(64, 76, 46, remaining=remaining)
    return svg(128, f'<g opacity="{opacity:.3f}">{body}</g>')


def gg(t):
    come = ease_out(seg(t, 0.08, 0.32))
    back = ease_in_out(seg(t, 0.76, 0.96))
    shift = 9 * come * (1 - back)
    bow = 14 * math.sin(math.pi * seg(t, 0.34, 0.62))
    return svg(128, disc(28 + shift, 66, 27, "w", "帥", 36, rotate=bow) + disc(100 - shift, 66, 27, "b", "帥", 36, rotate=-bow))


def ligungi_build(t):
    offsets = []
    for i in range(3):
        start = 0.04 + i * 0.17
        offsets.append(100 if t < start else 50 * (1 - bounce(seg(t, start, start + 0.17))))
    return svg(128, f'<g opacity="{1 - seg(t, 0.88, 0.98):.3f}">{logo(offsets, 2)}</g>', "")


# Stickers, 320 px.

def sticker_checkmate(t):
    pulse = 0.5 - 0.5 * math.cos(2 * math.pi * seg(t, 0, 0.24) * 2)
    tip = ease_in_out(seg(t, 0.26, 0.48))
    glow = (f'<radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset=".72" stop-color="#d62828" stop-opacity="{0.4 + 0.5 * pulse:.2f}"/>'
            '<stop offset="1" stop-color="#d62828" stop-opacity="0"/></radialGradient>')
    slam = ease_out(seg(t, 0.5, 0.6))
    piece = (f'<g opacity="{(1 - 0.55 * tip) * (1 - seg(t, 0.5, 0.6)):.3f}" transform="rotate({-80 * tip:.2f} 160 232)">'
             f'<circle cx="160" cy="132" r="{118 * (1 - tip):.1f}" fill="url(#g)"/>{disc(160, 132, 92, "w", "帥", 116)}</g>')
    mark = stamp(160, 132, 210, "詰み", "#c8312b", 88, scale=1.9 - 0.9 * slam, opacity=seg(t, 0.5, 0.55)) if t >= 0.5 else ""
    text = caption("CHECKMATE", 284, 44, opacity=seg(t, 0.55, 0.62)) if t >= 0.55 else ""
    return svg(320, piece + mark + text, DEFS.replace("</defs>", glow + "</defs>"))


def sticker_done(t):
    slam = ease_out(seg(t, 0.0, 0.14))
    shake = 5 * math.sin(seg(t, 0.14, 0.28) * math.pi * 4) * (1 - seg(t, 0.14, 0.28))
    rays = ""
    ray = ease_out(seg(t, 0.22, 0.42))
    if 0.22 <= t:
        for angle in (-60, -20, 20, 60, 120, 160, 200, 240):
            a = math.radians(angle - 90)
            r1, r2 = 122 + 6 * ray, 122 + 26 * ray
            rays += (f'<line x1="{160 + r1 * math.cos(a):.1f}" y1="{132 + r1 * math.sin(a):.1f}" x2="{160 + r2 * math.cos(a):.1f}" '
                     f'y2="{132 + r2 * math.sin(a):.1f}" stroke="#f2c230" stroke-width="9" stroke-linecap="round" opacity="{1 - seg(t, 0.6, 0.8):.2f}"/>')
    mark = stamp(160, 132, 220, "済み", "#3b7a2a", 92, scale=1.8 - 0.8 * slam, rotate=0, opacity=seg(t, 0, 0.06), round_shape=True)
    text = caption("DONE!", 284, 52, scale=0.6 + 0.4 * ease_out(seg(t, 0.12, 0.26)), opacity=seg(t, 0.12, 0.18)) if t >= 0.12 else ""
    return svg(320, f'<g transform="translate({shake:.2f} 0)">{rays}{mark}</g>{text}')


def sticker_your_move(t):
    hop = abs(math.sin(2 * math.pi * 2 * t)) * 26
    body = clock(104, 132, 78, hand=360 * t)
    body += f'<ellipse cx="236" cy="206" rx="{44 - hop * 0.6:.1f}" ry="9" fill="rgba(0,0,0,.25)"/>'
    body += disc(236, 150 - hop, 54, "w", "兵", 70)
    return svg(320, body + caption("YOUR MOVE", 284, 44))


def sticker_betrayed(t):
    a = math.pi * ease_in_out(seg(t, 0.12, 0.4)) + math.pi * ease_in_out(seg(t, 0.72, 0.94))
    sx = math.cos(a)
    arrows = (f'<g opacity="{seg(t, 0.12, 0.2) * (1 - seg(t, 0.5, 0.62)):.2f}" stroke="#d8443f" stroke-width="12" fill="none" stroke-linecap="round">'
              '<path d="M160 18 A114 114 0 0 1 274 132"/><path d="M160 246 A114 114 0 0 1 46 132"/></g>')
    text = caption("BETRAYED!", 284, 46, opacity=seg(t, 0.36, 0.44)) if t >= 0.36 else ""
    return svg(320, arrows + disc(160, 132, 104, "w" if sx >= 0 else "b", "兵", 136, sx=sx) + text)


def sticker_gg(t):
    pop = seg(t, 0.0, 0.18)
    scale = (1.18 * ease_out(pop / 0.7) if pop < 0.7 else 1.18 - 0.18 * ease_out((pop - 0.7) / 0.3)) if pop < 1 else 1 + 0.05 * math.sin(2 * math.pi * 2 * (t - 0.18))
    tower = logo([0, 0, 0], 2.9, tx=67, ty=-14)
    return svg(320, tower + caption("GG", 252, 118, scale=scale, opacity=min(1, pop * 3)), "")


ANIMATIONS = {
    "stack": (stack, 128, 20, 40, "emoji"),
    "flip": (flip, 128, 20, 32, "emoji"),
    "dropping": (dropping, 128, 20, 32, "emoji"),
    "check_pulse": (check_pulse, 128, 20, 24, "emoji"),
    "done_stamp": (done_stamp, 128, 20, 32, "emoji"),
    "flag": (flag, 128, 20, 40, "emoji"),
    "gg": (gg, 128, 20, 32, "emoji"),
    "ligungi_build": (ligungi_build, 128, 20, 40, "emoji"),
    "checkmate": (sticker_checkmate, 320, 15, 36, "sticker"),
    "done": (sticker_done, 320, 15, 30, "sticker"),
    "your_move": (sticker_your_move, 320, 15, 30, "sticker"),
    "betrayed": (sticker_betrayed, 320, 15, 30, "sticker"),
    "gg_tower": (sticker_gg, 320, 15, 30, "sticker"),
}


def main(out):
    manifest = {}
    for name, (draw, size, fps, count, kind) in ANIMATIONS.items():
        folder = os.path.join(out, name)
        os.makedirs(folder, exist_ok=True)
        for i in range(count):
            with open(os.path.join(folder, f"{i:04d}.svg"), "w", encoding="utf-8") as handle:
                handle.write(draw(i / count))
        manifest[name] = {"size": size, "fps": fps, "frames": count, "kind": kind}
    with open(os.path.join(out, "manifest.json"), "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)


if __name__ == "__main__":
    main(sys.argv[1])
