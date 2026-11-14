"""Style test: 24x24 pixel-art item icons (inventory / HUD / on the ground), same palette logic as the sprites.
    /tmp/imgvenv/bin/python scripts/octo/item_icons.py  ->  art-src/style-test/icon_<item>.png"""
from PIL import Image
PAL = {'o': '#2A2018', 'b': '#2C4A78', 'B': '#4F78A8', 's': '#C8D4DC', 'w': '#F2F4F2', 'e': '#101010', 'f': '#E4ECF0', 'F': '#9DB0BE',
       'G': '#5E9A48', 'g': '#A9CF7A', 'l': '#A8C77A', 'c': '#9A6A42', 'C': '#7A4E2E', 'D': '#5A3820', 'r': '#8A6A4A',
       'P': '#8A3A5A', 'p': '#B05A78', 'Q': '#5E2440', 'y': '#F0B840', 'Y': '#F8D878', 'v': '#6A8A3A'}
ICONS = {
 'flyingfish': [
  "........................", "..........oo............", "..........ofo...........", "...........ofo..........",
  "...........offo.........", "............offo........", "............offfo.......", ".............offfo......",
  "oo...........oFffo......", "ofo.....oooooooFffoo....", ".ofo..oobbbbbbbbbbbbboo.", "..ofoobBBBBbbbbbbbbbbwbo",
  "..oFFbbbbbbbbbbbbbbbwebo", "..ofosssssssssssssssswso", ".ofo..ossssssssssssssoo.", "ofo....oooooFfoooooo....",
  "oo.........oFffo........", "...........offfo........", "..........offfo.........", "..........offo..........",
  ".........offo...........", ".........ofo............", ".........oo.............", "........................"],
 'taro': [
  "........................", "...ooo..........ooo.....", "..oGGGoo......ooGGGo....", ".oGGgGGGo....oGGGgGGo...",
  ".oGGGgGGGo..oGGGgGGGo...", ".oGGGGgGGo..oGGgGGGGo...", "..oGGGGgGo..oGgGGGGo....", "...oGGGGGo..oGGGGGo.....",
  "....ooGGoo..ooGGoo......", "......olo....olo........", ".......olo..olo.........", "........olloll..........",
  ".........olll...........", ".........olllo..........", "........ooccoo..........", "......ooCCccCCoo........",
  ".....oCCcCCCcCCCo.......", ".....oCcCCcCCCcCo.......", ".....oCCCCCcCCCCo.......", ".....oDCCcCCCCcDo.......",
  "......oDDCCCCDDo........", ".......ooDDDDoo.........", "........r.r.r.r.........", "........................"],
 'sweetpotato': [
  "........................", "..................oo....", "...............oooGGo...", "..............oGGGGGo...",
  ".............oGGgGGo....", "......oooo...oGGGGo.....", "....ooPPPPoo..oovo......", "...oPPpPPPPPo...v.......",
  "..oPPPPPpPPPPo..v.......", "..oPpPPPPPPPPPoov.......", ".oPPPPPPpPPPPPPo........", ".oPPPPPPPPPPpPPo........",
  ".oQPPPPPPPPPPPPoooo.....", "..oQPPPpPPPPPoPPPPPoo...", "..oQQPPPPPPPoPPPPpPPPo..", "...ooQQQQQoyyoPPPPPPPPo.",
  ".....ooooyyYyyoPPPpPPPo.", "........oyYyyyoPPPPPPQo.", "........oyyyYyoQPPPPQo..", "........oyyyyyoQQQQQo...",
  ".........oyyyoooooooo...", "..........ooo...........", "........................", "........................"],
}
for k, rows in ICONS.items():
    im = Image.new('RGBA', (24, 24), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r.ljust(24, '.')[:24]):
            if ch != '.':
                im.putpixel((x, y), Image.new('RGB', (1, 1), PAL[ch]).getpixel((0, 0)) + (255,))
    im.save(f'art-src/style-test/icon_{k}.png')
