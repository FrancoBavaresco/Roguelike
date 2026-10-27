"""Brazier fire sprites from the artist's sketch (art/braseros_fuego_verde.kra, 512x512, one paint layer per stage).
Usage: python3 tools/brazier_sprites.py art/braseros_fuego_verde.kra public/textures/fx/brazier

The sketch is a progression of the same brazier: Capa 1 empty bowl, 2 coals, 3/4 small flame, 5 medium flame,
6 tall flame with side tongues and sparkles, 7 the same with light rays, 8-10 glow halos, 11-14 loose fragments
(11/12 green flakes, 13 a white wisp, 14 white flakes). The bowl is built in 3D by the game (render.js), so here only
the fire is taken: for each flame stage, the pixels that differ from the coals-only drawing and look like fire (green,
white core, or its black ink line), above the bowl's front rim, kept as connected shapes (the dish's green tint is
left out). Flames: A = Capa 3 (small), B = Capa 5 (medium), C = Capa 6 (tall). Fragments: the green and white flakes
of Capas 12 and 14, one per cell of a 4x4 atlas. Writes flame_A/B/C.png (cropped, pivot = the flame's foot on the
coals), sparks.png and brazier.json. Transparent pixels take the colour of the nearest paint (no fringes)."""
import sys, os, json, zipfile, re, numpy as np, cv2

def lzf(data):
    out = bytearray(); i = 0; n = len(data)
    while i < n:
        c = data[i]; i += 1
        if c < 32: l = c + 1; out += data[i:i + l]; i += l
        else:
            l = c >> 5; ref = len(out) - ((c & 0x1f) << 8) - 1
            if l == 7: l += data[i]; i += 1
            ref -= data[i]; i += 1; l += 2
            for _ in range(l): out.append(out[ref]); ref += 1
    return bytes(out)

def decode(b, W, H):
    pos = 0; hdr = {}
    for _ in range(5):
        e = b.index(b'\n', pos); k, v = b[pos:e].decode().split(' '); hdr[k] = v; pos = e + 1
    tw, th, ps, n = int(hdr['TILEWIDTH']), int(hdr['TILEHEIGHT']), int(hdr['PIXELSIZE']), int(hdr['DATA'])
    img = np.zeros((H, W, 4), np.uint8)
    for _ in range(n):
        e = b.index(b'\n', pos); x, y, comp, size = b[pos:e].decode().split(','); pos = e + 1; size = int(size)
        chunk = b[pos:pos + size]; pos += size
        raw = lzf(chunk[1:]) if chunk[0] == 1 else chunk[1:]
        t = np.frombuffer(raw, np.uint8)[:tw * th * ps].reshape(ps, th, tw).transpose(1, 2, 0)
        x, y = int(x), int(y); x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + tw), min(H, y + th)
        if x1 > x0 and y1 > y0: img[y0:y1, x0:x1] = t[y0 - y:y1 - y, x0 - x:x1 - x]
    return img   # BGRA

def layers(path):
    z = zipfile.ZipFile(path); doc = z.read('maindoc.xml').decode()
    im = re.search(r'<IMAGE[^>]*>', doc).group(0); name = re.search(r' name="([^"]+)"', im).group(1)
    W = int(re.search(r' width="(\d+)"', im).group(1)); H = int(re.search(r' height="(\d+)"', im).group(1))
    out = {}
    for tag in re.findall(r'<layer [^>]*/>', doc):
        nm = re.search(r' name="([^"]+)"', tag).group(1); fn = re.search(r' filename="([^"]+)"', tag).group(1)
        out[nm] = decode(z.read(f'{name}/layers/{fn}'), W, H)
    return out

def bleed(img):
    a = img[..., 3].astype(np.float32) / 255; rgb = img[..., :3].astype(np.float32); w = (a > 0.02).astype(np.float32)
    out = rgb.copy(); have = w.copy()
    for s in (1.5, 3):
        num = cv2.GaussianBlur(rgb * w[..., None], (0, 0), s); den = cv2.GaussianBlur(w, (0, 0), s)
        fill = (have < 0.5) & (den > 1e-3); out[fill] = (num / np.maximum(den, 1e-4)[..., None])[fill]; have[fill] = 1
    out[have < 0.5] = 0
    return np.dstack([np.clip(out, 0, 255), img[..., 3]]).astype(np.uint8)

RIM_Y = 262            # the bowl's front rim in the sketch: anything below is the bowl
DISH = (217, 250, 68, 19)   # the dish as an ellipse: centre x, y and radii (px)
DISH_TOP = 236         # the dish's back edge: fire shapes start above it, the tint on the dish does not
PIVOT = (217, 257)     # the flame's foot, on the coals at the centre of the dish
FLAMES = {'A': 'Capa de pintura 3', 'B': 'Capa de pintura 5', 'C': 'Capa de pintura 6'}

def flame(L, name):
    im = L[name].astype(int); base = L['Capa de pintura 2'].astype(int)
    b, g, r, a = [im[..., i] for i in range(4)]
    diff = np.abs(im[..., :3] - base[..., :3]).sum(2) + np.abs(a - base[..., 3])
    fire = (a > 10) & (diff > 60) & (((g > 120) & (g > r + 30)) | ((r > 190) & (g > 200) & (b > 180)) | ((g < 60) & (r < 40) & (b < 40) & (a > 200)))
    fire[RIM_Y:] = False
    n, lab, st, _ = cv2.connectedComponentsWithStats(fire.astype(np.uint8), 8)
    keep = np.zeros_like(fire)
    for i in range(1, n):   # the flame's own shapes (the dish's ring of green tint is thin and flat: left out)
        x, y, w, h, ar = st[i]
        if ar >= 25 and y < DISH_TOP: keep |= lab == i   # it rises above the dish (the dish's tint lies flat below)
    keep = cv2.dilate(keep.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & (a > 10)
    # the green tint painted along the dish's rim (an ellipse round the dish) is the bowl lit by the fire: the game
    # lights its own bowl, so those strokes go
    yy, xx = np.mgrid[0:im.shape[0], 0:im.shape[1]]; d = np.hypot((xx - DISH[0]) / DISH[2], (yy - DISH[1]) / DISH[3])
    keep &= ~((d > 0.45) & (d < 1.35) & (yy > DISH[1] - DISH[3] * 1.4) & (np.abs(xx - DISH[0]) > DISH[2] * 0.42))
    # its back half: thin strokes low down that are not the border of a solid shape of fire
    core = cv2.morphologyEx(keep.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    near = cv2.dilate(core, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))).astype(bool)
    keep &= ~(~near & (yy > DISH[1] - 40))
    n2, lab2, st2, _ = cv2.connectedComponentsWithStats(keep.astype(np.uint8), 8)   # loose bits left over
    for i in range(1, n2):
        x, y, w, h, ar = st2[i]
        if ar < 60 or (h <= 14 and abs(x + w / 2 - DISH[0]) > 30): keep[lab2 == i] = False   # specks, and flat strokes off to the side (the rim)
    out = L[name].copy(); out[..., 3] = np.where(keep, out[..., 3], 0)
    ys, xs = np.nonzero(out[..., 3] > 8); pad = 3
    x0, x1, y0, y1 = xs.min() - pad, xs.max() + 1 + pad, ys.min() - pad, ys.max() + 1 + pad
    crop = bleed(out[y0:y1, x0:x1])
    return crop, {'w': int(x1 - x0), 'h': int(y1 - y0), 'pivot': [int(PIVOT[0] - x0), int(PIVOT[1] - y0)]}

def sparks(L):
    cells = []
    for nm in ('Capa de pintura 12', 'Capa de pintura 14'):
        im = L[nm]; n, lab, st, _ = cv2.connectedComponentsWithStats((im[..., 3] > 20).astype(np.uint8), 8)
        comps = sorted(range(1, n), key=lambda i: -st[i][4])[:8]
        for i in comps:
            x, y, w, h, ar = st[i]; c = im[max(0, y - 2):y + h + 2, max(0, x - 2):x + w + 2].copy()
            m = (lab[max(0, y - 2):y + h + 2, max(0, x - 2):x + w + 2] == i); m = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
            c[..., 3] = np.where(m, c[..., 3], 0); cells.append(c)
    S = 32; atlas = np.zeros((4 * S, 4 * S, 4), np.uint8)
    for k, c in enumerate(cells[:16]):
        h, w = c.shape[:2]; f = min(1, (S - 4) / max(h, w)); c = cv2.resize(c, (max(1, int(w * f)), max(1, int(h * f))), interpolation=cv2.INTER_AREA)
        h, w = c.shape[:2]; r, q = divmod(k, 4); y0 = r * S + (S - h) // 2; x0 = q * S + (S - w) // 2; atlas[y0:y0 + h, x0:x0 + w] = c
    return bleed(atlas), len(cells[:16])

# ---- the cup's surfaces, painted: unwrapped from the empty cup in the sketch (Capa 1, seen from the front, 3/4 above)
# Sketch geometry (px): rim ellipse centre (217, 232), radii 73 x 17; the dish inside it 66 x 12; the outer bands from the
# rim's lower edge down to y 283; the stem x 200-235 from 283 to 305; the base (teal tiles) centre x 215, radius 39,
# from 312 to 334. A lathe's u runs round the cup, v along its profile: u -> angle t, the front view x = cx + r sin t
# (the far side mirrors the near one), y follows the ellipse of that ring (cy + ry cos t, front = lower).
def _sample(img, xs, ys):
    return cv2.remap(img, xs.astype(np.float32), ys.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)

def _strip(img, W, H, cx, rx, y0f, y1f, ry0=0.0, ry1=0.0):
    """u round the cup, v from the top ring (y0f + ry0 cos) to the bottom ring (y1f + ry1 cos)."""
    u = (np.arange(W) + 0.5) / W; v = (np.arange(H) + 0.5) / H; U, V = np.meshgrid(u, v)
    t = U * 2 * np.pi; s, c = np.sin(t) * 0.97, np.abs(np.cos(t))
    xs = cx + rx * s; ytop = y0f + ry0 * c; ybot = y1f + ry1 * c; ys = ytop + V * (ybot - ytop)
    return _sample(img, xs, ys)

def _flat(img):   # composite on the paint's own average colour (no white or black halo where alpha is 0)
    a = img[..., 3:4].astype(np.float32) / 255; rgb = img[..., :3].astype(np.float32)
    avg = (rgb * a).sum((0, 1)) / max(a.sum(), 1)
    return np.clip(rgb * a + avg * (1 - a), 0, 255).astype(np.uint8)

def cup_textures(L, out):
    cup = L['Capa de pintura 1'].copy()
    # the two straps painted on the front: the game builds its straps in 3D, so they are painted out of the bands
    b, g, r, a = [cup[..., i].astype(int) for i in range(4)]
    teal = (a > 100) & (b > r + 25) & (g > r + 10) & (np.arange(cup.shape[0])[:, None] < 286) & (np.arange(cup.shape[0])[:, None] > 240)
    rgb = _flat(cup)
    rgb = cv2.inpaint(rgb, cv2.dilate(teal.astype(np.uint8), np.ones((7, 7), np.uint8)), 6, cv2.INPAINT_TELEA)   # with their ink outline
    S = 4   # textures at 4x the sketch, smooth but keeping the ink lines
    band = _strip(rgb, 1024, 160, 217, 72, 232, 266, 17, 12)          # outer bands: from the rim's lower edge to the bowl's foot
    rim = _strip(rgb, 1024, 48, 217, 73, 215, 249, -17 + 17, 0.0)    # the rim's outer face (thin)
    # the dish: seen in perspective in the sketch, so it is repainted in the same manner: its grey (darker toward the
    # coals), six radial ink lines and a ring, as the sketch draws it
    W, H = 1024, 256; dmask = np.zeros(cup.shape[:2], bool); yy, xx = np.mgrid[0:cup.shape[0], 0:cup.shape[1]]
    dmask = (((xx - 217) / 60.0) ** 2 + ((yy - 236) / 9.0) ** 2) < 1; grey = rgb[dmask].reshape(-1, 3).mean(0)
    v = (np.arange(H) + 0.5) / H; shade = (1 - 0.45 * v)[:, None, None]
    dish = np.repeat(np.repeat((grey[None, None, :] * shade), W, 1), 1, 0).astype(np.float32)
    ink = np.array([22, 24, 26], np.float32)
    for k in range(6):
        x = int((k + 0.5) / 6 * W); dish[:, max(0, x - 3):x + 3] = ink
    for yv in (0.08, 0.55): y = int(yv * H); dish[max(0, y - 3):y + 3, :] = ink
    dish = dish.astype(np.uint8)
    stem = _strip(rgb, 512, 128, 217, 16, 287, 304)
    base = _strip(rgb, 1024, 128, 215, 38, 316, 328, 4, 7)
    for name, img in (('cup_band', band), ('cup_rim', rim), ('cup_dish', dish), ('cup_stem', stem), ('cup_base', base)):
        cv2.imwrite(os.path.join(out, name + '.png'), img); print(name, img.shape[1], 'x', img.shape[0])

def embers():   # soft round embers (a bright core, a glow) for the rising particles: one row of 4 cells
    S = 32; row = np.zeros((S, 4 * S, 4), np.uint8); yy, xx = np.mgrid[0:S, 0:S].astype(np.float32) - (S - 1) / 2
    for k, (col, core) in enumerate((((120, 255, 110), 0.25), ((200, 255, 200), 0.3), ((60, 230, 90), 0.18), ((255, 255, 255), 0.22))):
        d = np.hypot(xx, yy) / (S / 2); a = np.clip(1 - d, 0, 1) ** 2.2; c = np.clip(1 - d / core, 0, 1)
        rgb = np.array(col[::-1], np.float32) * (1 - c[..., None]) + 255 * c[..., None]
        row[:, k * S:(k + 1) * S] = np.dstack([rgb, a * 255]).astype(np.uint8)
    return row

if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
    L = layers(src); meta = {'source': os.path.basename(src), 'px': 512, 'flames': {}}
    for k, nm in FLAMES.items():
        img, m = flame(L, nm); cv2.imwrite(os.path.join(out, f'flame_{k}.png'), img); meta['flames'][k] = m; print(k, m)
    at, n = sparks(L); at = np.vstack([at, embers()])   # row 5: soft embers
    cv2.imwrite(os.path.join(out, 'sparks.png'), at); meta['sparks'] = {'cell': 32, 'cols': 4, 'rows': 5, 'flakes': n, 'embers': [16, 19]}
    cup_textures(L, out)
    json.dump(meta, open(os.path.join(out, 'brazier.json'), 'w'), indent=1); print('sparks', n)
