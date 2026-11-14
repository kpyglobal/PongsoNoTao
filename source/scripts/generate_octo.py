"""方案二 歧路旅人風 character sprite generator (walk + idle, scooter, tatala).
Usage: python3 scripts/generate_octo.py [walk] [ride] [canoe]"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'octo'))
import build
build.main(sys.argv[1:] or ['walk', 'ride', 'canoe'])
