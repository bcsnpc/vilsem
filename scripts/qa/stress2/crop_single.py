"""Crop one complete authored card from an official bridge PNG, never a Sky image."""
from PIL import Image,ImageChops
import sys
im=Image.open(sys.argv[1]).convert('RGB');w,h=im.size
r,g,b=ImageChops.difference(im,Image.new('RGB',im.size,(11,11,18))).split()
mask=ImageChops.lighter(ImageChops.lighter(r,g),b).point(lambda v:255 if v==0 else 0)
def runs(bits):
 out=[];start=None
 for i,bit in enumerate(bits+[False]):
  if bit and start is None:start=i
  if not bit and start is not None:out.append((start,i));start=None
 return out
xs=[r for r in runs([mask.crop((x,0,x+1,h)).histogram()[255]>100 for x in range(w)]) if r[1]-r[0]>800]
column=int(sys.argv[3]);assert column in (0,1)
selected=[r for r in xs if ((r[0]+r[1])/2>w/2)==bool(column)]
assert len(selected)==1,(xs,'Need exactly one background in requested physical column')
x0,x1=selected[0];width=x1-x0
ys=runs([mask.crop((x0,y,x1,y+1)).histogram()[255]>width*.01 for y in range(h)])
full=[(a,b) for a,b in ys if b-a>800 and abs(b-a-width/(892/592))<=6]
assert len(full)==1,(xs,ys,'Need exactly one complete unoccluded card')
y0,y1=full[0];im.crop((x0,y0,x1,y1)).save(sys.argv[2]);print({'crop':(x0,y0,x1,y1),'output':sys.argv[2]})
