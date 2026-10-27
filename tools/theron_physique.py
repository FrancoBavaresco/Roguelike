"""Theron's physique variants (proportions only) from public/models/characters/theron.glb.
Usage: python3 tools/theron_physique.py <in.glb> <out.glb> <variant name or JSON of factors>

The model is a humanoid rig (Hips > Spine > Chest > UpperChest > LeftShoulder/RightShoulder > …UpperArm…, Neck >
Head; bone Y runs along each bone). The clips only rotate bones: their translations are constant (the rest pose)
except Hips, and their scales are 1. So the proportions are changed in the rest pose, never in the motion:

  1 bone lengths (the skeleton itself): the collar bones (Left/RightShoulder) are made longer, so the arms sit
    further out — the shoulder width. The child joint moves in the rest pose and in every clip's translation keys by
    the same constant (rotations untouched), and the inverse bind matrices follow.
  2 volume (the mesh): a scale in a bone's own axes, about its origin, is baked into the rest-pose vertices through
    the skinning weights (v' = sum w_i * B'_i S_i B_i^-1 v), so it fades out where the weights hand over to the next
    bone: UpperChest wide and deep (chest and upper back), Chest a little (the taper), upper arms thicker (not longer),
    neck thicker, head a little bigger. Hips, legs, waist and the cloth bones are not touched: the waist stays narrow
    and the tunic does not move.
Normals (and tangents) follow with the inverse transpose. Both meshes (Theron and Theron_Outline) share the skin, so
the outline follows. Textures, materials and animation rotations are left exactly as they were.

Factors (all 1.0 = unchanged): collar (collar-bone length), chestW/chestD (UpperChest width/depth), midW/midD (Chest),
armR (upper-arm thickness), foreR (forearm thickness), neckR (neck thickness), head (head size)."""
import sys, json, struct, numpy as np

VARIANTS = {
    'A': dict(collar=1.22, chestW=1.13, chestD=1.08, midW=1.05, midD=1.03, armR=1.08, foreR=1.03, neckR=1.06, head=1.05),
    'B': dict(collar=1.38, chestW=1.22, chestD=1.14, midW=1.09, midD=1.05, armR=1.14, foreR=1.06, neckR=1.1, head=1.07),
}

def read(path):
    b = open(path, 'rb').read(); n = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + n]); off = 20 + n; bl = struct.unpack('<I', b[off:off + 4])[0]
    return j, bytearray(b[off + 8:off + 8 + bl])

def write(path, j, BIN):
    js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
    bn = bytes(BIN); bn += b'\0' * ((4 - len(bn) % 4) % 4)
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bn)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(bn), 0x004E4942) + bn
    open(path, 'wb').write(out)

CT = {5126: np.float32, 5123: np.uint16, 5121: np.uint8, 5125: np.uint32}; NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
def view(j, BIN, i):   # a writable numpy view of an accessor (tightly packed only)
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; dt = np.dtype(CT[a['componentType']]); c = NC[a['type']]
    if bv.get('byteStride') and bv['byteStride'] != c * dt.itemsize: raise SystemExit('interleaved buffers are not supported')
    o = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    arr = np.frombuffer(BIN, dt, a['count'] * c, o).reshape(a['count'], c)
    if a.get('normalized') and dt != np.float32: arr = arr.astype(np.float32) / np.iinfo(dt).max
    return arr

def trs(n):
    T = np.eye(4); t = n.get('translation', [0, 0, 0]); q = n.get('rotation', [0, 0, 0, 1]); s = n.get('scale', [1, 1, 1])
    x, y, z, w = q
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    T[:3, :3] = R * np.array(s); T[:3, 3] = t; return T

def main(src, dst, spec):
    f = dict(VARIANTS[spec]) if spec in VARIANTS else json.loads(spec)
    j, BIN = read(src); nodes = j['nodes']; skin = j['skins'][0]; joints = skin['joints']
    name = {n.get('name'): i for i, n in enumerate(nodes)}
    parent = {c: i for i, n in enumerate(nodes) for c in n.get('children', [])}
    def world(i):
        M = trs(nodes[i]); p = parent.get(i)
        while p is not None: M = trs(nodes[p]) @ M; p = parent.get(p)
        return M
    IBM = view(j, BIN, skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)   # column-major
    B = np.array([np.linalg.inv(m) for m in IBM])                                           # bind world matrices
    # the armature's parent (the mesh's frame) for comparing to the rest pose
    mesh_node = next(i for i, n in enumerate(nodes) if 'skin' in n)
    W0 = np.array([world(ji) for ji in joints]); Mw = world(mesh_node)
    err = np.abs(np.linalg.inv(Mw) @ W0 - B).max(); print('bind pose = rest pose, max error', round(float(err), 6))

    # 1 bone lengths: collar bones longer (their child joint, the upper arm, moves out along the collar bone's Y)
    newT = {}
    for side in ('Left', 'Right'):
        ua = name[side + 'UpperArm']; t = np.array(nodes[ua].get('translation', [0, 0, 0]), float)
        newT[ua] = t * np.array([1, f['collar'], 1])
        # the chest gets wider: the collar bones' own origins follow it sideways (in UpperChest's axes)
        sh = name[side + 'Shoulder']; t2 = np.array(nodes[sh].get('translation', [0, 0, 0]), float)
        newT[sh] = t2 * np.array([f['chestW'], 1, f['chestD']])
    for i, t in newT.items(): nodes[i]['translation'] = [float(x) for x in t]
    W1 = np.array([world(ji) for ji in joints]); B1 = np.array([np.linalg.inv(Mw) @ w for w in W1])
    # every clip: the same constant translation (the clips keep these bones at their rest offsets)
    for an in j['animations']:
        for ch in an['channels']:
            i = ch['target']['node']
            if ch['target']['path'] == 'translation' and i in newT:
                out = view(j, BIN, an['samplers'][ch['sampler']]['output'])
                if np.abs(out - out[0]).max() > 1e-4: raise SystemExit('translation of %s is animated: not safe' % nodes[i]['name'])
                out[:] = newT[i]

    # 2 volume: a scale per bone in its own axes (x, y = along the bone, z), about its origin
    S = {}
    def put(n, sx, sy, sz):
        if n in name and name[n] in joints: S[joints.index(name[n])] = np.diag([sx, sy, sz, 1.0])
    put('UpperChest', f['chestW'], 1, f['chestD']); put('Chest', f['midW'], 1, f['midD'])
    for side in ('Left', 'Right'):
        put(side + 'Shoulder', 1, f['collar'], 1)          # the collar bone itself stretches with its new length
        put(side + 'UpperArm', f['armR'], 1, f['armR']); put(side + 'LowerArm', f['foreR'], 1, f['foreR'])
    put('Neck', f['neckR'], 1, f['neckR']); put('Head', f['head'], f['head'], f['head'])
    # per joint: rest-space deformation D_i = B1_i S_i B_i^-1 (identity for untouched bones)
    D = np.array([B1[k] @ S.get(k, np.eye(4)) @ np.linalg.inv(B[k]) for k in range(len(joints))])
    Dn = np.array([np.linalg.inv(d[:3, :3]).T for d in D])

    done = set()
    for mi, mesh in enumerate(j['meshes']):
        for pr in mesh['primitives']:
            at = pr['attributes']; key = at['POSITION']
            if key in done: continue
            done.add(key)
            P = view(j, BIN, at['POSITION']); J = view(j, BIN, at['JOINTS_0']).astype(int); Wt = view(j, BIN, at['WEIGHTS_0']).astype(np.float64)
            Wt = Wt / np.maximum(Wt.sum(1, keepdims=True), 1e-9)
            P1 = np.c_[P, np.ones(len(P))]
            M = np.einsum('vk,vkab->vab', Wt, D[J])                   # blended 4x4 per vertex
            P[:] = np.einsum('vab,vb->va', M, P1)[:, :3]
            if 'NORMAL' in at:
                N = view(j, BIN, at['NORMAL']); Mn = np.einsum('vk,vkab->vab', Wt, Dn[J]); n2 = np.einsum('vab,vb->va', Mn, N)
                N[:] = n2 / np.maximum(np.linalg.norm(n2, axis=1, keepdims=True), 1e-9)
            if 'TANGENT' in at:
                T4 = view(j, BIN, at['TANGENT']); t2 = np.einsum('vab,vb->va', M[:, :3, :3], T4[:, :3])
                T4[:, :3] = t2 / np.maximum(np.linalg.norm(t2, axis=1, keepdims=True), 1e-9)
            a = j['accessors'][at['POSITION']]; a['min'] = [float(x) for x in P.min(0)]; a['max'] = [float(x) for x in P.max(0)]
    # new inverse bind matrices
    IBM[:] = np.array([np.linalg.inv(b) for b in B1])
    view(j, BIN, skin['inverseBindMatrices'])[:] = IBM.transpose(0, 2, 1).reshape(-1, 16)
    j.setdefault('asset', {})['extras'] = {'physique': f}
    write(dst, j, BIN)
    # height change (the game fits the model to a height from its bounding box)
    print('variant', spec, f)

if __name__ == '__main__':
    main(*sys.argv[1:4])
