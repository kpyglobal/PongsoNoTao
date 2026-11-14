import json, glob, os
from PIL import Image, ImageDraw, ImageFont
W=1800; M=24; BG=(246,246,243)
F=lambda s: ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', s, index=3)
ft,fh,fl=F(44),F(30),F(19)
def lab(n):
    d=[json.load(open(p)) for p in glob.glob('content/npcs/*.json')]; m={}
    def walk(o):
        if isinstance(o,dict):
            if 'portrait' in o: m.setdefault(o['portrait'],o['name']['zh'] if isinstance(o.get('name'),dict) else o.get('name'))
            for v in o.values(): walk(v)
        elif isinstance(o,list):
            for v in o: walk(v)
    walk(d); return m
NM=lab(0); NM.update({'visitor':'旅人（女）','visitor_m':'旅人（男）','local':'族人嚮導','local_f':'族人（女）'})
def row(items,cols,cw,ch,title,nearest=False):
    rows=(len(items)+cols-1)//cols; H=50+rows*(ch+32)
    c=Image.new('RGB',(W,H),BG); d=ImageDraw.Draw(c); d.text((M,6),title,font=fh,fill=(40,32,26))
    gap=(W-2*M-cols*cw)//max(cols-1,1)
    for i,(im,t) in enumerate(items):
        x=M+(i%cols)*(cw+gap); y=50+(i//cols)*(ch+32)
        if im.mode=='RGBA':
            bg=Image.new('RGBA',im.size,(238,233,222,255)); bg.alpha_composite(im); im=bg
        im=im.convert('RGB').resize((cw,ch),Image.NEAREST if nearest else Image.LANCZOS)
        c.paste(im,(x,y)); d.text((x,y+ch+3),t,font=fl,fill=(60,50,40))
    return c
blocks=[]
head=Image.new('RGB',(W,90),BG); ImageDraw.Draw(head).text((M,18),'Pongso no Tao Phase A 全美術統一（水彩＋細墨線 v2／圖鑑 v3）',font=ft,fill=(30,24,20)); blocks.append(head)
order=['visitor','visitor_m','local','local_f']
ps=sorted(os.path.basename(f)[:-5] for f in glob.glob('public/assets/portraits/*.webp'))
ps=order+[p for p in ps if p not in order]
blocks.append(row([(Image.open(f'public/assets/portraits/{p}.webp'),NM.get(p,p)) for p in ps],10,160,204,f'① 人物畫像 {len(ps)} 張（330×420 透明背景 WebP；旅人為新定版臉，其餘臉型／服裝不變）'))
UW=[('u1','U1 浮潛（旅人無眼鏡）'),('u2','U2 深潛・魚群'),('u3_01','U3 小丑魚與海葵'),('u3_02','U3 綠蠵龜'),('u3_03','U3 桌形珊瑚')]
blocks.append(row([(Image.open(f'public/assets/underwater/{n}.webp'),t) for n,t in UW],3,568,320,'② 水下／收藏插畫 5 張（1600×900＋480×270 縮圖）'))
IT=[('alibangbang','飛魚'),('soli','水芋'),('wakay','地瓜'),('ovi','山藥'),('shellfish','貝類'),('seaweed','海菜'),('coconut','椰子'),('headlamp','頭燈'),('sunscreen','防曬'),('water','飲水'),('lifejacket','救生衣')]
blocks.append(row([(Image.open(f'public/assets/items/illus_{n}.webp'),t) for n,t in IT],6,270,270,'③ 圖鑑插畫 11 張（512×512 WebP，飛魚 v3 定版風格）'))
blocks.append(row([(Image.open(f'public/assets/items/icons/icon_{n}.png'),t) for n,t in IT],11,96,96,'④ 像素小圖示 11 個（24×24 PNG，放大 4 倍顯示）',nearest=True))
H=sum(b.height for b in blocks)+M
o=Image.new('RGB',(W,H),BG); y=0
for b in blocks: o.paste(b,(0,y)); y+=b.height
out='screenshots-style/phase-a-review.png'; o.save(out,optimize=True)
if os.path.getsize(out)>4.8e6:
    o.resize((1600,round(H*1600/W)),Image.LANCZOS).save(out,optimize=True)
print(o.size, os.path.getsize(out))
