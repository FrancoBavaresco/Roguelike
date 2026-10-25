"""Theron's slash textures from the Krita document (art/theron_slash_v3.kra).
Usage: python3 tools/kra_slash.py art/theron_slash_v3.kra public/textures/fx
Decodes the three paint layers ("Capa de pintura 1/2/3": the three stages of the slash) from Krita's tile format
(VERSION 2, LZF) and writes theron_slash_1..3.png (512x512 RGBA). Transparent pixels get the colour of the nearest
paint, so texture filtering never pulls in white or black fringes. Capa 1 had a faint stray brush ring (a 27 px circle
at 270,165), which is removed. Needs numpy and opencv."""
import sys, zipfile, re, numpy as np, cv2

def lzf(data):
    out = bytearray(); i = 0; n = len(data)
    while i < n:
        c = data[i]; i += 1
        if c < 32:
            l = c + 1; out += data[i:i + l]; i += l
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
        t = np.frombuffer(raw, np.uint8)[:tw * th * ps].reshape(ps, th, tw).transpose(1, 2, 0)   # planar BGRA → pixels
        x, y = int(x), int(y)
        x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + tw), min(H, y + th)
        if x1 > x0 and y1 > y0: img[y0:y1, x0:x1] = t[y0 - y:y1 - y, x0 - x:x1 - x]
    return img   # BGRA

def bleed(img):
    a = img[:, :, 3].astype(np.float32) / 255; c = img[:, :, :3].astype(np.float32)
    w = (a > 0.02).astype(np.float32); out = c.copy(); have = w.copy()
    for s in (2, 4, 8, 16, 32):
        num = cv2.GaussianBlur(c * w[..., None], (0, 0), s); den = cv2.GaussianBlur(w, (0, 0), s)
        fill = (have < 0.5) & (den > 1e-4); out[fill] = (num / np.maximum(den, 1e-4)[..., None])[fill]; have[fill] = 1
    out[w > 0] = c[w > 0]
    return np.dstack([np.clip(out, 0, 255), img[:, :, 3]]).astype(np.uint8)

kra, outdir = sys.argv[1], sys.argv[2]
z = zipfile.ZipFile(kra); doc = z.read('maindoc.xml').decode()
W, H = int(re.search(r'<IMAGE[^>]* width="(\d+)"', doc).group(1)), int(re.search(r'<IMAGE[^>]* height="(\d+)"', doc).group(1))
name = re.search(r'<IMAGE[^>]* name="([^"]+)"', doc).group(1)
layers = {m.group(2): m.group(1) for m in re.finditer(r'<layer[^>]*?filename="([^"]+)"[^>]*?/>', doc) for _ in [0] if False}
for tag in re.findall(r'<layer [^>]*/>', doc):
    nm = re.search(r' name="([^"]+)"', tag).group(1); fn = re.search(r' filename="([^"]+)"', tag).group(1); layers[nm] = fn
for k in (1, 2, 3):
    img = decode(z.read(f'{name}/layers/{layers[f"Capa de pintura {k}"]}'), W, H)
    if k == 1:   # the stray brush ring
        yy, xx = np.mgrid[0:H, 0:W]; d = np.hypot(xx - 270, yy - 165); img[(d > 19) & (d < 33), 3] = 0
    cv2.imwrite(f'{outdir}/theron_slash_{k}.png', bleed(img))
    print(k, layers[f"Capa de pintura {k}"], 'alpha>0 %.3f' % (img[:, :, 3] > 0).mean())
