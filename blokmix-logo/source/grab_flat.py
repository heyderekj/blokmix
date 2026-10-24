"""Flat vector versions of the Blokmix 'grab' app icon: full icon, favicons and lockups.
Solid fills only (no gradients, strokes, filters or opacity) so they work in any tool.
Usage: python3 grab_flat.py LOGO_DIR
"""
import math, os, re, sys

LOGO = sys.argv[1]
SVG = os.path.join(LOGO, "svg")

THEMES = {
    # tile, dots, slot wall, slot floor, cast shadow, block top, block side, block highlight
    "light": dict(tile="#F1EBEE", dot="#CFC4CC", wall="#C9BDC6", floor="#DCD3D9", shadow="#D3C8D0",
                  top="#FF5CB0", side="#C2185B", hi="#FF8CC6"),
    "dark":  dict(tile="#17121A", dot="#3E3245", wall="#060407", floor="#0E0A10", shadow="#0B080D",
                  top="#FF5CB0", side="#C2185B", hi="#FF8CC6"),
}

def rr(x, y, w, h, r, fill, extra=""):
    return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{r:.1f}" fill="{fill}"{extra}/>'

def squircle_path(a=512, n=5.0, count=240):
    pts = []
    for k in range(count):
        t = 2 * math.pi * k / count
        c, s = math.cos(t), math.sin(t)
        pts.append((512 + a * math.copysign(abs(c) ** (2 / n), c), 512 - a * math.copysign(abs(s) ** (2 / n), s)))
    return "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + " Z"

def icon_body(t, dots=True):
    """The grab on a 1024 canvas, matching the Blender render's layout."""
    out = [f'<path d="{squircle_path()}" fill="{t["tile"]}"/>']
    if dots:
        d = []
        for i in range(14):
            for j in range(14):
                px, py = 96 + i * 64, 96 + j * 64
                if 196 < px < 572 and 460 < py < 836:
                    continue
                d.append(f"M{px - 7} {py}a7 7 0 1 0 14 0a7 7 0 1 0 -14 0Z")
        out.append(f'<path fill="{t["dot"]}" d="{" ".join(d)}"/>')
    # carved slot: wall colour, then the lit floor inset from the top-left
    out.append(rr(208, 472, 352, 352, 66, t["wall"]))
    out.append(rr(228, 494, 332, 330, 52, t["floor"]))
    # the lifted block: cast shadow, side, top, highlight
    g = 'transform="rotate(-9 600 458)"'
    out.append(f'<g {g}>' + rr(404 + 40, 262 + 70, 392, 392, 74, t["shadow"]) + '</g>')
    out.append(f'<g {g}>' + rr(404, 262 + 34, 392, 392, 74, t["side"]) + rr(404, 262, 392, 392, 74, t["top"])
               + rr(436, 284, 328, 96, 48, t["hi"]) + '</g>')
    return "".join(out)

def favicon(n, t):
    """Pixel-snapped versions: no dots, no rotation, whole pixels only."""
    if n == 32:
        tile = rr(0, 0, 32, 32, 7, t["tile"])
        slot = rr(4, 15, 13, 13, 3, t["wall"]) + rr(5, 16, 12, 12, 2.5, t["floor"])
        block = rr(14, 6, 15, 15, 3.5, t["side"]) + rr(14, 4, 15, 15, 3.5, t["top"]) + rr(16, 5, 11, 3, 1.5, t["hi"])
    else:
        tile = rr(0, 0, 16, 16, 3.5, t["tile"])
        slot = rr(2, 8, 7, 6, 1.5, t["wall"]) + rr(3, 9, 6, 5, 1, t["floor"])
        block = rr(7, 3, 8, 8, 2, t["side"]) + rr(7, 2, 8, 8, 2, t["top"])
    return tile + slot + block

def svg(w, h, body, title):
    k = min(1.0, 1024 / max(w, h))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w*k:.0f}" height="{h*k:.0f}">'
            f'<title>{title}</title>{body}</svg>\n')

def write(name, content):
    with open(os.path.join(SVG, name), "w") as f:
        f.write(content)

for tone, t in THEMES.items():
    write(f"blokmix-icon-{tone}.svg", svg(1024, 1024, icon_body(t), f"Blokmix app icon, flat vector, {tone}"))
    write(f"blokmix-icon-simple-{tone}.svg", svg(1024, 1024, icon_body(t, dots=False), f"Blokmix app icon without dots, for 24 to 63 px, {tone}"))
    for n in (16, 32):
        write(f"favicon-{n}-{tone}.svg", svg(n, n, favicon(n, t), f"Blokmix favicon {n}, {tone}"))

# lockups from the outlined wordmark files
def wm_inner(name):
    s = open(os.path.join(SVG, name)).read()
    return re.sub(r"^.*?</title>", "", s, flags=re.S).rsplit("</svg>", 1)[0]

WM_W, WM_H, XH = 4595, 737, 526
gap = XH / 2
for tone, wm in (("ink", "blokmix-wordmark-ink.svg"), ("paper", "blokmix-wordmark-paper.svg")):
    # light backgrounds get the ink-tile icon so its silhouette holds; dark backgrounds get the light tile
    t = THEMES["dark" if tone == "ink" else "light"]
    # horizontal: icon height = letter height, half-block gap
    s = WM_H / 1024
    body = f'<g transform="scale({s:.5f})">{icon_body(t, dots=False)}</g><g transform="translate({WM_H + gap:.1f} 0)">{wm_inner(wm)}</g>'
    write(f"blokmix-lockup-horizontal-{tone}.svg", svg(WM_H + gap + WM_W, WM_H, body, f"Blokmix horizontal lockup, {tone}"))
    # stacked: icon twice the letter height, centred
    isz = WM_H * 2
    body = (f'<g transform="translate({(WM_W - isz) / 2:.1f} 0) scale({isz / 1024:.5f})">{icon_body(t)}</g>'
            f'<g transform="translate(0 {isz + gap:.1f})">{wm_inner(wm)}</g>')
    write(f"blokmix-lockup-stacked-{tone}.svg", svg(WM_W, isz + gap + WM_H, body, f"Blokmix stacked lockup, {tone}"))
print("flat icon, favicons and lockups written")
