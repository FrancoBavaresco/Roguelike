import numpy as np
from PIL import Image
rng = np.random.default_rng(0xF100D)
M = 16; PX = 128; S = M * PX            # 16 m pattern, 128 px per metre
SRC_M = {'cartago': 12.0, 'rock06': 4.0, 'face03': 5.0}   # metres each source covers (cartago's own slabs ~1 m wide)
names = ['cartago', 'rock06', 'face03']
src = {}
for n in names:
    k = int(SRC_M[n] * PX)                 # resample the 1K source so it covers SRC_M metres at PX px/m
    src[n] = dict(c=np.asarray(Image.open(n + '_diff.png').resize((k, k), Image.LANCZOS), np.float32) / 255,
                  n=np.asarray(Image.open(n + '_nor.png').resize((k, k), Image.LANCZOS), np.float32) / 255 * 2 - 1,
                  r=np.asarray(Image.open(n + '_rough.png').convert('L').resize((k, k), Image.LANCZOS), np.float32) / 255)
# sector map: periodic value noise over the 16x16 cells -> material per cell, grouped in patches
G = 4; lat = rng.random((G, G, 3))
def noise(u, v, f, ch):
    x, y = u * f, v * f; xi, yi = int(np.floor(x)), int(np.floor(y)); tx, ty = x - xi, y - yi; s = lambda t: t * t * (3 - 2 * t)
    a = lambda i, j: lat[j % G, i % G, ch]
    return (a(xi, yi) * (1 - s(tx)) + a(xi + 1, yi) * s(tx)) * (1 - s(ty)) + (a(xi, yi + 1) * (1 - s(tx)) + a(xi + 1, yi + 1) * s(tx)) * s(ty)
mat = np.zeros((M, M), int)
for j in range(M):
    for i in range(M):
        w = [noise((i + .5) / M, (j + .5) / M, G, c) for c in range(3)]; w[0] *= 1.08; w[2] *= 1.18   # balance the three
        mat[j, i] = int(np.argmax(w))
        if rng.random() < 0.12: mat[j, i] = rng.integers(3)                           # loose tiles mixed in
# tiles: greedy merge into 2x2 / 2x1 / 1x2 inside one material
used = np.zeros((M, M), bool); tiles = []
for j in range(M):
    for i in range(M):
        if used[j, i]: continue
        m = mat[j, i]; opts = [(2, 2), (2, 1), (1, 2), (1, 1)]; rng.shuffle(opts[:3])
        for w, h in opts + [(1, 1)]:
            if rng.random() < (0.55 if (w, h) != (1, 1) else 1) and i + w <= M and j + h <= M and not used[j:j + h, i:i + w].any() and (mat[j:j + h, i:i + w] == m).all():
                used[j:j + h, i:i + w] = True; tiles.append((i, j, w, h, m)); break
col = np.zeros((S, S, 3), np.float32); nor = np.zeros((S, S, 3), np.float32); rough = np.zeros((S, S), np.float32)
J, BEV = 3, 6
for (i, j, w, h, m) in tiles:
    s = src[names[m]]; k = s['c'].shape[0]; W, H = w * PX, h * PX
    rot = int(rng.integers(4)); ox, oy = int(rng.integers(k)), int(rng.integers(k))
    ys = (np.arange(H)[:, None] + oy) % k; xs = (np.arange(W)[None, :] + ox) % k
    c = s['c'][ys, xs]; nn = s['n'][ys, xs]; r = s['r'][ys, xs]
    # rotate the sample (features and normals turn together); square tiles only get all four turns
    if w == h:
        for _ in range(rot): c = np.rot90(c); r = np.rot90(r); nn = np.rot90(nn); nn = np.stack([-nn[..., 1], nn[..., 0], nn[..., 2]], -1)
    tone = 0.86 + rng.random() * 0.22
    yy, xx = np.mgrid[0:H, 0:W]; edge = np.minimum(np.minimum(xx, yy), np.minimum(W - 1 - xx, H - 1 - yy)).astype(np.float32)
    k_b = np.clip((edge - J) / BEV, 0, 1)[..., None]
    cc = c * tone * (0.78 + 0.22 * k_b); cc = np.where(edge[..., None] < J, 0.06, cc)
    # bevel normal: tilt toward the nearest edge
    bx = np.where(xx < BEV + J, -1, np.where(W - 1 - xx < BEV + J, 1, 0)); by = np.where(yy < BEV + J, 1, np.where(H - 1 - yy < BEV + J, -1, 0))
    inb = (edge >= J) & (edge < J + BEV)
    nb = np.stack([bx * 0.55, by * 0.55, np.ones_like(edge)], -1); nb /= np.linalg.norm(nb, axis=-1, keepdims=True)
    nn = np.where(inb[..., None], nb, nn); nn = np.where((edge < J)[..., None], np.array([0, 0, 1.0]), nn)
    rr = np.where(edge < J, 1.0, r)
    col[j * PX:j * PX + H, i * PX:i * PX + W] = cc; nor[j * PX:j * PX + H, i * PX:i * PX + W] = nn; rough[j * PX:j * PX + H, i * PX:i * PX + W] = rr
# dungeon grade: a little darker and less saturated than the scans
lum = (col * [0.299, 0.587, 0.114]).sum(-1, keepdims=True); col = (col * 0.72 + lum * 0.28) * 0.82
Image.fromarray((np.clip(col, 0, 1) * 255 + .5).astype(np.uint8)).save('floor_mix_color.jpg', quality=86)
nn = nor / np.linalg.norm(nor, axis=-1, keepdims=True); Image.fromarray(((nn * 0.5 + 0.5) * 255 + .5).astype(np.uint8)).save('floor_mix_nor.jpg', quality=90)
Image.fromarray((np.clip(rough, 0, 1) * 255 + .5).astype(np.uint8)).resize((S // 2, S // 2), Image.LANCZOS).save('floor_mix_rough.jpg', quality=88)
import os; print(len(tiles), 'tiles', {f: os.path.getsize(f) for f in os.listdir('.') if f.startswith('floor_mix')}, 'mat counts', np.bincount(mat.ravel()))
Image.open('floor_mix_color.jpg').resize((768, 768)).save('mix_preview.png')
