import random, os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tex"); os.makedirs(OUT, exist_ok=True)
from PIL import Image, ImageDraw, ImageFilter
random.seed(7)
S=512
def noise(d,n,cols,a=(20,80),sz=(2,5)):
    for _ in range(n):
        x,y=random.randrange(S),random.randrange(S); r=random.randint(*sz)
        c=random.choice(cols); d.rectangle([x,y,x+r,y+r],fill=c+(random.randint(*a),))
def planks(base=(176,120,72)):
    im=Image.new("RGB",(S,S),base); d=ImageDraw.Draw(im,"RGBA")
    for i in range(140):
        y=random.randrange(S); col=(90,55,25,random.randint(25,70)); w=random.randint(1,3)
        pts=[(x, y+random.uniform(-3,3)) for x in range(0,S+32,32)]; d.line(pts,fill=col,width=w)
    for k,y in enumerate(range(0,S,64)):
        d.rectangle([0,y,S,y+4],fill=(60,35,18,200))
        x=(k%2)*256+120; d.rectangle([x,y,x+4,y+64],fill=(60,35,18,200))
        for nx in (x-14,x+18): d.ellipse([nx,y+28,nx+6,y+34],fill=(70,50,40,220))
    noise(d,3000,[(255,240,220),(60,40,20)],(10,35))
    return im.filter(ImageFilter.GaussianBlur(0.6))
def wood(): 
    im=Image.new("RGB",(S,S),(168,112,64)); d=ImageDraw.Draw(im,"RGBA")
    for i in range(220):
        y=random.randrange(S); d.line([(x,y+random.uniform(-2,2)) for x in range(0,S+32,32)],fill=(90,55,25,random.randint(20,60)),width=random.randint(1,3))
    for _ in range(4):
        x,y=random.randrange(S),random.randrange(S); 
        for r in range(4,22,4): d.ellipse([x-r*1.8,y-r,x+r*1.8,y+r],outline=(80,48,22,90),width=2)
    return im.filter(ImageFilter.GaussianBlur(0.7))
def shingles():
    im=Image.new("RGB",(S,S),(70,45,38)); d=ImageDraw.Draw(im,"RGBA")
    for row in range(-1,9):
        for c in range(-1,9):
            x=c*64+(row%2)*32; y=row*64
            col=(random.randint(110,150),random.randint(55,75),random.randint(45,60),255)
            d.rounded_rectangle([x+2,y+2,x+62,y+70],radius=18,fill=col,outline=(55,32,26,255),width=3)
    noise(d,2500,[(0,0,0),(255,220,200)],(10,40))
    return im
def stone():
    im=Image.new("RGB",(S,S),(150,146,140)); d=ImageDraw.Draw(im,"RGBA")
    for _ in range(60):
        x,y=random.randrange(S),random.randrange(S); r=random.randint(20,60); g=random.randint(130,185)
        d.ellipse([x-r,y-r*0.7,x+r,y+r*0.7],fill=(g,g-4,g-10,90))
    noise(d,8000,[(60,60,60),(230,230,225)],(20,70),(1,3))
    return im.filter(ImageFilter.GaussianBlur(1))
def dirt():
    im=Image.new("RGB",(S,S),(196,160,110)); d=ImageDraw.Draw(im,"RGBA")
    noise(d,12000,[(150,115,75),(225,195,150),(120,90,60)],(30,110),(1,4))
    return im.filter(ImageFilter.GaussianBlur(0.8))
def water():
    im=Image.new("RGB",(S,S),(70,160,215)); d=ImageDraw.Draw(im,"RGBA")
    for _ in range(70):
        x,y=random.randrange(S),random.randrange(S); r=random.randint(10,34)
        d.arc([x-r,y-r*0.6,x+r,y+r*0.6],200,340,fill=(225,245,255,150),width=3)
    return im.filter(ImageFilter.GaussianBlur(1.2))
def bark():
    im=Image.new("RGB",(S,S),(120,82,52)); d=ImageDraw.Draw(im,"RGBA")
    for _ in range(160):
        x=random.randrange(S); d.line([(x+random.uniform(-4,4),y) for y in range(0,S+32,32)],fill=(70,45,25,random.randint(60,140)),width=random.randint(2,5))
    noise(d,3000,[(190,150,110)],(20,60))
    return im.filter(ImageFilter.GaussianBlur(0.6))
def hay():  # Day 5: straw for my meteor-watching hay bales
    im=Image.new("RGB",(S,S),(214,178,92)); d=ImageDraw.Draw(im,"RGBA")
    for _ in range(2600):
        x,y=random.randrange(S),random.randrange(S); L=random.randint(14,46); a=random.uniform(-0.35,0.35)
        c=random.choice([(250,222,140),(176,136,58),(236,200,110),(150,112,48)])
        d.line([(x,y),(x+L,y+L*a)],fill=c+(random.randint(90,200),),width=random.randint(1,3))
    return im.filter(ImageFilter.GaussianBlur(0.5))
def plaid():  # Day 5: a red-and-navy tartan blanket
    im=Image.new("RGB",(S,S),(178,40,44)); d=ImageDraw.Draw(im,"RGBA")
    for k in range(0,S,128):
        for (o,w,c) in ((0,40,(30,40,90,190)),(64,10,(250,230,180,150)),(92,6,(20,25,50,200))):
            d.rectangle([k+o,0,k+o+w,S],fill=c); d.rectangle([0,k+o,S,k+o+w],fill=c)
    noise(d,4000,[(0,0,0),(255,240,230)],(10,30),(1,2))
    return im.filter(ImageFilter.GaussianBlur(0.6))
def clay():  # Day 8: cob (clay + sand + straw) for my earth oven, smoothed by hand
    im=Image.new("RGB",(S,S),(196,132,92)); d=ImageDraw.Draw(im,"RGBA")
    for _ in range(90):
        x,y=random.randrange(S),random.randrange(S); r=random.randint(18,70); g=random.randint(-18,18)
        d.ellipse([x-r,y-r*0.8,x+r,y+r*0.8],fill=(196+g,132+g,92+g,70))
    for _ in range(500):   # straw bits poking out of the plaster
        x,y=random.randrange(S),random.randrange(S); L=random.randint(6,18); a=random.uniform(-1,1)
        d.line([(x,y),(x+L,y+L*a)],fill=(232,200,120,random.randint(90,170)),width=random.randint(1,2))
    noise(d,7000,[(150,95,62),(232,182,140)],(20,70),(1,3))
    return im.filter(ImageFilter.GaussianBlur(0.7))
def brick():  # Day 8: the arch around my oven door
    im=Image.new("RGB",(S,S),(222,212,196)); d=ImageDraw.Draw(im,"RGBA")
    for row in range(8):
        for c in range(-1,5):
            x=c*128+(row%2)*64; y=row*64
            col=(random.randint(160,190),random.randint(68,88),random.randint(52,66),255)
            d.rounded_rectangle([x+5,y+5,x+123,y+59],radius=6,fill=col)
    noise(d,6000,[(90,40,30),(240,190,160)],(15,55),(1,3))
    return im.filter(ImageFilter.GaussianBlur(0.7))
def ripstop():  # Day 8 bonus: kite cloth. Light nylon with a tiny square grid of thicker threads (so a rip can't run)
    im=Image.new("RGB",(S,S),(246,244,240)); d=ImageDraw.Draw(im,"RGBA")
    for k in range(0,S,16):
        d.line([(k,0),(k,S)],fill=(170,165,160,120),width=2); d.line([(0,k),(S,k)],fill=(170,165,160,120),width=2)
    noise(d,3000,[(255,255,255),(200,195,190)],(10,30),(1,2))
    return im.filter(ImageFilter.GaussianBlur(0.5))
for name,f in dict(ripstop=ripstop,planks=planks,wood=wood,shingles=shingles,stone=stone,dirt=dirt,water=water,bark=bark,hay=hay,plaid=plaid,clay=clay,brick=brick).items():
    f().convert("RGB").save(f"{OUT}/{name}.png")
print("ok")
