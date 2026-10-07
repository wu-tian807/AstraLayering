"""Dense M/L/C sampling and explicit-pressure perfect-freehand paths for n29."""
import math,re
from perfect_freehand import get_stroke

def smooth(t):return t*t*(3-2*t)

def sample(d,step=.45):
    tokens=re.findall(r'[A-Za-z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?',d)
    paths=[];points=[];i=0;p=None
    while i<len(tokens):
        command=tokens[i];i+=1
        assert command in ('M','L','C'),f'Unexpected source command {command}'
        count={'M':2,'L':2,'C':6}[command]
        a=list(map(float,tokens[i:i+count]));i+=count
        if command=='M':
            if points:paths.append(points)
            p=complex(*a);points=[p];continue
        end=complex(*a[-2:])
        if command=='L':
            n=max(1,math.ceil(abs(end-p)/step))
            points.extend(p+(end-p)*j/n for j in range(1,n+1))
        else:
            c1,c2=complex(*a[:2]),complex(*a[2:4])
            n=max(1,math.ceil((abs(c1-p)+abs(c2-c1)+abs(end-c2))/step))
            points.extend((1-t)**3*p+3*(1-t)**2*t*c1+3*(1-t)*t*t*c2+t**3*end for t in (j/n for j in range(1,n+1)))
        p=end
    if points:paths.append(points)
    return paths

def pressure(t,knots):
    for (a,p),(b,q) in zip(knots,knots[1:]):
        if t<=b:return p+(q-p)*smooth((t-a)/(b-a))
    return knots[-1][1]

def outline(points,knots,size):
    lengths=[0.]
    for a,b in zip(points,points[1:]):lengths.append(lengths[-1]+abs(b-a))
    length=lengths[-1];assert length>0
    inputs=[(round(p.real,5),round(p.imag,5),round(pressure(d/length,knots),5)) for p,d in zip(points,lengths)]
    taper_start=min(length*.17,12 if size>.7 else 8)
    taper_end=min(length*.2,17 if size>.7 else 10)
    options=dict(size=size,thinning=.78,smoothing=.52,simulate_pressure=False,streamline=0,last=True,taper_start=taper_start,taper_end=taper_end,taper_start_ease=smooth,taper_end_ease=smooth)
    poly=get_stroke(inputs,**options)
    assert len(poly)>3
    d='M '+' L '.join(f'{x:.4f} {y:.4f}' for x,y in poly)+' Z'
    return d,inputs,{'size':size,'thinning':.78,'smoothing':.52,'simulate_pressure':False,'streamline':0,'last':True,'taper_start':taper_start,'taper_end':taper_end,'taper_easing':'t*t*(3-2*t)','length':length}
