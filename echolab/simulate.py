"""Reproducible shoebox image-source experiment. NumPy/SciPy only.

Uniform energy absorption alpha; pressure reflection sqrt(1-alpha).
Images at 2*n*L + (-1)**p*s, order sum(abs(2*n-p)).
Spreading 1/(4*pi*d); linear fractional-delay deposition (approximation).
No scattering, air absorption, directivity, furniture or background noise.
"""
from pathlib import Path
import json, itertools, math
import numpy as np
from scipy.io import wavfile
from scipy.signal import fftconvolve, stft, butter, sosfilt

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'dist' / 'data'
FS = 16000
ROOM = np.array([6., 8., 3.])
SOURCES = [[3., 1., 1.5], [1., 1., 1.5]]
ALPHAS = [.18, .4, .7]
ORDER = 48
HIGHPASS = butter(4, 80, fs=FS, btype='highpass', output='sos')

def images(source, order):
    # Enumerate by signed reflection index q=2*n-p; one image per q tuple.
    q = np.arange(-order, order + 1)
    a,b,c = np.meshgrid(q,q,q,indexing='ij')
    qq = np.column_stack([a.ravel(),b.ravel(),c.ravel()])
    o = np.abs(qq).sum(axis=1)
    qq,o = qq[o<=order],o[o<=order]
    parity = np.mod(qq,2)
    n = (qq + parity)//2
    pos = 2*n*ROOM + (1-2*parity)*np.asarray(source)
    return pos,o

def rir(source, receiver, alpha, order=ORDER, cache=None, condition=True):
    pos,o = images(source,order) if cache is None else cache
    d = np.linalg.norm(pos-np.asarray(receiver),axis=1)
    sample = d / 343 * FS
    index = np.floor(sample).astype(int)
    frac = sample-index
    amp = np.power(np.sqrt(1-alpha),o)/(4*np.pi*d)
    h = np.bincount(index,weights=amp*(1-frac),minlength=index.max()+2)
    h += np.bincount(index+1,weights=amp*frac,minlength=len(h))
    # Constant positive reflection factors produce a nonphysical DC build-up.
    # Keep this explicit: all exported metrics/audio use this effective RIR.
    return sosfilt(HIGHPASS, np.pad(h, (0,1600))) if condition else h

def metrics(h,source,receiver):
    distance = float(np.linalg.norm(np.asarray(source)-receiver))
    # Floor matches the first nonzero sample of linear delay deposition.
    onset = int(np.floor(distance/343*FS))
    cut = onset + int(.05*FS)
    early,late = float(np.sum(h[onset:cut]**2)),float(np.sum(h[cut:]**2))
    c50 = 10*np.log10(early/late) if late>1e-20 else None
    energy = h[onset:] ** 2
    total = float(np.sum(energy))
    t90 = float(np.searchsorted(np.cumsum(energy), .9 * total) / FS * 1000)
    centroid = float(np.dot(np.arange(len(energy)) / FS * 1000, energy) / total)
    return dict(distance=distance,arrivalMs=distance/343*1000,c50=c50,
                earlyEnergy=early,lateEnergy=late,earlyPercent=100*early/(early+late),
                energy90Ms=t90,centroidMs=centroid,totalEnergy=total)

def compact_response(h,source,receiver):
    onset=int(np.floor(np.linalg.norm(np.asarray(source)-receiver)/343*FS))
    energy=h[onset:]**2
    # 5 ms bins; plotted energy, not the signed pressure impulse response.
    bins=np.array([np.sum(energy[i:i+80]) for i in range(0,len(energy),80)])
    db=10*np.log10(np.maximum(bins,1e-30)/max(bins.max(),1e-30))
    return np.maximum(db,-90).round(2).tolist()

def validate():
    s=SOURCES[0];r=np.array([4.,6.,1.2])
    h=rir(s,r,.4,0,condition=False); expected=np.linalg.norm(np.array(s)-r)/343*FS
    assert abs(np.argmax(h)-expected)<=1
    assert abs(h.sum()-1/(4*np.pi*np.linalg.norm(np.array(s)-r)))<1e-12
    assert len(images(s,1)[1])==7
    signal=np.random.default_rng(23).normal(size=400)
    assert np.max(np.abs(fftconvolve(signal,[1])-signal))<1e-10
    checks=[]
    for sid,s in enumerate(SOURCES):
        caches={order:images(s,order) for order in [32,48,64]}
        for r in [np.array([1.,2.,1.2]),np.array([3.,5.,1.2]),np.array([5.,7.,1.2])]:
            for alpha in ALPHAS:
                vals=[metrics(rir(s,r,alpha,o,caches[o]),s,r)['c50'] for o in [32,48,64]]
                delta=abs(vals[2]-vals[1])
                checks.append(dict(source=sid,receiver=r.tolist(),alpha=alpha,c50=vals,deltaDb=delta))
    maximum=max(x['deltaDb'] for x in checks)
    assert maximum<.15, f'Reflection convergence failed: {maximum}'
    return dict(passed=True,orders=[32,48,64],maxDeltaDb=maximum,toleranceDb=.15,
                checks=checks,tests=['direct arrival within one sample','free-field amplitude','six first-order images','unit impulse convolution','representative C50 order convergence'])

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    validation=validate()
    seats=[dict(id=i,x=float(x),y=float(y),z=1.2) for i,(y,x) in enumerate(itertools.product(np.linspace(2,7,6),np.linspace(1,5,5)))]
    cases=[]
    for sid,s in enumerate(SOURCES):
        cache=images(s,ORDER)
        for aid,alpha in enumerate(ALPHAS):
            for seat in seats:
                r=np.array([seat['x'],seat['y'],seat['z']])
                h=rir(s,r,alpha,cache=cache)
                key=f'{sid}-{aid}-{seat["id"]}'
                wavfile.write(OUT/f'{key}.wav',FS,h.astype(np.float32))
                cases.append(dict(id=key,source=sid,absorption=aid,seat=seat['id'],
                                  **metrics(h,s,r),energyDb=compact_response(h,s,r)))
            print(f'Completed speaker {sid}, absorption {alpha}',flush=True)
    meta=dict(room=ROOM.tolist(),fs=FS,sources=SOURCES,alphas=ALPHAS,seats=seats,cases=cases,
              validation=validation,order=ORDER,highpassHz=80,model='Uniform-absorption 3-D image-source model; linear fractional delays; fourth-order causal 80 Hz highpass',
              baseline='0-0-27')
    (OUT/'experiment.json').write_text(json.dumps(meta,separators=(',',':')),encoding='utf-8')
    (ROOT/'validation.json').write_text(json.dumps(validation,indent=2),encoding='utf-8')
    print(f'Validated {len(cases)} configurations; max convergence change {validation["maxDeltaDb"]:.5f} dB')

if __name__=='__main__': main()
