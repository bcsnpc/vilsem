"""Crop two complete visual backgrounds from an official Desktop bridge capture.
Never accepts screenshots returned by the computer-use helper.
"""
import sys
from pathlib import Path
from PIL import Image,ImageChops
im=Image.open(sys.argv[1]).convert('RGB')
# The authored option explicitly requests this exact opaque background.
w,h=im.size
diff=ImageChops.difference(im,Image.new('RGB',im.size,(11,11,18)))
r,g,b=diff.split()
mask=ImageChops.lighter(ImageChops.lighter(r,g),b).point(lambda value:255 if value==0 else 0)
xs=[mask.crop((x,0,x+1,h)).histogram()[255]>100 for x in range(w)]
# Dense heatmaps/treemaps can cover >90% of a row. Small outer margins still
# identify the dark card; the full-surface aspect assertion below remains strict.
ys=[mask.crop((0,y,w,y+1)).histogram()[255]>w*0.01 for y in range(h)]
def runs(bits):
 out=[];start=None
 for i,b in enumerate(bits+[False]):
  if b and start is None:start=i
  if not b and start is not None:out.append((start,i));start=None
 return out
xr=[r for r in runs(xs) if r[1]-r[0]>800]
yr=[r for r in runs(ys) if r[1]-r[0]>800]
if len(xr)!=2 or len(yr)!=1:raise RuntimeError(f'Expected two complete panels; got x={xr}, y={yr}; inspect viewport before cropping')
y0,y1=yr[0]
for x0,x1 in xr:
 # Plain 900x600 PBIR cards have an approximately 892x592 chart surface.
 # A partly visible row may still exceed 800px; refuse that cropped evidence.
 expected_height=(x1-x0)/(892/592)
 if abs((y1-y0)-expected_height)>6:
  raise RuntimeError(f'Incomplete visual surface: {(x1-x0,y1-y0)}; expected height near {expected_height:.1f}. Reposition the viewport.')
for out,(x0,x1) in zip(sys.argv[2:],xr):
 im.crop((x0,y0,x1,y1)).save(out)
print({'x':xr,'y':yr,'files':sys.argv[2:]})
