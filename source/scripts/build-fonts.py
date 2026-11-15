#!/usr/bin/env python3
"""Subset self-hosted Noto Sans TC / Noto Serif TC (Traditional Chinese) to the glyphs the game uses.

Usage:  /workspace/.fontvenv/bin/python scripts/build-fonts.py
Needs:  fonttools + brotli.  Sources: fonts-src/*.otf (notofonts/noto-cjk SubsetOTF/TC, SIL OFL 1.1).
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
jobs = [
    ('NotoSansTC-Regular.otf', 'noto-sans-tc-400.woff2'),
    ('NotoSansTC-Medium.otf', 'noto-sans-tc-500.woff2'),
    ('NotoSansTC-Bold.otf', 'noto-sans-tc-700.woff2'),
    ('NotoSerifTC-SemiBold.otf', 'noto-serif-tc-600.woff2'),
    ('NotoSerifTC-Bold.otf', 'noto-serif-tc-700.woff2'),
]
os.makedirs('public/fonts', exist_ok=True)
for src, out in jobs:
    subprocess.check_call([sys.executable, '-m', 'fontTools.subset', f'fonts-src/{src}',
        '--text-file=/tmp/tao-font-chars.txt', '--flavor=woff2', '--layout-features=kern,liga,palt,locl',
        '--no-hinting', '--desubroutinize', f'--output-file=public/fonts/{out}'])
    print(out, os.path.getsize(f'public/fonts/{out}') // 1024, 'KB')
# 手札 notebook (2026-11): 芫荽 Iansui (ButTaiwan/iansui v1.020, OFL) for handwritten content,
# Literata (google/fonts, OFL) for Tao / Latin — static instances, Latin + Tao accents only
subprocess.check_call([sys.executable, '-m', 'fontTools.subset', 'fonts-src/Iansui-Regular.ttf',
    '--text-file=/tmp/tao-font-chars.txt', '--flavor=woff2', '--layout-features=kern,liga,palt,locl',
    '--no-hinting', '--desubroutinize', '--output-file=public/fonts/iansui-400.woff2'])
print('iansui-400.woff2', os.path.getsize('public/fonts/iansui-400.woff2') // 1024, 'KB')
latin = ''.join(chr(c) for c in range(0x20, 0x7f)) + '’ʼ‘“”–—…·ÁÉÍÓÚáéíóúÀÈÌÒàèìòâêîôŋə\u0301'
open('/tmp/tao-latin-chars.txt', 'w', encoding='utf-8').write(latin)
for src, wght, out in [('Literata-VF.ttf', 400, 'literata-400.woff2'), ('Literata-VF.ttf', 600, 'literata-600.woff2'), ('Literata-Italic-VF.ttf', 400, 'literata-400i.woff2')]:
    tmp = f'/tmp/{out}.ttf'
    subprocess.check_call([sys.executable, '-m', 'fontTools.varLib.instancer', f'fonts-src/{src}', f'wght={wght}', 'opsz=14', '-o', tmp, '-q'])
    subprocess.check_call([sys.executable, '-m', 'fontTools.subset', tmp, '--text-file=/tmp/tao-latin-chars.txt', '--flavor=woff2',
        '--layout-features=kern,liga,mark,mkmk,ccmp', '--no-hinting', f'--output-file=public/fonts/{out}'])
    print(out, os.path.getsize(f'public/fonts/{out}') // 1024, 'KB')
print(len(chars), 'glyphs requested')
