"""Pack the NPC walk sheets (256x768 each) into one lossless PNG atlas per village group, for lazy loading.

    /tmp/imgvenv/bin/python scripts/octo/build_atlas.py

Reads content/npcs/*.json (read only) and writes
    public/assets/sprites/npc_atlas_<group>.png   (oxipng-optimised, pixel-identical to the sheets)
    public/assets/sprites/npc_atlas.json          (manifest, format in docs/phase1/PROGRESS.md "# NPC cast rev")
Groups are the six villages plus 'harbor' (harbor, airport, rental and dive shop: the roaming outsiders).
"""
import glob
import json, math, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CH = os.path.join(ROOT, 'public/assets/sprites/characters')
OUT = os.path.join(ROOT, 'public/assets/sprites')
VILLAGES = ['yayo', 'iraraley', 'iranmeylek', 'ivalino', 'imorod', 'iratay']
# homes that are not a village name -> the group whose atlas holds them
PLACE_GROUP = {'yayo_school': 'yayo', 'yayo_shop': 'yayo', 'clinic': 'imorod', 'clinic_yard': 'imorod',
               'host_weave': 'imorod',  # weaver_elder: proposed fixed home imorod (NPC_CAST.md)
               'harbor': 'harbor', 'airport': 'harbor', 'rental': 'harbor', 'dive_shop': 'harbor',
               'iranmeylek_beach': 'iranmeylek', 'iratay_school': 'iratay'}  # Phase B places
# a akes not yet in npcs.json (entries proposed in docs/phase1/NPC_CAST.md); packed now so the code worker
# only has to add the npcs.json entries
PROPOSED = {f'elder_f_{v}': v for v in ('yayo', 'iraraley', 'iranmeylek', 'iratay')}
SW, SH, COLS = 256, 768, 4


def main():
    # every content/npcs/*.json (new NPCs are data-only entries there)
    npcs = sorted(sum((json.load(open(p)).get('npcs', []) for p in glob.glob(os.path.join(ROOT, 'content/npcs/*.json'))), []), key=lambda n: n['id'])
    who = {n['id']: (n.get('sheet') or n['kind'], n.get('home', '')) for n in npcs}
    for i, v in PROPOSED.items():
        who.setdefault(i, (i, v))
    groups, npc_map = {}, {}
    for nid, (sheet, home) in who.items():
        g = home if home in VILLAGES else PLACE_GROUP.get(home)
        if g is None:
            sys.exit(f'no atlas group for {nid} home={home!r}: add it to PLACE_GROUP')
        groups.setdefault(g, [])
        if sheet not in groups[g]:
            groups[g].append(sheet)
        npc_map[nid] = {'atlas': g, 'sheet': sheet}
    man = {'version': 1, 'frame': {'w': 64, 'h': 96},
           'sheet': {'w': SW, 'h': SH, 'cols': 4, 'rows': 8,
                     'rows_dir': ['s', 'w', 'n', 'e'], 'walk_rows': [0, 1, 2, 3], 'idle_rows': [4, 5, 6, 7]},
           'filter': 'nearest', 'atlases': {}, 'npcs': dict(sorted(npc_map.items()))}
    import oxipng
    for g in VILLAGES + ['harbor']:
        sheets = sorted(groups.get(g, []))
        if not sheets:
            continue
        cols = min(COLS, math.ceil(len(sheets) / 2)); rows = math.ceil(len(sheets) / cols)  # 2 rows: no empty slots wasted in GPU memory
        at = Image.new('RGBA', (cols * SW, rows * SH), (0, 0, 0, 0))
        pos = {}
        for k, s in enumerate(sheets):
            x, y = (k % cols) * SW, (k // cols) * SH
            im = Image.open(os.path.join(CH, f'{s}_sheet.png')).convert('RGBA')
            assert im.size == (SW, SH), (s, im.size)
            at.paste(im, (x, y))
            pos[s] = {'x': x, 'y': y}
        fn = f'npc_atlas_{g}.png'
        p = os.path.join(OUT, fn)
        at.save(p, optimize=True)
        oxipng.optimize(p, level=6, strip=oxipng.StripChunks.safe(), deflate=oxipng.Deflaters.zopfli(15))
        chk = np.asarray(Image.open(p).convert('RGBA'))
        for s, q in pos.items():  # pixel-identical to the source sheet, alpha-0 texels (bleed) included
            src = np.asarray(Image.open(os.path.join(CH, f'{s}_sheet.png')).convert('RGBA'))
            assert (chk[q['y']:q['y'] + SH, q['x']:q['x'] + SW] == src).all(), s
        man['atlases'][g] = {'file': f'sprites/{fn}', 'w': at.width, 'h': at.height, 'bytes': os.path.getsize(p),
                             'sheets': pos}
        print(g, at.size, len(sheets), os.path.getsize(p))
    json.dump(man, open(os.path.join(OUT, 'npc_atlas.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
