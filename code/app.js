import {installSpectrogramGuide} from './spectrogram-guide.js?v=2';
import {installTimeline} from './timeline.js?v=4';
import {installStudy} from './study.js?v=1';
const $=s=>document.querySelector(s);
let D, current, a=0, source=0, seat=27, saved=[], ctx, playing, uploadBuffer, dryCache, audioGeneration=0;
const colors=['#cc713c','#eee1bc','#91c7b4','#156458'];
let minC,maxC,maxDelta;
function mapValue(c){return $('#mapMode').value==='arrival'?c.arrivalMs:$('#mapMode').value==='difference'?c.energy90Ms-get(c.source,0,c.seat).energy90Ms:c.energy90Ms;}
function color(v){const delta=$('#mapMode').value==='difference',stops=delta?['#136f91','#f6f7f8','#d77540']:colors;let t=Math.max(0,Math.min(.9999,delta?(v+maxDelta)/(2*maxDelta):(v-minC)/(maxC-minC)))*(stops.length-1),i=Math.floor(t),f=t-i;const rgb=x=>x.slice(1).match(/../g).map(y=>parseInt(y,16)),x=rgb(stops[i]),y=rgb(stops[i+1]);return `rgb(${x.map((z,j)=>Math.round(z+(y[j]-z)*f)).join(',')})`;}
const get=(s,a,k)=>D.cases.find(c=>c.source===s&&c.absorption===a&&c.seat===k);
const position=k=>D.seats[k];
const seatLabel=k=>`Row ${Math.floor(k/5)+1} · Seat ${k%5+1}`;
const desc=c=>`${c.source?'Front-left':'Front-centre'} lecturer · ${Math.round(D.alphas[c.absorption]*100)}% absorption · ${seatLabel(c.seat)}`;
function toast(t){$('.toast')?.remove();let el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.textContent=t;document.body.append(el);setTimeout(()=>el.remove(),2600);}
function activate(id){document.querySelectorAll('.tab-panel').forEach(e=>e.hidden=e.id!==id);document.querySelectorAll('.nav').forEach(e=>e.classList.toggle('active',e.dataset.tab===id));if(id==='compare')renderComparison();if(id==='findings')requestAnimationFrame(findings);if(id==='explore')requestAnimationFrame(()=>{lineChart($('#responseChart'),current);renderLab();renderToy();study.render();if(lastSpectra&&!$('#spectrograms').hidden)drawSpectra(lastSpectra.dry,lastSpectra.wet,lastSpectra.fs);});}
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>activate(b.dataset.tab));
function map(){const mode=$('#mapMode').value,delta=mode==='difference';minC=0;maxC=mode==='arrival'?30:160;maxDelta=160;
 $('#legendLeft').textContent=delta?'Shorter tail':'Shorter time';$('#legendRight').textContent=delta?'Longer tail':'Longer time';
 $('.gradient').style.background=delta?'linear-gradient(90deg,#136f91,#f6f7f8,#d77540)':'';
 $('#legendRange').textContent=delta?'−160 to +160 ms · change in 90% energy time versus Low at the same seat':`0 to ${maxC} ms · ${mode==='arrival'?'first arrival, measured from emission':'time containing 90% of energy, measured from first arrival'}`;
 const sx=x=>90+x*70,sy=y=>55+y*65,s=D.sources[source],r=position(seat);let html=`<rect x="90" y="55" width="420" height="520" rx="5" fill="#f0f5f1" stroke="#b9ccc1" stroke-width="3"/><rect x="230" y="45" width="140" height="9" rx="4" fill="#174a43"/><text x="300" y="28" text-anchor="middle" font-size="13" fill="#62776b">FRONT OF CLASSROOM</text>`;
for(let y=1;y<8;y++)html+=`<line x1="90" y1="${sy(y)}" x2="510" y2="${sy(y)}" stroke="#dfE8e1"/>`;
if($('#paths').checked){html+=`<line x1="${sx(s[0])}" y1="${sy(s[1])}" x2="${sx(r.x)}" y2="${sy(r.y)}" stroke="#176b5e" stroke-width="3"/>`;const walls=[{im:[-s[0],s[1]],axis:0,w:0},{im:[12-s[0],s[1]],axis:0,w:6},{im:[s[0],-s[1]],axis:1,w:0},{im:[s[0],16-s[1]],axis:1,w:8}];for(let w of walls){let rr=[r.x,r.y],t=(w.w-rr[w.axis])/(w.im[w.axis]-rr[w.axis]);let p=rr.map((v,i)=>v+t*(w.im[i]-v));html+=`<polyline points="${sx(s[0])},${sy(s[1])} ${sx(p[0])},${sy(p[1])} ${sx(r.x)},${sy(r.y)}" fill="none" stroke="#cf793f" stroke-width="1.5" stroke-dasharray="5 5" opacity=".65"/>`;}}
for(let q of D.seats){let c=get(source,a,q.id),selected=q.id===seat;html+=`<g class="seat" role="button" tabindex="0" data-seat="${q.id}" aria-label="${seatLabel(q.id)}, ${delta?'change in energy duration':mode==='arrival'?'first arrival':'90 percent energy duration'} ${mapValue(c).toFixed(1)} milliseconds" aria-pressed="${selected}"><circle cx="${sx(q.x)}" cy="${sy(q.y)}" r="${selected?23:19}" fill="${color(mapValue(c))}" stroke="${selected?'#153c34':'#ffffff'}" stroke-width="${selected?3:2}"/><text x="${sx(q.x)}" y="${sy(q.y)+4}" text-anchor="middle" font-size="11" font-weight="700" fill="${delta?(Math.abs(mapValue(c))>maxDelta*.65?'#fff':'#25382f'):(mapValue(c)>(minC+maxC)*.5?'#fff':'#25382f')}">${delta&&mapValue(c)>0?"+":""}${mapValue(c).toFixed(0)}</text>${selected?`<circle cx="${sx(q.x)+20}" cy="${sy(q.y)-18}" r="8" fill="#173e35"/><text x="${sx(q.x)+20}" y="${sy(q.y)-14}" text-anchor="middle" font-size="11" fill="white">✓</text>`:''}</g>`;}
html+=`<circle cx="${sx(s[0])}" cy="${sy(s[1])}" r="15" fill="#173e35"/><text x="${sx(s[0])}" y="${sy(s[1])+5}" fill="white" text-anchor="middle" font-size="17">♪</text><text x="300" y="620" text-anchor="middle" font-size="13" fill="#607369">Click a seat to inspect its acoustic response</text>`;
$('#roomMap').innerHTML=html;document.querySelectorAll('[data-seat]').forEach(e=>{e.onclick=()=>{seat=+e.dataset.seat;update();};e.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();e.click();}};});}
function canvasSetup(canvas,height){let w=Math.max(250,canvas.clientWidth),dpr=devicePixelRatio||1;canvas.width=w*dpr;canvas.height=height*dpr;let g=canvas.getContext('2d');g.scale(dpr,dpr);g.font='11px system-ui';return {g,w,h:height};}
function lineChart(canvas,c){let {g,w,h}=canvasSetup(canvas,230),L=42,R=w-16,T=15,B=h-30;let xmax=600;const x=t=>L+t/xmax*(R-L),y=db=>T+(-db/90)*(B-T);g.fillStyle='#ecf5ef';g.fillRect(L,T,x(50)-L,B-T);for(let db of [0,-30,-60,-90]){g.strokeStyle='#e3eae5';g.beginPath();g.moveTo(L,y(db));g.lineTo(R,y(db));g.stroke();g.fillStyle='#64746b';g.fillText(`${db}`,8,y(db)+4);}for(let t of [0,50,200,400,600]){g.fillStyle='#64746b';g.fillText(t,x(t)-8,B+18);}g.fillText('ms after direct arrival',w-142,h-1);g.fillText('dB',10,11);g.beginPath();c.energyDb.forEach((db,i)=>{if(i*5>xmax)return;i?g.lineTo(x(i*5),y(db)):g.moveTo(x(0),y(db));});g.strokeStyle='#1c7562';g.lineWidth=1.5;g.stroke();g.setLineDash([4,3]);g.strokeStyle='#c47840';g.beginPath();g.moveTo(x(50),T);g.lineTo(x(50),B);g.stroke();g.setLineDash([]);}
function update(){stop();current=get(source,a,seat);map();$('#seatName').textContent=seatLabel(seat);$('#coordinate').textContent=`${position(seat).x}, ${position(seat).y} m`;$('#c50').textContent=current.c50.toFixed(1);$('#distance').textContent=current.distance.toFixed(2)+' m';$('#arrival').textContent=current.arrivalMs.toFixed(1)+' ms';$('#earlyBar').style.width=current.earlyPercent+'%';$('#earlyLabel').textContent=`Early ${current.earlyPercent.toFixed(1)}%`;$('#lateLabel').textContent=`Late ${(100-current.earlyPercent).toFixed(1)}%`;$('#spectrograms').hidden=false;$('#spectrogramPlaceholder').hidden=false;$('#audioStatus').textContent='Playback stays in your browser. No uploads to a server.';document.querySelectorAll('[data-a]').forEach(b=>b.classList.toggle('selected',+b.dataset.a===a));$('#source').value=source;lineChart($('#responseChart'),current); explainSelection(); refreshLab();document.dispatchEvent(new CustomEvent('echolab:selection'));}
document.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{a=+b.dataset.a;update();});$('#source').onchange=e=>{source=+e.target.value;update();};$('#paths').onchange=map;$('#mapMode').onchange=map;$('#reset').onclick=()=>{a=0;source=0;seat=27;$('#mapMode').value='absolute';update();};
function persist(){try{localStorage.setItem('echolab-saved',JSON.stringify(saved));}catch{}$('#savedCount').textContent=saved.length;}
$('#save').onclick=()=>{if(saved.includes(current.id)){toast('This configuration is already saved.');return;}if(saved.length===2)saved.shift();saved.push(current.id);persist();toast(`Saved ${saved.length===1?'A':'B'} · open Compare to inspect`);};$('#clearSaved').onclick=()=>{saved=[];persist();renderComparison();};
$('#loadInterventions').onclick=()=>{saved=['0-0-27','0-1-27'];persist();activate('compare');};
function stopExternal(){audioGeneration++;if(playing){try{playing.stop();}catch{}playing.disconnect();playing=null;}}
function stop(){stopExternal();timeline.stop();$('#audioStatus').textContent='Playback stopped.';}$('#stop').onclick=stop;$('#compareStop').onclick=stop;
async function context(){ctx??=new AudioContext({sampleRate:16000});await ctx.resume();return ctx;}
function pulseBuffer(){let b=ctx.createBuffer(1,ctx.sampleRate*4,ctx.sampleRate),x=b.getChannelData(0);for(let t of [.3,1.3,2.3]){let start=Math.round(t*ctx.sampleRate);for(let i=0;i<Math.round(.015*ctx.sampleRate);i++)x[start+i]=.5*Math.sin(2*Math.PI*1300*i/ctx.sampleRate)*Math.exp(-i/(.003*ctx.sampleRate));}return b;}
async function inputBuffer(){await context();let kind=$('#audioKind').value;if(kind==='pulse')return pulseBuffer();if(kind==='upload'){if(!uploadBuffer)throw Error('Choose an audio file first.');return uploadBuffer;}if(!dryCache){const res=await fetch('../data/voice.wav');if(!res.ok)throw Error('Default speech unavailable. Choose diagnostic clicks or your own audio.');dryCache=await ctx.decodeAudioData(await res.arrayBuffer());}return dryCache;}
$('#audioKind').onchange=()=>{stop();if($('#audioKind').value==='upload'){$('#upload').hidden=false;$('#upload').click();}else $('#upload').hidden=true;};$('#upload').onchange=async()=>{stop();invalidateAudio();const token=audioGeneration;try{await context();let f=$('#upload').files[0];if(!f)return;if(f.size>30e6)throw Error('Please choose an audio file smaller than 30 MB.');const decoded=await ctx.decodeAudioData(await f.arrayBuffer());if(token!==audioGeneration)return;uploadBuffer=decoded;$('#audioStatus').textContent=`Loaded ${f.name}; playback uses up to 20 seconds.`;}catch(e){$('#audioStatus').textContent=e.message;}};
function mono(b){let n=Math.min(b.length,b.sampleRate*20),out=ctx.createBuffer(1,n,b.sampleRate),x=out.getChannelData(0);for(let c=0;c<b.numberOfChannels;c++){let y=b.getChannelData(c);for(let i=0;i<n;i++)x[i]+=y[i]/b.numberOfChannels;}return out;}
function rms(x){let sum=0;for(let v of x)sum+=v*v;return Math.sqrt(sum/x.length);}
async function play(wet,c=current,audible=true){
 const kind=$('#audioKind').value,isCurrent=c.id===current.id&&!$('#explore').hidden;
 if(isCurrent&&timeline.matches(c.id,kind)){stopExternal();if(audible)await timeline.playTrack(wet?'wet':'dry');else timeline.pause();return;}
 stop();const token=audioGeneration;
 try{
  $('#audioStatus').textContent='Preparing audio and linked plots…';
  const dry=mono(await inputBuffer()),response=await fetch(`../data/${c.id}.wav`);
  if(!response.ok)throw Error('Impulse response unavailable.');
  const h=await ctx.decodeAudioData(await response.arrayBuffer()),off=new OfflineAudioContext(1,dry.length+h.length-1,ctx.sampleRate),s=off.createBufferSource(),conv=off.createConvolver();s.buffer=dry;conv.buffer=h;conv.normalize=false;s.connect(conv).connect(off.destination);s.start();const out=await off.startRendering();
  if(token!==audioGeneration)return;
  if(isCurrent){
   const offset=Math.round(c.arrivalMs/1000*ctx.sampleRate),x=dry.getChannelData(0),y=out.getChannelData(0).subarray(offset);
   $('#spectrogramPlaceholder').hidden=true;$('#spectrograms').hidden=false;lastSpectra={dry:x,wet:y,fs:ctx.sampleRate};
   await timeline.load(x,y,ctx.sampleRate,{id:c.id,kind,label:desc(c)});
   if(token!==audioGeneration)return;
   $('#waveformInsight').textContent='Pink line = selected time. The pink curve is the Hann window applied to that slice. While paused, hover to preview; click or drag to select. Use 0.1-second zoom to see the window shape at its true width.';
   $('#audioStatus').textContent='Plots ready. Listening and plots share an aligned time axis.';
   if(audible)await timeline.playTrack(wet?'wet':'dry');
  }else{
   // Saved comparisons retain physical propagation delay; the timeline belongs to the selected seat.
   const buffer=wet?out:dry,x=buffer.getChannelData(0);let peak=0;for(const v of x)peak=Math.max(peak,Math.abs(v));const gain=ctx.createGain();gain.gain.value=Math.min($('#match').checked?.09/Math.max(rms(x),1e-8):1,.95/Math.max(peak,1e-8));playing=ctx.createBufferSource();playing.buffer=buffer;playing.connect(gain).connect(ctx.destination);const active=playing;playing.onended=()=>{if(playing===active){playing.disconnect();playing=null;$('#audioStatus').textContent='Comparison playback finished.';}};if(audible)playing.start();$('#audioStatus').textContent='Playing saved configuration with physical travel delay.';
  }
 }catch(e){if(token===audioGeneration){$('#audioStatus').textContent=e.message;toast(e.message);}}
}
$('#dry').onclick=()=>play(false);$('#wet').onclick=()=>play(true);
function fft(re,im){let n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}for(let len=2;len<=n;len<<=1){let angle=-2*Math.PI/len;for(let i=0;i<n;i+=len){for(let j=0;j<len/2;j++){let ca=Math.cos(angle*j),sa=Math.sin(angle*j),k=i+j,l=k+len/2,tr=re[l]*ca-im[l]*sa,ti=re[l]*sa+im[l]*ca;re[l]=re[k]-tr;im[l]=im[k]-ti;re[k]+=tr;im[k]+=ti;}}}}
function spectrum(x,fs,duration){let n=+$('#stftWindow').value,hop=n/4,frames=Math.min(2200,Math.floor(duration*fs/hop)),rows=n/2,data=new Float32Array(frames*rows);for(let t=0;t<frames;t++){let re=new Float64Array(n),im=new Float64Array(n);for(let i=0;i<n;i++)re[i]=(x[t*hop+i]||0)*(.5-.5*Math.cos(2*Math.PI*i/(n-1)));fft(re,im);for(let f=0;f<rows;f++){let k=f;data[t*rows+f]=10*Math.log10(re[k]**2+im[k]**2+1e-16);}}return {data,frames,rows};}
let lastSpectra;
async function init(){try{let res=await fetch('../data/experiment.json');if(!res.ok)throw Error('Run python simulate.py to generate experiment data.');D=await res.json();minC=Math.floor(Math.min(...D.cases.map(c=>c.c50)));maxC=Math.ceil(Math.max(...D.cases.map(c=>c.c50)));$('#legendRange').textContent=`${minC} to ${maxC} dB C₅₀ · values shown on each seat`;try{saved=JSON.parse(localStorage.getItem('echolab-saved')||'[]').filter(id=>D.cases.some(c=>c.id===id)).slice(-2);}catch{saved=[];}maxDelta=Math.ceil(Math.max(...D.cases.map(c=>Math.abs(c.c50-get(c.source,0,c.seat).c50))));persist();$('#loading').hidden=true;$('#explore').hidden=false;update();window.addEventListener('resize',()=>{if(!$('#explore').hidden)lineChart($('#responseChart'),current);if(!$('#compare').hidden)renderComparison();if(!$('#findings').hidden)findings();});}catch(e){$('#loading').textContent=e.message;}}init();

$("#exportCsv").onclick=()=>{
 let cols=['id','sourceIndex','sourceX_m','sourceY_m','receiverX_m','receiverY_m','receiverZ_m','alpha','C50_dB','earlyEnergy_pct','distance_m','arrival_ms','energy90_ms','totalSignalEnergy_modelUnits','highpass_Hz'];
 let rows=D.cases.map(c=>{let p=position(c.seat),s=D.sources[c.source];return [c.id,c.source,s[0],s[1],p.x,p.y,p.z,D.alphas[c.absorption],c.c50,c.earlyPercent,c.distance,c.arrivalMs,c.energy90Ms,c.totalEnergy,D.highpassHz];});
 let csv=[cols.join(','),...rows.map(r=>r.join(','))].join('\n');
 let u=URL.createObjectURL(new Blob([csv],{type:'text/csv'})),link=document.createElement('a');link.href=u;link.download='echolab-measurements.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);toast('Exported 180 configurations with physical units.');
};


$('#stftWindow').onchange=()=>{explainWindow();if(lastSpectra&&!$('#spectrograms').hidden)timeline.settingsChanged();};

// Course analytics: computed from the same float WAV response used for playback.
let labGeneration=0, labResponse, labCase;
const labCache=new Map();
async function refreshLab(){
 const token=++labGeneration,c=current;labResponse=null;$('#labStatus').textContent='Computing signal analytics…';
 try{
  let h=labCache.get(c.id);
  if(!h){const r=await fetch(`../data/${c.id}.wav`);if(!r.ok)throw Error('Response could not be loaded');const decoder=new OfflineAudioContext(1,1,D.fs);const b=await decoder.decodeAudioData(await r.arrayBuffer());h=b.getChannelData(0).slice();labCache.set(c.id,h);}
  if(token!==labGeneration)return;labResponse=h;labCase=c;renderLab();$('#labStatus').textContent='Computed from the playback impulse response · 16,000 samples/s · uniform absorption model';
 }catch(e){if(token===labGeneration)$('#labStatus').textContent=e.message;}
}
function plot(id,series,{xmin=0,xmax,ymin,ymax,xticks,yticks,xlabel,ylabel}){
 const {g,w,h}=canvasSetup($(id),245),L=50,R=w-18,T=24,B=h-42;
 const x=v=>L+(v-xmin)/(xmax-xmin)*(R-L),y=v=>B-(v-ymin)/(ymax-ymin)*(B-T);
 g.fillStyle='#526a78';g.fillText(ylabel,L,T-10);
 for(const t of yticks){g.strokeStyle='#e3eaf0';g.beginPath();g.moveTo(L,y(t));g.lineTo(R,y(t));g.stroke();g.fillText(t,5,y(t)+4);}
 for(const t of xticks)g.fillText(t,x(t)-8,B+17);
 g.fillText(xlabel,Math.max(L,R-g.measureText(xlabel).width),h-5);
 g.save();g.beginPath();g.rect(L,T,R-L,B-T);g.clip();
 for(const s of series){g.beginPath();s.points.forEach(([a,b],i)=>i?g.lineTo(x(a),y(b)):g.moveTo(x(a),y(b)));g.strokeStyle=s.color||'#136f91';g.lineWidth=s.width||1.6;g.stroke();}g.restore();
}
function renderLab(){
 if(!labResponse)return;const h=labResponse,c=labCase,fs=D.fs,start=Math.floor(c.arrivalMs*fs/1000),cut=+$('#energyBoundary').value;
 let total=0,peak=0,peakIndex=0;for(let i=start;i<h.length;i++){const e=h[i]*h[i];total+=e;if(Math.abs(h[i])>peak){peak=Math.abs(h[i]);peakIndex=i;}}
 let sum=0,early=0;const cumulative=[],impulse=[];
 for(let i=start;i<h.length;i++){sum+=h[i]*h[i];if(i<start+Math.round(cut*fs/1000))early+=h[i]*h[i];if(i%16===0&&i-start<=fs*.6)cumulative.push([(i-start)/fs*1000,100*sum/total]);}
 // Preserve both extrema of every display bucket instead of hiding narrow impulses.
 for(let i=start;i<Math.min(h.length,start+fs*.2);i+=8){let lo=Infinity,hi=-Infinity;for(let j=i;j<Math.min(i+8,h.length);j++){lo=Math.min(lo,h[j]);hi=Math.max(hi,h[j]);}impulse.push([(i-start)/fs*1000,lo/peak],[(i-start)/fs*1000,hi/peak]);}
 $('#boundaryValue').textContent=cut+' ms';
 $('#courseMetrics').innerHTML=[['SAMPLING RATE','16,000 / s','We record 16,000 amplitude values per second. This is a fixed setting, not a result.'],['TIME BETWEEN SAMPLES','0.0625 ms','1,000 ÷ 16,000. Adjacent sample values are 0.0000625 seconds apart.'],['PROPAGATION DELAY',`${(c.arrivalMs*fs/1000).toFixed(1)} samples`,`The first sound travels ${c.distance.toFixed(2)} m. ${c.arrivalMs.toFixed(2)} ms × 16 samples/ms gives this delay.`],['90% ENERGY TIME',`${c.energy90Ms.toFixed(1)} ms`,'A result: by this time after first arrival, 90 of every 100 energy units have arrived.']].map(([k,v,t])=>`<article><small>${k}</small><strong>${v}</strong><p>${t}</p></article>`).join('');
 plot('#impulsePlot',[{points:impulse}],{xmax:200,ymin:-1,ymax:1,xticks:[0,50,100,150,200],yticks:[-1,0,1],xlabel:'Time after direct arrival (ms)',ylabel:'Amplitude / peak |h|'});
 plot('#energyPlot',[{points:cumulative},{points:[[cut,0],[cut,100]],color:'#dc783c'}],{xmax:600,ymin:0,ymax:100,xticks:[0,150,300,450,600],yticks:[0,25,50,75,100],xlabel:'Time after direct arrival (ms)',ylabel:'Accumulated energy (%)'});
 $('#impulseInsight').textContent=`The direct signal arrives after ${c.arrivalMs.toFixed(1)} ms. The strongest absolute sample is ${((peakIndex-start)/fs*1000).toFixed(2)} ms after the arrival reference. Later oscillations come from reflections and the effective filter.`;
 $('#energyInsight').textContent=`Imagine the whole response contains 100 energy tokens. By ${cut} ms, ${(100*early/total).toFixed(1)} have arrived; ${(100*(1-early/total)).toFixed(1)} arrive later. A curve that rises sooner means more energy is concentrated near the first arrival. It does not mean the total signal is louder.`;
 $('#energyWorked').innerHTML=`<b>Your calculation, step by step</b><p>Square and sum the response samples up to ${cut} ms: ${early.toExponential(3)} model units.<br>Square and sum all response samples: ${total.toExponential(3)} model units.<br>Divide and multiply by 100: ${early.toExponential(3)} ÷ ${total.toExponential(3)} × 100 = <strong>${(100*early/total).toFixed(1)}%</strong>.</p><small>The scientific notation e−3 means “× 0.001”. Values shown are rounded; calculations use full precision.</small>`;
 let n=1;while(n<h.length)n*=2;const re=new Float64Array(n),im=new Float64Array(n);re.set(h);fft(re,im);let max=0;for(let k=0;k<=n/2;k++)max=Math.max(max,Math.hypot(re[k],im[k]));const freq=[];
 // Envelope per plotted frequency band preserves visible notches and peaks.
 const stride=Math.max(1,Math.floor(n/2/550));for(let k=1;k<n/2;k+=stride){let lo=0,hi=-100;for(let j=k;j<Math.min(k+stride,n/2);j++){const db=20*Math.log10(Math.max(1e-12,Math.hypot(re[j],im[j])/max));lo=Math.min(lo,db);hi=Math.max(hi,db);}freq.push([k*fs/n,lo],[k*fs/n,hi]);}
 plot('#frequencyPlot',[{points:freq,color:'#7859b4'}],{xmax:8000,ymin:-60,ymax:0,xticks:[0,2000,4000,6000,8000],yticks:[0,-20,-40,-60],xlabel:'Frequency (Hz)',ylabel:'20 log₁₀(|H| / max |H|), dB'});
 $('#frequencyInsight').textContent=`Notice that this is not a flat line: the response does not treat all frequencies equally. A value of −20 dB is 0.1 times the reference amplitude (0.01 times its energy). FFT bin spacing here is ${(fs/n).toFixed(3)} Hz = 16,000 ÷ ${n.toLocaleString()}; this is the grid spacing, not a quality score. The 80 Hz high-pass also shapes the low end.`;
 const lines=[0,1,2].map((abs,i)=>({color:['#136f91','#dc783c','#7859b4'][i],points:[0,1,2,3,4,5].map(row=>[row+1,get(c.source,abs,row*5+2).energy90Ms])}));
 plot('#seatPlot',lines,{xmin:1,xmax:6,ymin:0,ymax:160,xticks:[1,2,3,4,5,6],yticks:[0,40,80,120,160],xlabel:'Row (front → back), centre column',ylabel:'90% energy time (ms)'});
 const first=get(c.source,c.absorption,2),last=get(c.source,c.absorption,27);$('#seatInsight').textContent=`At ${Math.round(D.alphas[c.absorption]*100)}% absorption, the front-centre position needs ${first.energy90Ms.toFixed(1)} ms to collect 90% of its energy; the back-centre needs ${last.energy90Ms.toFixed(1)} ms. Read each intermediate point too. Moving seats changes several reflection paths, not just the direct distance.`;

}
$('#energyBoundary').oninput=renderLab;
function guidedTrial(){saved=[get(source,0,seat).id,get(source,2,seat).id];persist();activate('compare');$('#compare').scrollIntoView({behavior:'smooth'});}
$('#guidedTrial').onclick=guidedTrial;$('#absorptionTrial').onclick=guidedTrial;
window.addEventListener('resize',()=>{if(!$('#explore').hidden){renderLab();renderToy();if(lastSpectra&&!$('#spectrograms').hidden)drawSpectra(lastSpectra.dry,lastSpectra.wet,lastSpectra.fs);}});

function explainSelection(){
 const low=get(source,0,seat),high=get(source,2,seat),c=current,alpha=D.alphas[a];
 $('#absorptionHelp').textContent=`${Math.round(alpha*100)}% absorption means that each surface encounter removes that fraction of incident energy in this simplified model. ${Math.round((1-alpha)*100)}% remains reflected; the corresponding pressure-amplitude factor is √${(1-alpha).toFixed(2)} = ${Math.sqrt(1-alpha).toFixed(2)}. All six surfaces share this setting. It is not an overall percentage improvement.`;
 $('#tail90').textContent=c.energy90Ms.toFixed(1);
 $('#tailMeaning').textContent=`90% of this response’s energy arrives within ${c.energy90Ms.toFixed(1)} ms of the first sound. Shorter means a more concentrated response—not faster sound.`;
 $('#delayMeaning').textContent=`Distance ÷ speed = delay: ${c.distance.toFixed(2)} m ÷ 343 m/s = ${(c.arrivalMs/1000).toFixed(4)} s, or ${c.arrivalMs.toFixed(2)} ms. This clock starts when the lecturer makes the sound. The energy-duration clock starts when the first sound reaches you.`;
 $('#liveConclusion').innerHTML=`<b>${a===0?'Low absorption is your baseline.':'Compared with Low at this seat:'}</b><p>${a===0?'Switch to Medium or High to test absorption.':`90% energy time: <strong>${low.energy90Ms.toFixed(1)} → ${c.energy90Ms.toFixed(1)} ms</strong>.`} First arrival: <strong>${c.arrivalMs.toFixed(2)} ms</strong>, unchanged by absorption.</p>`;
 $('#experimentNarrative').textContent=`Prediction: stronger absorption weakens repeated reflections. Evidence at this seat: the 90% energy time changes from ${low.energy90Ms.toFixed(1)} ms (Low) to ${high.energy90Ms.toFixed(1)} ms (High), a decrease of ${(low.energy90Ms-high.energy90Ms).toFixed(1)} ms. Direct delay remains ${c.arrivalMs.toFixed(2)} ms. Conclusion: this model concentrates energy earlier without changing the direct propagation distance. A listening study would be needed to establish better understanding.`;
 $('#acousticWorked').innerHTML=`<b>At your selected seat:</b> imagine 100 energy units. ${c.earlyPercent.toFixed(1)} arrive early and ${(100-c.earlyPercent).toFixed(1)} arrive late. D₅₀ = ${c.earlyPercent.toFixed(1)}%. The early/late ratio is ${(c.earlyEnergy/c.lateEnergy).toFixed(2)}; 10 × log₁₀ of that ratio gives C₅₀ = ${c.c50.toFixed(2)} dB. Both numbers describe exactly the same split.`;
 renderToy();explainWindow();invalidateAudio();
}
function invalidateAudio(){timeline.clear();lastSpectra=null;$('#spectrograms').hidden=false;$('#spectrogramPlaceholder').hidden=false;$('#waveformInsight').textContent='Generate plots for this configuration. No audio result is currently displayed.';const can=$('#audioWaveform');can.getContext('2d').clearRect(0,0,can.width,can.height);}
function explainWindow(){const n=+$('#stftWindow').value;$('#windowExplanation').textContent=`Current setting: each FFT examines ${n} samples (${n/16} ms). We advance by ${n/4} samples (${n/64} ms). Frequency bins are ${16000/n} Hz apart = 16,000 ÷ ${n}. A larger window gives a finer frequency grid but mixes a longer interval of time. Window length is a choice, not a measured improvement.`;}
function toySignals(delay,gain){const x=[1,.5,-.5],h=Array(delay+1).fill(0);h[0]=1;h[delay]=gain;const y=Array(x.length+h.length-1).fill(0);for(let i=0;i<x.length;i++)for(let j=0;j<h.length;j++)y[i+j]+=x[i]*h[j];return {x,h,y};}
function renderToy(){
 const delay=+$('#toyDelay').value,gain=+$('#toyGain').value,{x,h,y}=toySignals(delay,gain);$('#toyIndex').max=y.length-1;const n=Math.min(+$('#toyIndex').value,y.length-1);$('#toyIndex').value=n;$('#toyIndexLabel').textContent=`n = ${n}`;
 const {g,w}=canvasSetup($('#convolutionPlot'),315),L=48,R=w-25,step=(R-L)/6;
 const series=[{name:'x[n] · input',v:x,color:'#136f91'},{name:'h[n] · room',v:h,color:'#7859b4'},{name:'y[n] · output',v:y,color:'#c66529'}];
 series.forEach((s,j)=>{const zero=75+j*100;g.fillStyle='#edf3f6';g.fillRect(L+n*step-step*.35,zero-48,step*.7,83);g.strokeStyle='#b9cbd5';g.beginPath();g.moveTo(L-15,zero);g.lineTo(R,zero);g.stroke();g.fillStyle=s.color;g.font='bold 12px system-ui';g.fillText(s.name,8,zero-51);g.font='11px system-ui';for(let k=0;k<y.length;k++){const v=s.v[k]||0,px=L+k*step,py=zero-v*32;g.strokeStyle=s.color;g.lineWidth=2;g.beginPath();g.moveTo(px,zero);g.lineTo(px,py);g.stroke();g.beginPath();g.arc(px,py,3,0,Math.PI*2);g.fill();g.fillText(v.toFixed(2).replace(/\.00$/,''),px-10,py+(v<0?15:-9));g.fillStyle='#667b89';g.fillText(k,px-3,zero+33);g.fillStyle=s.color;}});
 const direct=x[n]||0,echo=x[n-delay]||0;
 $('#convolutionMath').innerHTML=`<b>Inspecting output sample ${n} (the shaded column)</b><p>Output = direct copy + delayed copy.<br>y[${n}] = x[${n}] + ${gain} × x[${n-delay}]<br>= ${direct} + ${gain} × ${echo} = <strong>${y[n]}</strong>.</p><p>Values outside the three input samples are zero. ${n>=x.length&&y[n]!==0?'The input has ended, but the output is still nonzero: this is the echo extending the signal.':gain===0?'With no echo, the output matches the input. Try adding half-amplitude reflection.':'Move the sample slider to the end: the delayed copy can remain after the original ends.'}</p><small>Bottom numbers on each row are sample indices (0, 1, 2…). Values beside dots are amplitudes, not milliseconds or percentages.</small>`;
}
$('#toyDelay').onchange=renderToy;$('#toyGain').onchange=renderToy;$('#toyIndex').oninput=renderToy;
$('#analyzeAudio').onclick=()=>play(true,current,false);
const previousAudioChange=$('#audioKind').onchange;$('#audioKind').onchange=()=>{invalidateAudio();previousAudioChange();};
$('#acousticExtension').ontoggle=()=>{if($('#acousticExtension').open)lineChart($('#responseChart'),current);};
function renderComparison(){
 if(saved.length<2){$('#comparison').innerHTML='<div class="empty">Choose “Compare Low and High at this seat” in Explore for a ready-made controlled experiment, or save two configurations yourself.</div>';return;}
 const [c0,c1]=saved.map(id=>D.cases.find(c=>c.id===id)),delta=c1.energy90Ms-c0.energy90Ms,dt=c1.arrivalMs-c0.arrivalMs,samePlace=c0.source===c1.source&&c0.seat===c1.seat,sameAbs=c0.absorption===c1.absorption;
 $('#comparison').innerHTML=`<div class="compare-grid">${[c0,c1].map((c,i)=>`<article class="card"><p class="eyebrow">${i?'B · AFTER':'A · BEFORE'}</p><h2>${seatLabel(c.seat)}</h2><p>${desc(c)}</p><div class="hero-metric"><span>${c.energy90Ms.toFixed(1)}</span><span class="metric-unit">ms</span></div><p><b>Time containing 90% of response energy.</b> Imagine 100 energy tokens: 90 have arrived by this time after the first sound.</p><p>First arrival: <b>${c.arrivalMs.toFixed(2)} ms</b> after emission.<br>Distance: <b>${c.distance.toFixed(2)} m</b>.</p><button class="primary compare-play" data-i="${i}">▶ Listen to ${i?'B':'A'}</button></article>`).join('')}</div><div class="evidence-block"><h3>What the numbers actually say</h3><ol><li><b>What changed?</b> ${samePlace?'Only absorption changes; lecturer and listener positions are identical.':sameAbs?'Position changes; absorption stays fixed.': 'Both position and absorption change, so this comparison cannot isolate a single cause.'}</li><li><b>Measured difference:</b> B − A = ${c1.energy90Ms.toFixed(1)} − ${c0.energy90Ms.toFixed(1)} = <strong>${delta.toFixed(1)} ms</strong> for the 90% energy time. ${delta<0?'The negative sign means B reaches 90% sooner.':delta>0?'The positive sign means B reaches 90% later.':'The two configurations reach 90% at the same time.'}</li><li><b>Separate measurement:</b> direct arrival changes by ${dt.toFixed(2)} ms. ${samePlace?'It stays fixed because the direct path length is fixed.':'This follows the change in source-to-listener distance.'}</li><li><b>Supported conclusion:</b> ${delta<0?'Most response energy is concentrated earlier in B.':delta>0?'Most response energy takes longer to arrive in B.':'This summary does not distinguish their energy duration.'} We have not measured how many words anyone understands.</li></ol></div><p class="caption">Both audio buttons use the same selected recording and RMS setting from Explore. Listen after a click or during a speech pause. A difference in this signal metric may not be obvious to every listener.</p>`;
 document.querySelectorAll('.compare-play').forEach(el=>el.onclick=()=>play(true,[c0,c1][+el.dataset.i]));
}
function findings(){
 const b=get(0,0,27),m=get(0,0,2),t=get(0,1,27);
 $('#findingCards').innerHTML=[['1 · PROPAGATION DELAY',`${b.arrivalMs.toFixed(2)} → ${m.arrivalMs.toFixed(2)} ms`,`Move from back-centre to front-centre, holding absorption at 18%. The direct path is shorter, so the first sound arrives ${(b.arrivalMs-m.arrivalMs).toFixed(2)} ms sooner. This is a time-shift result, not an intelligibility score.`],['2 · ENERGY SPREAD',`${b.energy90Ms.toFixed(1)} → ${t.energy90Ms.toFixed(1)} ms`,`Stay at the back-centre seat and raise absorption from 18% to 40%. The 90% energy time decreases by ${(b.energy90Ms-t.energy90Ms).toFixed(1)} ms. Repeated reflections carry less energy in this model.`],['3 · CONTROLLED CHECK',`${b.arrivalMs.toFixed(2)} ms`,`Direct arrival is the same at both absorption settings. Why? Changing surface loss changes reflected amplitudes, while the direct path remains ${b.distance.toFixed(2)} m. This separates propagation delay from temporal spreading.`]].map(([title,value,text])=>`<article class="card"><p class="eyebrow">${title}</p><div class="finding-number">${value}</div><p>${text}</p></article>`).join('');
 const {g,w}=canvasSetup($('#interventionChart'),230),vals=[b,m,t],L=Math.min(150,w*.4),R=w-70,max=160,x=v=>L+v/max*(R-L);['Original seat','Move to front','Raise absorption'].forEach((label,i)=>{const yy=28+i*55;g.fillStyle='#526a78';g.fillText(label,0,yy+16);g.fillStyle=['#a6bbc8','#136f91','#d8783e'][i];g.fillRect(L,yy,x(vals[i].energy90Ms)-L,27);g.fillStyle='#172f43';g.fillText(vals[i].energy90Ms.toFixed(1)+' ms',x(vals[i].energy90Ms)+5,yy+18);});g.fillText('Time containing 90% of energy · shorter bar = earlier concentration',0,220);
 $('#interventionText').textContent=`Read the bars: baseline ${b.energy90Ms.toFixed(1)} ms; move to front ${m.energy90Ms.toFixed(1)} ms; raise absorption ${t.energy90Ms.toFixed(1)} ms. Raising absorption yields the shorter energy duration among these two interventions. This does not establish the cheaper option or the option with better word recognition. The comparison button isolates absorption at the same back-centre seat.`;
 const explanations=['Checks the direct pulse reaches the expected sample (distance ÷ speed).','Checks distance attenuation before conditioning the response.','Checks that all six walls contribute a first reflection.','Checks that convolving with an ideal unit impulse leaves a signal unchanged.','Checks whether adding further reflection orders appreciably changes the optional acoustic ratio.'];
 $('#validationList').innerHTML=D.validation.tests.map((name,i)=>`<div class="test-row"><div><b>${name}</b><p class="caption">${explanations[i]}</p></div><span class="pass">PASS</span></div>`).join('')+`<p class="caption">Largest checked change between reflection orders 48 and 64: ${D.validation.maxDeltaDb.toFixed(4)} dB in C₅₀; test threshold: ${D.validation.toleranceDb} dB. These 18 checks concern that metric, not convergence of every plot or physical accuracy.</p>`;
}
function drawSpectra(){timeline.redraw();}
const guide=installSpectrogramGuide();
const timeline=installTimeline({getContext:context,fft,canvasSetup,plot,stopOther:stopExternal,onInspect:guide.update,onClear:guide.clear,onWindowChanged:explainWindow,requestPrepare:async()=>{const id=current.id,kind=$('#audioKind').value;await play(true,current,false);return timeline.matches(id,kind);}});
const study=installStudy({getData:()=>D,getCurrent:()=>current,plot});
$('#match').onchange=()=>{stopExternal();timeline.settingsChanged();};
