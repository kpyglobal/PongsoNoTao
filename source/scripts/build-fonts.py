#!/usr/bin/env python3
"""Subset the self-hosted game fonts to the glyphs the game uses (0.1.5 font set 霞光書卷).

Usage:  /workspace/.fontvenv/bin/python scripts/build-fonts.py
Needs:  fonttools + brotli.  Sources: fonts-src/ — LXGW WenKai TC Regular / Medium (lxgw/LxgwWenkaiTC, SIL OFL 1.1) for Chinese,
        Cormorant Garamond variable (CatharsisFonts/Cormorant via google/fonts, SIL OFL 1.1) for English / Tao.
Output: public/fonts/*.woff2 (served relatively as ./fonts/… so it works offline and under /Tao-rpg/).
"""
import glob, os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
chars = set()
files = glob.glob('src/**/*.*', recursive=True) + glob.glob('content/**/*.json', recursive=True) + glob.glob('content-pending/**/*.json', recursive=True) + glob.glob('public/*.css') + ['index.html'] + glob.glob('*.md')
for f in files:
    try:
        chars |= set(open(f, encoding='utf-8').read())
    except Exception:
        pass
chars |= set(chr(c) for c in range(0x20, 0x7f))
chars |= set('，。、；：？！「」『』（）《》〈〉｜—…‧·・～＋－／％＃＆＊【】〔〕“”‘’　０１２３４５６７８９☀☾◐◑')
# Tao (Yami) MOE orthography: glottal-stop letter ’ (U+2019), hyphen for n-g, stress accents on non-final syllables
chars |= set('’ʼ‘-ÁÉÍÓÚáéíóúÀÈÌÒàèìòâêîôŋə\u0301')
# a pool of frequent Traditional Chinese characters so small copy edits keep rendering in-font
chars |= set(open('scripts/tc-common.txt', encoding='utf-8').read()) if os.path.exists('scripts/tc-common.txt') else set()
chars = {c for c in chars if ord(c) >= 0x20}
text = ''.join(sorted(chars))
open('/tmp/tao-font-chars.txt', 'w', encoding='utf-8').write(text)
os.makedirs('public/fonts', exist_ok=True)
# Chinese (titles + body + notebook): 霞鶩文楷 TC
for src, out in [('LXGWWenKaiTC-Regular.ttf', 'wenkai-400.woff2'), ('LXGWWenKaiTC-Medium.ttf', 'wenkai-500.woff2')]:
    subprocess.check_call([sys.executable, '-m', 'fontTools.subset', f'fonts-src/{src}',
        '--text-file=/tmp/tao-font-chars.txt', '--flavor=woff2', '--layout-features=kern,liga,palt,locl',
        '--no-hinting', '--desubroutinize', f'--output-file=public/fonts/{out}'])
    print(out, os.path.getsize(f'public/fonts/{out}') // 1024, 'KB')
# English / Tao: Cormorant Garamond, static instances, Latin + Tao accents only. It runs small and thin, so the
# lightest face the game uses is 500 (fonts.css maps 400 to it); no italic face (Tao is never italic).
latin = ''.join(chr(c) for c in range(0x20, 0x7f)) + '’ʼ‘“”–—…·×ÁÉÍÓÚáéíóúÀÈÌÒàèìòâêîôŋə\u0301'
open('/tmp/tao-latin-chars.txt', 'w', encoding='utf-8').write(latin)
for wght in (500, 600, 700):
    out = f'cormorant-{wght}.woff2'
    tmp = f'/tmp/{out}.ttf'
    subprocess.check_call([sys.executable, '-m', 'fontTools.varLib.instancer', 'fonts-src/CormorantGaramond.ttf', f'wght={wght}', '-o', tmp, '-q'])
    subprocess.check_call([sys.executable, '-m', 'fontTools.subset', tmp, '--text-file=/tmp/tao-latin-chars.txt', '--flavor=woff2',
        '--layout-features=kern,liga,mark,mkmk,ccmp', '--no-hinting', f'--output-file=public/fonts/{out}'])
    print(out, os.path.getsize(f'public/fonts/{out}') // 1024, 'KB')
print(len(chars), 'glyphs requested')
