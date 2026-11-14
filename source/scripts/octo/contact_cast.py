"""Contact sheets for the NPC cast (portrait + in-game sprite).
    /tmp/imgvenv/bin/python scripts/octo/contact_cast.py
  -> screenshots-cast/key-npcs.png (key NPCs, elders paired by village) and screenshots-cast/ambient.png (bases x outfits)"""
import glob
import json
from PIL import Image, ImageDraw, ImageFont
FT = 'fonts-src/Iansui-Regular.ttf'
F, Fm, Fs, Fh = (ImageFont.truetype(FT, n) for n in (24, 20, 15, 26))
BG, CARD, INK, SUB = (69, 98, 105), (246, 241, 230), (40, 40, 40), (120, 116, 108)
S = 2


def sprite(k):
    return Image.open(f'public/assets/sprites/characters/{k}_sheet.png').convert('RGBA').crop((0, 384, 64, 480)).resize((64 * S, 96 * S), Image.NEAREST)


def portrait(k, w, h):
    p = Image.open(f'public/assets/portraits/{k}.webp').convert('RGBA')
    s = min(w / p.width, h / p.height)
    return p.resize((round(p.width * s), round(p.height * s)), Image.LANCZOS)


def ctext(d, cx, y, t, f, col):
    d.text((cx - d.textlength(t, font=f) / 2, y), t, fill=col, font=f)


def key_sheet():
    names = {n['id']: n for p in glob.glob('content/npcs/*.json') for n in json.load(open(p)).get('npcs', [])}
    add = {n['id']: n for n in json.load(open('docs/phase1/npcs_additions.json'))['npcs']}
    cards = []  # (portrait/sheet id, label, tao)
    for v in ['yayo', 'iraraley', 'iranmeylek', 'ivalino', 'imorod', 'iratay']:
        n = names[f'elder_{v}']; cards.append((f'elder_{v}', n['name']['zh'] + '（男）', n['name']['tao']))
        if v == 'ivalino':
            cards.append(('villager_taro', '水芋田長輩（女）', '野銀的女性長輩'))
        elif v == 'imorod':
            cards.append(('weaver_elder', '織布長輩（女）', '紅頭的女性長輩'))
        else:
            a = add[f'elder_f_{v}']; cards.append((f'elder_f_{v}', a['name']['zh'], a['name']['tao'] + '　新'))
    for i, lab in [('villager_iranmeylek', '東清的族人'), ('villager_iratay', '漁人的族人'), ('villager_harbor', '拼板舟漁人'),
                   ('teacher_yayo', '族語老師'), ('shop_yayo', '雜貨店老闆'), ('rental_owner', '租車行老闆'), ('dive_coach', '潛水教練'),
                   ('nurse', '衛生所護理師'), ('harbor_staff', '開元港港務人員'), ('clinic_doctor', '衛生所醫師'), ('nutritionist', '營養師'),
                   ('culture_worker', '部落文化工作者'), ('geologist', '地質學家'), ('researcher', '東清灣的旅人'), ('tourist', '剛下飛機的訪客')]:
        cards.append((i, lab, '新面孔' if i.startswith('villager_ir') else ''))
    SPR = {'nurse': 'clinic', 'harbor_staff': 'harbor', 'researcher': 'player_researcher'}
    cols, cw, chh, pad = 9, 210, 330, 12
    rows = (len(cards) + cols - 1) // cols
    img = Image.new('RGBA', (pad + cols * (cw + pad), 50 + rows * (chh + pad)), BG + (255,)); d = ImageDraw.Draw(img)
    d.text((pad, 12), f'關鍵角色・{len(cards)} 位（繪像＋遊戲內角色圖；長輩按部落男女成對）', fill=(240, 240, 235), font=Fh)
    for k, (pid, lab, tao) in enumerate(cards):
        x, y = pad + (k % cols) * (cw + pad), 50 + (k // cols) * (chh + pad)
        d.rounded_rectangle((x, y, x + cw, y + chh), 6, fill=CARD)
        p = portrait(pid, cw - 10, 236); img.alpha_composite(p, (x + (cw - p.width) // 2, y + 6 + 236 - p.height))
        sp = sprite(SPR.get(pid, pid)).resize((64, 96), Image.NEAREST); img.alpha_composite(sp, (x + cw - 66, y + 246 - 96))
        ctext(d, x + cw / 2, y + 250, lab, Fm, INK)
        if tao:
            ctext(d, x + cw / 2, y + 278, tao, Fs, SUB)
        ctext(d, x + cw / 2, y + 302, pid, Fs, SUB)
    img.convert('RGB').save('screenshots-cast/key-npcs.png')


def ambient_sheet():
    bases = [('auntie', '部落阿姨・爸媽輩', ['scarf']), ('uncle', '部落叔叔・爸媽輩', ['cap']), ('youth_f', '部落青年・女', ['stripe', 'denim']),
             ('youth_m', '部落青年・男', ['black', 'shirt']), ('girl', '部落女孩', ['orange', 'pink']), ('boy', '部落男孩', ['green', 'red'])]
    cw, chh, pad = 500, 420, 12
    img = Image.new('RGBA', (pad + 3 * (cw + pad), 50 + 2 * (chh + pad)), BG + (255,)); d = ImageDraw.Draw(img)
    d.text((pad, 12), '部落裡的族人・6 種基本樣貌 × 衣服變化（同一張繪像）', fill=(240, 240, 235), font=Fh)
    for k, (b, lab, outs) in enumerate(bases):
        x, y = pad + (k % 3) * (cw + pad), 50 + (k // 3) * (chh + pad)
        d.rounded_rectangle((x, y, x + cw, y + chh), 6, fill=CARD)
        p = portrait(b, 240, 340); img.alpha_composite(p, (x + 6, y + 6 + 340 - p.height))
        for j, o in enumerate([None] + outs):
            sp = sprite(b if o is None else f'{b}__{o}')
            sp = sp.resize((sp.width * 3 // 4, sp.height * 3 // 4), Image.NEAREST)
            img.alpha_composite(sp, (x + 250 + j * 80, y + 346 - sp.height))
        ctext(d, x + cw / 2, y + 356, lab, F, INK)
        ctext(d, x + cw / 2, y + 390, '  •  '.join([b] + outs), Fs, SUB)
    img.convert('RGB').save('screenshots-cast/ambient.png')


if __name__ == '__main__':
    key_sheet(); ambient_sheet()
