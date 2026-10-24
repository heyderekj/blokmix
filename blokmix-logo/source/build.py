import sys; sys.path.append('/Users/heyderekj/Library/Python/3.9/lib/python/site-packages')
import os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

FONT, OUT = sys.argv[1], sys.argv[2]
os.makedirs(os.path.join(OUT, "svg"), exist_ok=True)

INK, PAPER, HOT, CONCRETE = "#17121A", "#FBF8F9", "#FF69B4", "#2A2130"

def mix(a, b, t=0.5):
    a = [int(a[i:i+2], 16) for i in (1, 3, 5)]; b = [int(b[i:i+2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(x*(1-t)+y*t):02X}" for x, y in zip(a, b))

# ---------- wordmark ----------
font = TTFont(FONT)
gs, cmap, hmtx = font.getGlyphSet(), font.getBestCmap(), font["hmtx"]
XH = font["OS/2"].sxHeight            # 526: the block is exactly one x-height
TOP, BOTTOM = 725, -12                # ascender and round overshoot
TRACK = -45                           # -0.045 em, same as the CSS wordmark
BLOCK_SB = 60                         # flat-sided spacing, matches the l stem
RADIUS = 0.075                        # every block's corner = 7.5% of its side

KERN = {("k", "m"): -10, ("i", "x"): 6}   # optical fixes after review

def wordmark():
    x, letters, square = 0.0, [], None
    text = "blokmix"
    first_lsb = None
    for i, ch in enumerate(text):
        if ch == "o":
            sx = x + BLOCK_SB
            square = (sx, 0.0, XH)
            x += XH + 2 * BLOCK_SB + TRACK
            continue
        g = cmap[ord(ch)]
        adv, lsb = hmtx[g]
        if first_lsb is None:
            first_lsb = lsb
        pen = SVGPathPen(gs)
        gs[g].draw(TransformPen(pen, (1, 0, 0, -1, x, 0)))
        letters.append(pen.getCommands())
        nxt = text[i + 1] if i + 1 < len(text) else None
        x += adv + TRACK + KERN.get((ch, nxt), 0)
    # right edge = x glyph's ink, not its advance
    xg = cmap[ord("x")]; bp = BoundsPen(gs); gs[xg].draw(bp)
    right = x - TRACK - hmtx[xg][0] + bp.bounds[2]
    return letters, square, first_lsb, right

LETTERS, SQUARE, LEFT, RIGHT = wordmark()
WM_W, WM_H = RIGHT - LEFT, TOP - BOTTOM

def wm_group(letter_fill, block_fill, dx=0.0, dy=0.0, s=1.0):
    sx, _, side = SQUARE
    r = side * RADIUS
    tx = dx - LEFT * s
    ty = dy + TOP * s
    d = " ".join(LETTERS)
    return (f'<g transform="translate({tx:.2f} {ty:.2f}) scale({s:.5f})">'
            f'<path fill="{letter_fill}" d="{d}"/>'
            f'<rect fill="{block_fill}" x="{sx:.1f}" y="{-side:.1f}" width="{side:.1f}" height="{side:.1f}" rx="{r:.1f}"/></g>')

# ---------- icon, on a 1024 grid ----------
# 2x2 grid of 288 blocks with 64 gutters. The top-right block is lifted one
# gutter up and right (the drop). The grid is shifted 32 down-left so the whole
# composition is optically centred: its bounds run 160..864 on both axes.
B, G = 288, 64
COLS = (160, 160 + B + G)          # 160, 512
ROWS = (224, 224 + B + G)          # 224, 576
DROP = (COLS[1] + G, ROWS[0] - G)  # 576, 160
BR = B * RADIUS

def slot_shapes(x0, y0, fill, inset=14, t=20, arm=46, dash=40):
    # the landing slot: four L-shaped corners plus two dashes per side, all filled shapes
    S = B - 2 * inset
    x0, y0 = x0 + inset, y0 + inset
    run = S - 2 * arm
    gap = (run - 2 * dash) / 3
    r = []
    for (cx, cy, sx, sy) in ((x0, y0, 1, 1), (x0 + S, y0, -1, 1), (x0, y0 + S, 1, -1), (x0 + S, y0 + S, -1, -1)):
        hx = cx if sx > 0 else cx - arm
        vy = cy if sy > 0 else cy - arm
        r.append((hx, cy if sy > 0 else cy - t, arm, t))
        r.append((cx if sx > 0 else cx - t, vy, t, arm))
    for k in range(2):
        off = arm + gap + k * (dash + gap)
        r += [(x0 + off, y0, dash, t), (x0 + off, y0 + S - t, dash, t),
              (x0, y0 + off, t, dash), (x0 + S - t, y0 + off, t, dash)]
    return "".join(f'<rect fill="{fill}" x="{a:.1f}" y="{b:.1f}" width="{w:.1f}" height="{h:.1f}"/>' for a, b, w, h in r)

def blocks(bar, drop, slot):
    out = []
    for (cx, cy) in ((COLS[0], ROWS[0]), (COLS[0], ROWS[1]), (COLS[1], ROWS[1])):
        out.append(f'<rect fill="{bar}" x="{cx}" y="{cy}" width="{B}" height="{B}" rx="{BR:.1f}"/>')
    if slot:
        out.append(slot_shapes(COLS[1], ROWS[0], slot))
    out.append(f'<rect fill="{drop}" x="{DROP[0]}" y="{DROP[1]}" width="{B}" height="{B}" rx="{BR:.1f}"/>')
    return "".join(out)

def app_icon(tile, bar, drop, slot=True):
    return (f'<rect width="1024" height="1024" rx="230" fill="{tile}"/>' + blocks(bar, drop, mix(tile, bar) if slot else None))

def icon_group(tile, bar, drop, dx, dy, size):
    return f'<g transform="translate({dx:.2f} {dy:.2f}) scale({size/1024:.5f})">' + app_icon(tile, bar, drop, slot=False) + '</g>'

def mark_group(bar, drop, slot, dx=0.0, dy=0.0, s=1.0):
    # tile-less mark, bounds 160..864 -> origin at 0
    return f'<g transform="translate({dx - 160*s:.2f} {dy - 160*s:.2f}) scale({s:.5f})">{blocks(bar, drop, slot)}</g>'

def x_mark(tile, bar, drop):
    c, g = 192, 64
    pos = [160, 160 + c + g, 160 + 2 * (c + g)]
    r = c * RADIUS
    cells = [(0, 0), (2, 0), (0, 2), (2, 2)]
    out = [f'<rect width="1024" height="1024" rx="230" fill="{tile}"/>']
    out += [f'<rect fill="{bar}" x="{pos[i]}" y="{pos[j]}" width="{c}" height="{c}" rx="{r:.1f}"/>' for i, j in cells]
    out.append(f'<rect fill="{drop}" x="{pos[1]}" y="{pos[1]}" width="{c}" height="{c}" rx="{r:.1f}"/>')
    return "".join(out)

def favicon(n, tile, bar, drop):
    # pixel-snapped 2x2, no slot and no lift
    if n == 16:
        rx, m, b, g = 3.5, 2, 5, 2
    else:
        rx, m, b, g = 7, 4, 11, 2
    p = (m, m + b + g)
    br = 1 if n == 16 else 1.5
    out = [f'<rect width="{n}" height="{n}" rx="{rx}" fill="{tile}"/>']
    for (i, j) in ((0, 0), (0, 1), (1, 1)):
        out.append(f'<rect fill="{bar}" x="{p[i]}" y="{p[j]}" width="{b}" height="{b}" rx="{br}"/>')
    out.append(f'<rect fill="{drop}" x="{p[1]}" y="{p[0]}" width="{b}" height="{b}" rx="{br}"/>')
    return "".join(out)

def svg(w, h, body, title):
    k = min(1.0, 1024 / max(w, h))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w*k:.0f}" height="{h*k:.0f}">'
            f'<title>{title}</title>{body}</svg>\n')

def write(name, content):
    with open(os.path.join(OUT, "svg", name), "w") as f:
        f.write(content)

W, H = round(WM_W), round(WM_H)

# wordmarks
write("blokmix-wordmark-ink.svg", svg(W, H, wm_group(INK, HOT), "Blokmix wordmark, ink"))
write("blokmix-wordmark-paper.svg", svg(W, H, wm_group(PAPER, HOT), "Blokmix wordmark, paper for dark backgrounds"))
write("blokmix-wordmark-on-pink.svg", svg(W, H, wm_group(INK, INK), "Blokmix wordmark for hot pink backgrounds"))
write("blokmix-wordmark-black.svg", svg(W, H, wm_group("#000000", "#000000"), "Blokmix wordmark, one-color black"))
write("blokmix-wordmark-white.svg", svg(W, H, wm_group("#FFFFFF", "#FFFFFF"), "Blokmix wordmark, one-color white"))

# app icons
write("blokmix-icon-ink.svg", svg(1024, 1024, app_icon(INK, PAPER, HOT), "Blokmix app icon, ink (primary)"))
write("blokmix-icon-paper.svg", svg(1024, 1024, app_icon(PAPER, INK, HOT), "Blokmix app icon, paper"))
write("blokmix-icon-pink.svg", svg(1024, 1024, app_icon(HOT, INK, PAPER), "Blokmix app icon, hot pink"))
write("blokmix-x-mark.svg", svg(1024, 1024, x_mark(INK, PAPER, HOT), "Blokmix X mark"))

# tile-less marks
write("blokmix-mark-ink.svg", svg(704, 704, mark_group(INK, HOT, mix(PAPER, INK)), "Blokmix mark for light backgrounds"))
write("blokmix-mark-paper.svg", svg(704, 704, mark_group(PAPER, HOT, mix(INK, PAPER)), "Blokmix mark for dark backgrounds"))

# favicons
write("favicon-32.svg", svg(32, 32, favicon(32, INK, PAPER, HOT), "Blokmix favicon 32"))
write("favicon-16.svg", svg(16, 16, favicon(16, INK, PAPER, HOT), "Blokmix favicon 16"))
write("favicon-32-paper.svg", svg(32, 32, favicon(32, PAPER, INK, HOT), "Blokmix favicon 32, paper"))

# horizontal lockup: icon height = letter height, gap = half a block
gap = XH / 2
lw = WM_H + gap + WM_W
for tone, tile, bar, drop, letters in (("ink", INK, PAPER, HOT, INK), ("paper", HOT, INK, PAPER, PAPER)):
    body = icon_group(tile, bar, drop, 0, 0, WM_H) + wm_group(letters, HOT, WM_H + gap, 0)
    write(f"blokmix-lockup-horizontal-{tone}.svg", svg(lw, WM_H, body, f"Blokmix horizontal lockup, {tone}"))

# stacked lockup: icon 2x letter height, centred, gap = half a block
isz = WM_H * 2
sh = isz + gap + WM_H
for tone, tile, bar, drop, letters in (("ink", INK, PAPER, HOT, INK), ("paper", HOT, INK, PAPER, PAPER)):
    body = icon_group(tile, bar, drop, (WM_W - isz) / 2, 0, isz) + wm_group(letters, HOT, 0, isz + gap)
    write(f"blokmix-lockup-stacked-{tone}.svg", svg(WM_W, sh, body, f"Blokmix stacked lockup, {tone}"))

write("blokmix-icon-simple-ink.svg", svg(1024, 1024, app_icon(INK, PAPER, HOT, slot=False), "Blokmix icon without slot, for small sizes"))

print("wordmark", W, "x", H, "block", XH, "lockup", round(lw), "x", H, "stacked", round(WM_W), "x", round(sh))

# ---------- alternate: square o with a hot pink drop shadow ----------
# The o is a square ring as wide as a heavy extended o, with vertical sides as
# heavy as the stems' visual weight and lighter horizontals, so its counter is square.
OW, SIDE_W, BAR_H = 640, 200, 150
SHADOW = 72   # offset down and right, in font units

def wordmark_square_o():
    x, parts = 0.0, []
    text = "blokmix"
    for i, ch in enumerate(text):
        if ch == "o":
            ox = x + BLOCK_SB
            ro, ri = round(XH * RADIUS), 14
            cx, cy, cw, ch_ = ox + SIDE_W, -XH + BAR_H, OW - 2 * SIDE_W, XH - 2 * BAR_H
            # outer rounded rect clockwise, inner counter counter-clockwise (evenodd keeps the hole either way)
            parts.append(
                f"M{ox+ro:.1f} {-XH}H{ox+OW-ro:.1f}Q{ox+OW:.1f} {-XH} {ox+OW:.1f} {-XH+ro}V{-ro}Q{ox+OW:.1f} 0 {ox+OW-ro:.1f} 0"
                f"H{ox+ro:.1f}Q{ox:.1f} 0 {ox:.1f} {-ro}V{-XH+ro}Q{ox:.1f} {-XH} {ox+ro:.1f} {-XH}Z"
                f"M{cx+ri:.1f} {cy}H{cx+cw-ri:.1f}Q{cx+cw:.1f} {cy} {cx+cw:.1f} {cy+ri}V{cy+ch_-ri}Q{cx+cw:.1f} {cy+ch_} {cx+cw-ri:.1f} {cy+ch_}"
                f"H{cx+ri:.1f}Q{cx:.1f} {cy+ch_} {cx:.1f} {cy+ch_-ri}V{cy+ri}Q{cx:.1f} {cy} {cx+ri:.1f} {cy}Z")
            x += OW + 2 * BLOCK_SB + TRACK
            continue
        g = cmap[ord(ch)]
        adv, lsb = hmtx[g]
        pen = SVGPathPen(gs)
        gs[g].draw(TransformPen(pen, (1, 0, 0, -1, x, 0)))
        parts.append(pen.getCommands())
        nxt = text[i + 1] if i + 1 < len(text) else None
        x += adv + TRACK + KERN.get((ch, nxt), 0)
    xg = cmap[ord("x")]; bp = BoundsPen(gs); gs[xg].draw(bp)
    right = x - TRACK - hmtx[xg][0] + bp.bounds[2]
    return " ".join(parts), right

SQ_D, SQ_RIGHT = wordmark_square_o()
SQ_W = SQ_RIGHT - LEFT + SHADOW
SQ_H = WM_H + SHADOW

def shadow_group(letter_fill, shadow_fill):
    tx, ty = -LEFT, TOP
    return (f'<g transform="translate({tx:.2f} {ty:.2f})" fill-rule="evenodd">'
            f'<path fill="{shadow_fill}" transform="translate({SHADOW} {SHADOW})" d="{SQ_D}"/>'
            f'<path fill="{letter_fill}" d="{SQ_D}"/></g>')

write("blokmix-wordmark-shadow-ink.svg", svg(SQ_W, SQ_H, shadow_group(INK, HOT), "Blokmix alternate wordmark: square o with hot pink shadow, for light backgrounds"))
write("blokmix-wordmark-shadow-paper.svg", svg(SQ_W, SQ_H, shadow_group(PAPER, HOT), "Blokmix alternate wordmark: square o with hot pink shadow, for dark backgrounds"))
write("blokmix-wordmark-square-o-ink.svg", svg(SQ_RIGHT - LEFT, WM_H, f'<g transform="translate({-LEFT:.2f} {TOP})" fill-rule="evenodd"><path fill="{INK}" d="{SQ_D}"/></g>', "Blokmix alternate wordmark: square o, one color"))
print("shadow wordmark", round(SQ_W), "x", round(SQ_H))
