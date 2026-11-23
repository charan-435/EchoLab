export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export function sampleEnergy(x) { let sum=0; for(const v of x) sum+=v*v; return sum; }
export function playbackGain(x, length, match) {
  let peak=0; for(const v of x) peak=Math.max(peak,Math.abs(v));
  const rms=Math.sqrt(sampleEnergy(x)/Math.max(1,length));
  return Math.min(match && rms>1e-10 ? .09/rms : 1, peak>0 ? .95/peak : 1);
}
export function clockPosition({offset, started, now, duration, loop, from, to}) {
  const elapsed=Math.max(0,now-started), t=offset+elapsed;
  if(loop && to>from && t>=to) return from+(t-to)%(to-from);
  return clamp(t,0,duration);
}
export function visibleRange(time,duration,span) {
  const width=Math.min(duration,span||duration);
  const start=clamp(Math.floor(time/width)*width,0,Math.max(0,duration-width));
  return [start,start+width];
}
export function windowMetrics(x,fs,time,n) {
  const start=Math.floor(time*fs); let energy=0,peak=0;
  for(let i=0;i<n;i++){const v=x[start+i]||0;energy+=v*v;peak=Math.max(peak,Math.abs(v));}
  return {rms:Math.sqrt(energy/n),peak,energy};
}
export function frameSpectrum(x,fs,time,n,fft) {
  const re=new Float64Array(n),im=new Float64Array(n),start=Math.floor(time*fs);
  let weight=0;
  for(let i=0;i<n;i++){const w=hannWeight(i,n);weight+=w;re[i]=(x[start+i]||0)*w;}
  fft(re,im);
  return Float32Array.from({length:n/2},(_,k)=>20*Math.log10(Math.max(1e-8,Math.hypot(re[k],im[k])*(k===0?1:2)/weight)));
}

export function hannWeight(i,n){return .5-.5*Math.cos(2*Math.PI*i/(n-1));}
export function plotTime(clientX,left,width,padLeft,padRight,range,duration){
 const ratio=clamp((clientX-left-padLeft)/Math.max(1,width-padLeft-padRight),0,1);
 return clamp(range[0]+ratio*(range[1]-range[0]),0,duration);
}
