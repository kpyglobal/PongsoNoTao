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
# 0.1.6 loading: each weight is split in two. wenkai-*-core.woff2 = the start screens' characters (scripts/font-core.txt,
# plus ASCII and punctuation), preloaded and limited by unicode-range in fonts.css; wenkai-*.woff2 = every other
# glyph, only fetched once a screen needs it (the game also asks for it right after the title).
core = set(c for c in open('scripts/font-core.txt', encoding='utf-8').read() if ord(c) > 0x2e7f) & chars
basic = set(c for c in chars if ord(c) <= 0x2e7f)
core_text = ''.join(sorted(core | basic | set('，。、；：？！「」『』（）｜…　')))
rest_text = ''.join(sorted((chars - core) | basic))
open('/tmp/tao-font-core.txt', 'w', encoding='utf-8').write(core_text)
open('/tmp/tao-font-rest.txt', 'w', encoding='utf-8').write(rest_text)
ranges = []
for cp in sorted(ord(c) for c in core_text if ord(c) >= 0x20):
    if ranges and ranges[-1][1] == cp - 1: ranges[-1][1] = cp
    else: ranges.append([cp, cp])
urange = ', '.join(f'U+{a:X}' if a == b else f'U+{a:X}-{b:X}' for a, b in ranges)
open('/tmp/tao-font-core-range.txt', 'w').write(urange)
for src, stem in [('LXGWWenKaiTC-Regular.ttf', 'wenkai-400'), ('LXGWWenKaiTC-Medium.ttf', 'wenkai-500')]:
    for part, tf in [('-core', '/tmp/tao-font-core.txt'), ('', '/tmp/tao-font-rest.txt')]:
        out = f'{stem}{part}.woff2'
        subprocess.check_call([sys.executable, '-m', 'fontTools.subset', f'fonts-src/{src}',
            f'--text-file={tf}', '--flavor=woff2', '--layout-features=kern,liga,palt,locl',
            '--no-hinting', '--desubroutinize', f'--output-file=public/fonts/{out}'])
        print(out, os.path.getsize(f'public/fonts/{out}') // 1024, 'KB')
# fonts.css: the core faces come after the full ones, so they are checked first for the characters in their range
css = open('public/fonts/fonts.css', encoding='utf-8').read()
import re
css = re.sub(r'unicode-range: [^;]*;', f'unicode-range: {urange};', css)
open('public/fonts/fonts.css', 'w', encoding='utf-8').write(css)
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
