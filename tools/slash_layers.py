import numpy as np, cv2, sys
im=cv2.imread('art/theron_slash2.png',cv2.IMREAD_UNCHANGED).astype(np.float32)
B,G,R,A=[im[:,:,i] for i in range(4)]
H,W=A.shape
lum=0.3*R+0.59*G+0.11*B
mx=np.maximum(np.maximum(R,G),B); mn=np.minimum(np.minimum(R,G),B); sat=(mx-mn)/(mx+1)
# --- layer 3: sparkles (white star cores + their 8 rays) and the small green dots
white=((R>235)&(G>235)&(B>220)&(A>200)).astype(np.uint8)
n,lab,stats,cent=cv2.connectedComponentsWithStats(white,8)
stars=[]
for i in range(1,n):
  x,y,w,h,ar=stats[i]
  if 4<=ar<=140 and max(w,h)<=16: stars.append((cent[i][0],cent[i][1],ar,w,h))
print('star candidates',[(round(a),round(b),c) for a,b,c,_,_ in stars])
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
STARS=[(413,49),(36,169),(380,180),(166,284)]
star=np.zeros((H,W),np.float32)
for cx,cy in STARS:
  dx,dy=xx-cx,yy-cy; d=np.hypot(dx,dy)
  m=np.clip(1.2-(d-5)/2,0,1)       # bright core
  for k in range(8):
    ang=k*np.pi/4; ux,uy=np.cos(ang),np.sin(ang); along=dx*ux+dy*uy; side=np.abs(-dx*uy+dy*ux)
    L=34 if k%2==0 else 20
    w=np.where((along>0)&(along<L+3), 2.2*(1-along/(L+3))+1.3, 0)
    m=np.maximum(m,np.clip(w-side+0.5,0,1))
  star=np.maximum(star,m*(d<40))
dots=((G>B+12)&(G>R+45)&(A>110)).astype(np.uint8)
n,lab,stats,cent=cv2.connectedComponentsWithStats(dots,8)
dm=np.zeros((H,W),np.uint8)
for i in range(1,n):
  if 3<=stats[i][4]<=90: dm[lab==i]=1
dm=cv2.dilate(dm,np.ones((3,3),np.uint8))
print('dots',int((n)),'kept px',int(dm.sum()))
m3=np.maximum(star,dm.astype(np.float32)*((A>40).astype(np.float32)))
# --- layer 2: the crystal streaks: opaque and not the soft blue glow
crys=((A>=225)&~((B>G+12)&(R<120))).astype(np.uint8)
crys=cv2.morphologyEx(crys,cv2.MORPH_OPEN,np.ones((2,2),np.uint8))
crys=cv2.morphologyEx(crys,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
m2=cv2.GaussianBlur(crys.astype(np.float32),(3,3),0)*(1-m3)
vis=np.zeros((H,W,3),np.uint8); vis[:,:,2]=(m3*255).astype(np.uint8); vis[:,:,1]=(m2*255).astype(np.uint8); vis[:,:,0]=(A*(1-np.maximum(m2,m3))).astype(np.uint8)
rgb=im[:,:,:3]; a=A/255.
a_nos=a*(1-cv2.dilate((m3>0.02).astype(np.uint8),np.ones((5,5),np.uint8)))
def blurp(rad):   # colour and alpha blurred together (premultiplied), so the glow keeps the arc's own colours
  pa=cv2.GaussianBlur(a_nos,(0,0),rad); pc=cv2.GaussianBlur(rgb*a_nos[...,None],(0,0),rad)/np.maximum(pa,1e-3)[...,None]
  return pc,pa
mU=np.clip(np.maximum(m2,m3),0,1)
# layer 1: everything that is not crystal or sparkle; under them a soft cyan glow made from the arc itself
gc,ga=blurp(7)
hole=cv2.dilate((mU>0.02).astype(np.uint8),np.ones((3,3),np.uint8)).astype(np.float32)
hole=cv2.GaussianBlur(hole,(5,5),0)
L1c=rgb*(1-hole[...,None])+gc*hole[...,None]
L1a=a*(1-hole)+np.minimum(1,ga*0.9)*hole
# layer 2: the crystal; where a sparkle or dot sits on it, the crystal continues underneath (inpainted)
L2a=a*m2; L2c=rgb.copy()
m3d=cv2.dilate((m3>0.05).astype(np.uint8),np.ones((5,5),np.uint8))
src8=np.clip(rgb,0,255).astype(np.uint8)
valid=(1-m3d).astype(np.float32); ac=a*m2*valid
num=cv2.GaussianBlur(rgb*ac[...,None],(0,0),3); den=cv2.GaussianBlur(ac,(0,0),3); vb=cv2.GaussianBlur(valid,(0,0),3)
fillc=num/np.maximum(den,1e-4)[...,None]; filla=den/np.maximum(vb,1e-4)
for sg in (7,12):   # star centres are wider than a small blur reaches: fill what is still empty from further away
  num2=cv2.GaussianBlur(rgb*ac[...,None],(0,0),sg); den2=cv2.GaussianBlur(ac,(0,0),sg); vb2=cv2.GaussianBlur(valid,(0,0),sg)
  w=np.clip(1-den/np.maximum(vb,1e-4)/0.5,0,1)*(den2>1e-3)
  fillc=fillc*(1-w[...,None])+(num2/np.maximum(den2,1e-4)[...,None])*w[...,None]; filla=np.maximum(filla, (den2/np.maximum(vb2,1e-4))*w)
  den,vb=den2,vb2
L2c=np.where(m3d[...,None]>0, fillc, rgb); L2a=np.where(m3d>0, np.maximum(L2a, filla), L2a)
# layer 3: sparkles and dots, as painted
L3a=a*m3; L3c=rgb
def save(c,al,f):
  out=np.dstack([np.clip(c,0,255),np.clip(al*255,0,255)]).astype(np.uint8); cv2.imwrite(f,out)
save(L1c,L1a,'public/textures/fx/theron_slash_1.png'); save(L2c,L2a,'public/textures/fx/theron_slash_2.png'); save(L3c,L3a,'public/textures/fx/theron_slash_3.png')
def over(bc,ba,c,al):
  oa=al+ba*(1-al); oc=(c*al[...,None]+bc*(ba*(1-al))[...,None])/np.maximum(oa,1e-4)[...,None]; return oc,oa
c,al=L1c,L1a; c12,a12=over(c,al,L2c,L2a); c123,a123=over(c12,a12,L3c,L3a)
err=np.abs(c123*a123[...,None]-rgb*a[...,None]).mean(); print('mean abs premult error',round(float(err),2))
bg=np.zeros((H,W,3),np.float32); bg[:]=(40,30,30)
tiles=[]
for cc,aa in [(L1c,L1a),(c12,a12),(c123,a123),(rgb,a)]:
  tiles.append((cc*aa[...,None]+bg*(1-aa[...,None])).astype(np.uint8))
