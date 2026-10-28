"""Theron's thrust effect from the artist's Krita document (art/estocada_azul.kra, 512 px, drawn left → right).
Usage: python3 -I tools/kra_thrust.py art/estocada_azul.kra public/textures/fx/thrust

The document holds the effect as a sequence of drawings, one per paint layer, stacked bottom (first) to top (last):
a star at the origin, the launch, the rune charging and travelling forward, the shock shapes, the speed lines, the
white impact and the big star at the end. "Fondo" (the frame and the guide line of the blade) is not part of it.
Every drawing is kept exactly as painted (colours, outlines, transparency); each one is cropped to its own paint,
and all are packed into one atlas (thrust_atlas.png, power of two, 2 px apart, edge colours bled into the empty
pixels so filtering never pulls in a fringe). thrust.json lists, in play order, each frame's rectangle in the atlas
and in the painting, plus the painting's origin (the star where the thrust starts), its end (the big star) and the
guide line's height.
Needs numpy and opencv."""
import sys, os, json, re, zipfile, numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from brazier_sprites import decode, bleed   # Krita tile decoding and edge bleeding (shared with the braziers)

PAD = 2

def frames(path):
    z = zipfile.ZipFile(path); doc = z.read('maindoc.xml').decode()
    im = re.search(r'<IMAGE[^>]*>', doc).group(0); name = re.search(r' name="([^"]+)"', im).group(1)
    W = int(re.search(r' width="(\d+)"', im).group(1)); H = int(re.search(r' height="(\d+)"', im).group(1))
    tags = re.findall(r'<layer [^>]*/>', doc)   # top of the stack first
    out, guide = [], None
    for tag in reversed(tags):                   # bottom first = play order
        nm = re.search(r' name="([^"]+)"', tag).group(1); fn = re.search(r' filename="([^"]+)"', tag).group(1)
        img = decode(z.read(f'{name}/layers/{fn}'), W, H)
        if nm == 'Fondo': guide = img; continue
        out.append((nm, fn, img))
    return out, guide, W, H

def bright(img):   # the brightest point of a drawing (the centre of a star)
    w = img[..., :3].astype(np.float32).sum(2) * (img[..., 3] / 255.0)
    y, x = np.unravel_index(np.argmax(cv2.GaussianBlur(w, (0, 0), 3)), w.shape); return [int(x), int(y)]

def pack(rects, side):
    """shelf packing, tallest first; returns positions or None if it does not fit"""
    order = sorted(range(len(rects)), key=lambda i: -rects[i][1]); pos = [None] * len(rects); x = y = sh = 0
    for i in order:
        w, h = rects[i][0] + 2 * PAD, rects[i][1] + 2 * PAD
        if x + w > side: x = 0; y += sh; sh = 0
        if y + h > side or w > side: return None
        pos[i] = (x + PAD, y + PAD); x += w; sh = max(sh, h)
    return pos

def main(kra, out):
    os.makedirs(out, exist_ok=True)
    F, guide, W, H = frames(kra)
    crops = []
    for nm, fn, img in F:
        ys, xs = np.nonzero(img[..., 3] > 0)
        x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
        crops.append((nm, fn, x0, y0, x1, y1, bleed(img)[y0:y1, x0:x1]))
    rects = [(c[4] - c[2], c[5] - c[3]) for c in crops]
    for side in (512, 1024, 2048):
        pos = pack(rects, side)
        if pos: break
    atlas = np.zeros((side, side, 4), np.uint8)
    meta = {'source': os.path.basename(kra), 'px': W, 'atlas': side, 'frames': []}
    for (nm, fn, x0, y0, x1, y1, im), (ax, ay) in zip(crops, pos):
        h, w = im.shape[:2]; atlas[ay:ay + h, ax:ax + w] = im
        # bleed into the 2 px gutter too (repeat the edge), so mipmaps of neighbours never meet paint
        atlas[ay - PAD:ay, ax:ax + w, :3] = im[0:1, :, :3]; atlas[ay + h:ay + h + PAD, ax:ax + w, :3] = im[-1:, :, :3]
        atlas[ay - PAD:ay + h + PAD, ax - PAD:ax, :3] = atlas[ay - PAD:ay + h + PAD, ax:ax + 1, :3]; atlas[ay - PAD:ay + h + PAD, ax + w:ax + w + PAD, :3] = atlas[ay - PAD:ay + h + PAD, ax + w - 1:ax + w, :3]
        meta['frames'].append({'layer': nm, 'file': fn, 'atlas': [ax, ay, w, h], 'rect': [x0, y0, w, h]})
    meta['origin'] = bright(F[0][2])           # the first star: where the thrust starts
    meta['end'] = bright(F[-1][2])             # the last (big) star: where it lands
    if guide is not None:                      # the guide line of the blade, inside the frame
        a = guide[..., 3]; inner = a[:, 90:W - 90] > 100; rows = np.nonzero(inner.sum(1) > 150)[0]
        mid = [r for r in rows if 160 < r < 320]; meta['axisY'] = float(np.mean(mid)) if mid else None
    cv2.imwrite(os.path.join(out, 'thrust_atlas.png'), atlas)
    json.dump(meta, open(os.path.join(out, 'thrust.json'), 'w'), indent=1)
    print('frames', len(crops), 'atlas', side, 'origin', meta['origin'], 'end', meta['end'], 'axisY', meta.get('axisY'))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
