"""Theron's dash trail from the artist's Krita files (theron_dash_animacion_v2/krita/theron_dash_<DIR>.kra).
Usage: python3 tools/dash_frames.py <folder with the 8 .kra> public/textures/fx/dash
Each .kra is 896x896, 20 animated frames at 40 fps, layers: Cuerpo, Imagenes residuales, Capa (estela de tela),
FX - Destello, FX - Niebla y gotas, FX - Corte, FX - Estela baja (S, drawn from the front, has its own: FX - Burbujas,
FX - Llamas…). The game draws Theron in 3D, so the painted body and its afterimages (EXCLUDE) are left out: every
other layer is composited (bottom to top, as in Krita, with its opacity and visibility), frames FIRST..19,
at half size (448 px frames). Two adjustments so the painting sits around the 3D model:
  - a soft hole the shape of the painted body (HOLE, an ellipse round the body centre) lets the 3D Theron show
    through where the 2D one was; the impulse flash (KEEP_WHOLE) stays whole;
  - the cloth trail (CAPE) is part of the painted body's cape once the trail tears off (frame 12 on): it fades out over
    CAPE_FADE frames instead of staying behind as a loose piece of cloth. Each direction's frames are cropped to their common box, packed in a grid (one PNG per
direction) and described in dash.json (frame size, grid, pivot = the body centre inside the crop). Transparent
pixels take the colour of the nearest paint so filtering never pulls in dark or white fringes. Needs numpy, opencv."""
import sys, os, json, zipfile, re, numpy as np, cv2

EXCLUDE = {'Cuerpo', 'Imagenes residuales'}
DIRS = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE']
FIRST, LAST, SCALE, PIVOT = 2, 19, 0.5, (448, 448)
HOLE = (52, 100, 0.75, 1.2)          # ellipse radii in px (896 frame) and the soft edge: 0 inside 0.75, full from 1.2
KEEP_WHOLE = {'FX - Destello'}
CAPE, CAPE_FROM, CAPE_FADE = 'Capa (estela de tela)', 12, 3   # 00-01 are the painted body's anticipation: the 3D model does its own

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

class Kra:
    def __init__(self, path):
        self.z = zipfile.ZipFile(path); doc = self.z.read('maindoc.xml').decode()
        im = re.search(r'<IMAGE[^>]*>', doc).group(0)
        self.W = int(re.search(r' width="(\d+)"', im).group(1)); self.H = int(re.search(r' height="(\d+)"', im).group(1)); self.name = re.search(r' name="([^"]+)"', im).group(1)
        self.layers = {}; self.order = []   # order: top first, as Krita lists them
        for tag in re.findall(r'<layer [^>]*/>', doc):
            g = lambda k: (re.search(' ' + k + r'="([^"]*)"', tag) or [None, None])[1]
            self.layers[g('name')] = {'file': g('filename'), 'keys': g('keyframes'), 'opacity': int(g('opacity') or 255) / 255, 'visible': g('visible') != '0'}
            self.order.append(g('name'))
    def frame(self, name, t):
        L = self.layers[name]; base = f'{self.name}/layers/'; fn = L['file']
        if L['keys']:
            xml = self.z.read(base + L['keys']).decode(); best = None
            for tm, fr in re.findall(r'<keyframe time="(\d+)"[^>]* frame="([^"]+)"', xml):
                if int(tm) <= t and (best is None or int(tm) > best[0]): best = (int(tm), fr)
            if best: fn = best[1]
        return decode(self.z.read(base + fn), self.W, self.H)

_hole = {}
def hole(W, H):
    if (W, H) not in _hole:
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32); d = np.hypot((xx - PIVOT[0]) / HOLE[0], (yy - PIVOT[1]) / HOLE[1])
        x = np.clip((d - HOLE[2]) / (HOLE[3] - HOLE[2]), 0, 1); _hole[(W, H)] = (x * x * (3 - 2 * x))[..., None]
    return _hole[(W, H)]
def composite(k, t):   # premultiplied float BGRA, bottom layer first
    acc = np.zeros((k.H, k.W, 4), np.float32)
    for name in reversed([n for n in k.order if n not in EXCLUDE and k.layers[n]['visible']]):
        w = 1.0 if name != CAPE or t < CAPE_FROM else max(0.0, 1 - (t - CAPE_FROM + 1) / CAPE_FADE)
        if w <= 0: continue
        s = k.frame(name, t).astype(np.float32) / 255; a = s[..., 3:4] * k.layers[name]['opacity'] * w
        if name not in KEEP_WHOLE: a = a * hole(k.W, k.H)
        acc[..., :3] = s[..., :3] * a + acc[..., :3] * (1 - a); acc[..., 3:4] = a + acc[..., 3:4] * (1 - a)
    return acc

def bleed(rgb, a):
    w = (a > 0.02).astype(np.float32); out = rgb.copy(); have = w.copy()
    for s in (1.5, 3):
        num = cv2.GaussianBlur(rgb * w[..., None], (0, 0), s); den = cv2.GaussianBlur(w, (0, 0), s)
        fill = (have < 0.5) & (den > 1e-3); out[fill] = (num / np.maximum(den, 1e-4)[..., None])[fill]; have[fill] = 1
    out[have < 0.5] = 0   # far from any paint the colour never shows: keep it black (smaller files)
    return out

src, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
meta = {'fps': 40, 'first': FIRST, 'frames': LAST - FIRST + 1, 'scale': SCALE, 'source_frame': 896, 'dirs': {}}
for d in DIRS:
    k = Kra(os.path.join(src, f'theron_dash_{d}.kra'))
    fr = []
    for t in range(FIRST, LAST + 1):
        c = composite(k, t)   # premultiplied
        c = cv2.resize(c, (int(k.W * SCALE), int(k.H * SCALE)), interpolation=cv2.INTER_AREA); fr.append(c)
    alpha = np.max([f[..., 3] for f in fr], 0); ys, xs = np.nonzero(alpha > 0.01)
    pad = 4; x0, x1 = max(0, xs.min() - pad), min(alpha.shape[1], xs.max() + 1 + pad); y0, y1 = max(0, ys.min() - pad), min(alpha.shape[0], ys.max() + 1 + pad)
    fw, fh = x1 - x0, y1 - y0; n = len(fr)
    cols = max(1, min(n, round(np.sqrt(n * fh / fw)))); rows = int(np.ceil(n / cols))   # a roughly square sheet
    sheet = np.zeros((rows * fh, cols * fw, 4), np.float32)
    for i, f in enumerate(fr):
        crop = f[y0:y1, x0:x1]; a = crop[..., 3]; rgb = crop[..., :3] / np.maximum(a, 1e-4)[..., None]
        rgb = bleed(rgb, a); r, c = divmod(i, cols)
        sheet[r * fh:(r + 1) * fh, c * fw:(c + 1) * fw] = np.dstack([rgb, a])
    cv2.imwrite(os.path.join(out, f'theron_dash_{d}.png'), np.clip(sheet * 255 + 0.5, 0, 255).astype(np.uint8))
    meta['dirs'][d] = {'w': int(fw), 'h': int(fh), 'cols': cols, 'rows': rows, 'pivot': [PIVOT[0] * SCALE - x0, PIVOT[1] * SCALE - y0]}
    meta['dirs'][d]['layers'] = [n for n in k.order if n not in EXCLUDE]
    print(d, meta['dirs'][d]['layers'], 'frame', fw, 'x', fh, 'grid', cols, 'x', rows, 'sheet', sheet.shape[1], 'x', sheet.shape[0])
json.dump(meta, open(os.path.join(out, 'dash.json'), 'w'), indent=1)
