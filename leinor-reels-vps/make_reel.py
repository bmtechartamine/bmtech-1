#!/usr/bin/env python3
"""Monte un Reel LEINOR 1080x1920 à partir d'un clip IA + 3 photos + musique.
Usage : python3 make_reel.py config.json   (voir README)"""
import subprocess, sys, json, os
HERE=os.path.dirname(os.path.abspath(__file__)); A=os.path.join(HERE,'assets')
cfg=json.load(open(sys.argv[1]))
W,H=1080,1920; FPS=30
D=os.path.dirname(os.path.abspath(sys.argv[1])); os.chdir(D)
SERIF=f'{A}/CormorantSB.ttf'; SANS=f'{A}/MontserratSB.ttf'; LOGO=f'{A}/logo.png'
GOLD='0xD9B56A'
def run(c):
    r=subprocess.run(c,capture_output=True,text=True)
    if r.returncode: print(r.stderr[-2000:]); sys.exit(1)
def tf(name,txt):
    p=f'_t_{name}.txt'; open(p,'w').write(txt); return p
def dt(txtfile,font,size,color,y,extra=''):
    return f"drawtext=textfile={txtfile}:fontfile={font}:fontsize={size}:fontcolor={color}:x=(w-text_w)/2:y={y}{extra}"
def texts(i,lines):
    out=[]
    for k,(t,f,s,c,y) in enumerate(lines):
        p=tf(f'{i}_{k}',t)
        out.append(dt(p,f,s,c,y,":alpha='min(1,(t-0.25)/0.5)':shadowcolor=black@0.5:shadowx=2:shadowy=2"))
    return out
segs=[]
def seg(i,src,dur,lines,still=True,fit='portrait'):
    out=f'_s{i}.mp4'
    fgw=1080 if fit=='portrait' else 1000
    fgh=1350 if fit=='portrait' else 1000
    fgy=430 if fit=='portrait' else 500
    n=int(dur*FPS)
    inp=['-loop','1','-t',str(dur),'-i',src] if still else ['-i',src]
    if still:
        fg=f"[0:v]scale={fgw*2}:{fgh*2}:force_original_aspect_ratio=increase,crop={fgw*2}:{fgh*2},zoompan=z='1+0.06*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={n}:s={fgw}x{fgh}:fps={FPS}[fg]"
    else:
        fg=f"[0:v]fps={FPS},scale={fgw}:{fgh}:force_original_aspect_ratio=increase,crop={fgw}:{fgh},trim=duration={dur},setpts=PTS-STARTPTS[fg]"
    bg=f"[0:v]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=12:2,scale={W}:{H},eq=brightness=-0.38:saturation=0.9,fps={FPS},trim=duration={dur},setpts=PTS-STARTPTS[bg]"
    logo="[1:v]scale=170:-1[lg]"
    chain=f"[bg][fg]overlay=(W-w)/2:{fgy}[v0];[v0][lg]overlay=(W-w)/2:50[v1];[v1]"+",".join(texts(i,lines)+['format=yuv420p'])+"[v]"
    run(['ffmpeg','-v','error','-y',*inp,'-i',LOGO,'-filter_complex',';'.join([fg,bg,logo,chain]),'-map','[v]','-t',str(dur),'-r',str(FPS),'-c:v','libx264','-preset','medium','-crf','19',out])
    segs.append((out,dur))
def endcard(i,dur):
    out=f'_s{i}.mp4'
    l=texts(i,[(cfg['end1'],SERIF,66,'white',1010),(cfg['end2'],SANS,38,GOLD,1110),(cfg['end3'],SANS,32,'white@0.9',1180)])
    flt=f"color=c=0x141210:s={W}x{H}:d={dur}:r={FPS}[c];[1:v]scale=560:-1[lg];[c][lg]overlay=(W-w)/2:560[v1];[v1]"+",".join(l+['format=yuv420p'])+"[v]"
    run(['ffmpeg','-v','error','-y','-f','lavfi','-i','anullsrc','-i',LOGO,'-filter_complex',flt,'-map','[v]','-t',str(dur),'-r',str(FPS),'-c:v','libx264','-preset','medium','-crf','19',out])
    segs.append((out,dur))
Y1=220
for i,sg in enumerate(cfg['segments']):
    lines=[]
    if sg.get('small'): lines.append((sg['small'],SANS,30,GOLD,Y1))
    if sg.get('big'): lines.append((sg['big'],SERIF,sg.get('bigsize',80),sg.get('bigcolor','white'),Y1+40 if sg.get('small') else Y1+10))
    if sg.get('sub'): lines.append((sg['sub'],SANS,34,'white',Y1+120 if sg.get('big') else Y1+60))
    seg(i,sg['src'],sg['dur'],lines,still=sg.get('still',True),fit=sg.get('fit','portrait'))
endcard(len(cfg['segments']),cfg.get('end_dur',3.2))
X=0.4; inputs=[]; flt=[]; prev='[0:v]'
for f,_ in segs: inputs+=['-i',f]
off=segs[0][1]-X
for k in range(1,len(segs)):
    lab=f'[x{k}]'; flt.append(f"{prev}[{k}:v]xfade=transition=fade:duration={X}:offset={off:.3f}{lab}"); prev=lab; off+=segs[k][1]-X
total=off+X
flt.append(f"[{len(segs)}:a]atrim=0:{total:.3f},afade=t=in:d=0.3,afade=t=out:st={total-1.2:.3f}:d=1.2,volume=0.9[a]")
music=cfg['music'] if os.path.isabs(cfg['music']) else os.path.join(A,cfg['music'])
run(['ffmpeg','-v','error','-y',*inputs,'-i',music,'-filter_complex',';'.join(flt),'-map',prev,'-map','[a]','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart','-r',str(FPS),cfg['out']])
for f,_ in segs: os.remove(f)
for f in os.listdir('.'):
    if f.startswith('_t_'): os.remove(f)
print('OK',cfg['out'],round(total,2))
