import {clamp, sampleEnergy, playbackGain, clockPosition, visibleRange, windowMetrics, frameSpectrum, hannWeight, plotTime} from './timeline-math.js?v=2';

export function installTimeline({getContext, fft, canvasSetup, plot, stopOther, requestPrepare, onInspect=()=>{}, onClear=()=>{}, onWindowChanged=()=>{}}) {
 const $=s=>document.querySelector(s);
 const panel=document.createElement('section');panel.className='timeline-panel workbench-transport';panel.id='timelinePanel';
 panel.innerHTML=`<fieldset id="timelineControls" disabled><legend class="sr-only">Playback and window navigation</legend><div class="transport-row"><button id="timelinePlay" class="primary">▶ Play</button><button id="timelinePause" class="secondary">Pause</button><button id="timelineExcerpt" class="subtle">Play 0.3 s here</button><label>Track<select id="timelineTrack"><option value="wet">Room output</option><option value="dry">Original</option></select></label><label>Time view<select id="timelineZoom"><option value="0">Full recording</option><option value="2">2 seconds</option><option value="0.5">0.5 seconds</option><option value="0.1">0.1 seconds</option></select></label><button id="previousFrame" class="subtle" aria-label="Previous STFT frame">← Frame</button><button id="nextFrame" class="subtle" aria-label="Next STFT frame">Frame →</button><output id="timelineTime" aria-live="off">0.000 / 0.000 s</output></div><details class="precise-navigation"><summary>Exact time & repeat interval</summary><div class="loop-row"><label>Go to time (s) <input id="timelineSeek" type="number" min="0" max="1" step="0.001" value="0"></label><button id="markStart" class="subtle">Set loop start</button><button id="markEnd" class="subtle">Set loop end</button><label class="check"><input id="timelineLoop" type="checkbox">Repeat</label><span id="loopRange">No loop selected</span></div></details></fieldset><span id="transportState" class="transport-state" role="status">Prepare a sound or use Play beside a plot.</span>`;
 $('#workbenchTransport').append(panel);
 const inspector=document.createElement('section');inspector.className='frame-inspector';
 inspector.innerHTML=`<div class="frame-heading"><h3>Selected window</h3><span class="window-key">Pink curve · Hann weight</span><button id="exportFrame" class="subtle" disabled>Export spectrum</button></div><div class="frame-grid"><div><p class="plot-label">Samples + window shape</p><canvas id="frameWave" aria-label="Selected samples and the actual Hann window weights"></canvas></div><div><p class="plot-label">FFT of the selected window</p><canvas id="frameFrequency" aria-label="Spectrum of the selected original and room window"></canvas></div></div>`;
 $('#workbenchFrame').append(inspector);
 const notes=document.createElement('div');notes.className='window-results';notes.innerHTML=`<h3>At the selected moment</h3><p id="frameSummary" class="read-guide">Hover over a prepared plot to preview a window. Click or drag to select it.</p><details><summary>RMS and frequency-amplitude measurements</summary><div id="frameMetrics"></div><p class="caption">RMS is measured over the selected window, with zero padding beyond the clip. dBFS uses digital amplitude 1 as reference, not sound pressure. Values include listening gain. FFT magnitudes use a Hann window and one-sided amplitude normalization.</p></details><p id="timelineHelp" class="caption"></p>`;
 $('#audioExplanations').append(notes);
 const localControls=[];
 for(const [id,selector,label,track] of [['wave','#audioWaveform','waveform','both'],['originalSpec','#drySpectrum','original spectrogram','dry'],['roomSpec','#wetSpectrum','room spectrogram','wet']]){
  const box=document.createElement('div');box.className='plot-inline-controls';
  box.innerHTML=`${track!=='wet'?`<button id="${id}PlayDry" class="secondary" aria-label="Play original at ${label}">▶ Original</button>`:''}${track!=='dry'?`<button id="${id}PlayWet" class="primary" aria-label="Play room output at ${label}">▶ Room</button>`:''}<button id="${id}Pause" class="subtle" disabled>Pause</button><button id="${id}Excerpt" class="subtle" disabled>0.3 s here</button>`;
  $(selector).before(box);const controls={pause:$('#'+id+'Pause'),excerpt:$('#'+id+'Excerpt')};localControls.push(controls);
  if(track!=='wet')$('#'+id+'PlayDry').onclick=()=>localPlay('dry');
  if(track!=='dry')$('#'+id+'PlayWet').onclick=()=>localPlay('wet');
  controls.pause.onclick=pause;controls.excerpt.onclick=()=>localPlay(track==='both'?$('#timelineTrack').value:track,true);
 }
 const canvases=['#audioWaveform','#drySpectrum','#wetSpectrum'];
 const overlays=canvases.map(id=>{const can=$(id),wrap=document.createElement('div');wrap.className='cursor-plot';wrap.id=id.slice(1)+'Surface';wrap.tabIndex=0;wrap.setAttribute('role','slider');wrap.setAttribute('aria-label','Select time on '+id.slice(1));wrap.setAttribute('aria-valuemin','0');wrap.setAttribute('aria-valuemax','0');wrap.setAttribute('aria-valuenow','0');wrap.setAttribute('aria-describedby','plotInteractionHelp');can.before(wrap);wrap.append(can);const overlay=document.createElement('canvas');overlay.className='playhead-overlay';overlay.setAttribute('aria-hidden','true');wrap.append(overlay);return {can,overlay,wrap};});
 let data=null,fs=16000,duration=0,offset=0,started=0,node=null,context=null,raf=0,generation=0,loopFrom=0,loopTo=0,scaled=[],buffers=[],images=[],peak=1,range=[],lastInspector=-Infinity,frameData=null,renderSignature='';
 let activeLoop={from:0,to:0},excerptEnd=null,localBusy=false,previewTime=null,dragRange=null,hoverFrame=0;
 const isPlaying=()=>!!node;
 function position(){return node?Math.min(excerptEnd??duration,clockPosition({offset,started,now:context.currentTime,duration,loop:node.loop,from:activeLoop.from,to:activeLoop.to})):offset;}
 function halt(){generation++;if(node){offset=position();node.onended=null;try{node.stop();}catch{}node.disconnect();node=null;}cancelAnimationFrame(raf);raf=0;}
 function setState(text){$('#transportState').textContent=text;}
 
 async function localPlay(kind,excerpt=false){if(localBusy)return;try{if(!data){localBusy=true;setState('Preparing audio… stay here.');if(!requestPrepare || !(await requestPrepare())){setState($('#audioStatus').textContent||'Choose a source recording first.');return;}}if(!data)return;await playTrack(kind,excerpt ? .3 : null);}catch(e){setState(e.message);}finally{localBusy=false;}}
 function pause(){previewTime=null;halt();setState(data?'Paused · inspect this moment':'Prepare timeline to begin');paintCursor(true);}
 function stop(reset=true){previewTime=null;dragRange=null;halt();if(reset)offset=0;setState(data?'Stopped':'Prepare timeline to begin');paintCursor(true);}
 async function playTrack(kind=$('#timelineTrack').value,excerptSeconds=null){
  if(!data)return;previewTime=null;dragRange=null;halt();const token=generation;stopOther();context=await getContext();if(token!==generation)return;
  $('#timelineTrack').value=kind;if(offset>=duration-.001){if(excerptSeconds){setState('At clip end · choose an earlier slice.');return;}offset=0;}
  const loop=!excerptSeconds && $('#timelineLoop').checked && loopTo-loopFrom>=.02;if(loop&&(offset<loopFrom||offset>=loopTo))offset=loopFrom;
  node=context.createBufferSource();node.buffer=buffers[kind==='dry'?0:1];node.loop=loop;node.loopStart=loopFrom;node.loopEnd=loopTo;activeLoop={from:loopFrom,to:loopTo};node.connect(context.destination);started=context.currentTime;
  excerptEnd=excerptSeconds?Math.min(duration,offset+excerptSeconds):null;const active=node;node.onended=()=>{if(node!==active)return;node.disconnect();node=null;offset=excerptEnd??duration;cancelAnimationFrame(raf);setState(excerptEnd!==null?'Slice finished · inspect or replay':'Finished · drag to replay');paintCursor(true);};
  if(excerptSeconds)node.start(0,offset,excerptEnd-offset);else node.start(0,offset);setState(`Playing · ${kind==='dry'?'original':'room output'}`);$('#audioStatus').textContent='Synchronized playback · direct delay removed · same cursor on all audio plots.';tick();
 }
 function seek(t,resume=isPlaying()){previewTime=null;halt();offset=clamp(t,0,duration);paintCursor(true);setState('Paused · inspect this moment');if(resume)void playTrack();}
 function tick(){paintCursor();if(node)raf=requestAnimationFrame(tick);}
 function clear(){previewTime=null;dragRange=null;cancelAnimationFrame(hoverFrame);hoverFrame=0;halt();onClear();data=null;duration=0;offset=0;scaled=[];images=[];buffers=[];renderSignature='';frameData=null;$('#timelineControls').disabled=true;$('#exportFrame').disabled=true;$('#timelineSeek').value=0;$('#timelineTime').textContent='0.000 / 0.000 s';$('#frameSummary').textContent='Prepare the timeline for the selected sound and seat.';$('#frameMetrics').textContent='';$('#loopRange').textContent='No loop selected';$('#timelineLoop').checked=false;for(const c of localControls){c.pause.disabled=true;c.excerpt.disabled=true;}setState('Prepare timeline to begin');for(const {can,overlay,wrap} of overlays){wrap.setAttribute('aria-disabled','true');wrap.setAttribute('aria-valuenow','0');can.getContext('2d').clearRect(0,0,can.width,can.height);overlay.getContext('2d').clearRect(0,0,overlay.width,overlay.height);}for(const id of ['#frameWave','#frameFrequency']){const c=$(id);c.getContext('2d').clearRect(0,0,c.width,c.height);}}
 function matchGains(){const length=Math.max(data.dry.length,data.wet.length),match=$('#match').checked;scaled=[data.dry,data.wet].map(x=>{const gain=playbackGain(x,length,match);return Float32Array.from({length},(_,i)=>(x[i]||0)*gain);});peak=1e-12;for(const x of scaled)for(const v of x)peak=Math.max(peak,Math.abs(v));buffers=scaled.map(x=>{const b=context.createBuffer(1,x.length,fs);b.copyToChannel(x,0);return b;});}
 function buildSpectrograms(){
  const n=+$('#stftWindow').value,hop=n/4,frames=Math.ceil(duration*fs/hop),rows=n/2,values=[];let max=-75;
  for(const x of scaled){const arr=new Float32Array(frames*rows);for(let t=0;t<frames;t++){const frame=frameSpectrum(x,fs,t*hop/fs,n,fft);arr.set(frame,t*rows);for(const value of frame)max=Math.max(max,value);}values.push(arr);}
  images=values.map(arr=>{const raw=document.createElement('canvas');raw.width=frames;raw.height=rows;const g=raw.getContext('2d'),im=g.createImageData(frames,rows);for(let t=0;t<frames;t++)for(let f=0;f<rows;f++){const v=clamp((arr[t*rows+f]-max+75)/75,0,1),i=((rows-f-1)*frames+t)*4;im.data[i]=13+230*v*v;im.data[i+1]=29+195*v;im.data[i+2]=41+80*Math.sin(v*Math.PI);im.data[i+3]=255;}g.putImageData(im,0,0);return raw;});
  $('#spectrumScale').textContent=`Shared colour reference: strongest value in this pair = 0 dB (reference held at −75 dBFS for near-silent clips); colour floor = −75 dB relative to that reference. Full ${duration.toFixed(2)} s clip analysed. Each column is a Hann-windowed FFT, advanced by ${hop/fs*1000} ms. Cursor marks the selected window’s start.`;
 }
 async function load(dry,wet,sampleRate,meta){clear();const token=generation;const audioContext=await getContext();if(token!==generation)return;context=audioContext;data={dry,wet,meta};fs=sampleRate;duration=Math.max(dry.length,wet.length)/fs;loopTo=duration;loopFrom=0;$('#timelineControls').disabled=false;$('#exportFrame').disabled=false;$('#timelineSeek').max=duration;for(const c of localControls){c.pause.disabled=false;c.excerpt.disabled=false;}for(const item of overlays){item.wrap.setAttribute('aria-valuemax',String(duration));item.wrap.setAttribute('aria-disabled','false');}$('#loopRange').textContent=`Loop: 0.000–${duration.toFixed(3)} s`;matchGains();buildSpectrograms();redraw();setState('Ready · drag or play');$('#timelineHelp').textContent=`${meta.kind==='voice'?'Synthetic speech':meta.kind==='pulse'?'Diagnostic clicks':'Your recording'} · ${duration.toFixed(2)} s including the response tail · ${meta.label}. Hover to preview; click or drag to select a window. Arrow keys step through frames. Changing the listener or audio clears these results.`;}
 function redraw(){if(!data)return;renderSignature='';paintCursor(true);}
 function renderBackground(){
  const [left,right]=range,seconds=right-left;
  const series=scaled.map((x,j)=>{const points=[],start=Math.floor(left*fs),end=Math.ceil(right*fs),step=Math.max(1,Math.floor((end-start)/700));for(let i=start;i<end;i+=step){let lo=0,hi=0;for(let k=i;k<Math.min(end,i+step);k++){const v=(x[k]||0)/peak;lo=Math.min(lo,v);hi=Math.max(hi,v);}points.push([i/fs,lo],[i/fs,hi]);}return {points,color:j?'#d8783e':'#136f91'};});
  plot('#audioWaveform',series,{xmin:left,xmax:right,ymin:-1,ymax:1,xticks:[left,left+seconds/2,right].map(v=>+v.toFixed(2)),yticks:[-1,0,1],xlabel:'Time (s) · aligned for listening',ylabel:'Amplitude / shared display peak'});
  images.forEach((raw,j)=>{const {g,w,h}=canvasSetup($(j?'#wetSpectrum':'#drySpectrum'),180),L=38,R=w-12,T=15,B=h-30;g.drawImage(raw,left/duration*raw.width,0,seconds/duration*raw.width,raw.height,L,T,R-L,B-T);g.fillStyle='#526a78';g.font='10px system-ui';for(const f of [0,4,8])g.fillText(f+'k',8,B-f/8*(B-T)+3);g.fillText('Hz',6,10);for(const t of [left,left+seconds/2,right])g.fillText(t.toFixed(2),L+(t-left)/seconds*(R-L)-10,B+16);g.fillText('seconds',R-39,h-1);});
  for(const {can,overlay} of overlays){overlay.width=can.width;overlay.height=can.height;}
 }
 function paintCursor(force=false){
  if(!data)return;const t=previewTime??position();$('#timelineSeek').value=position().toFixed(3);$('#timelineTime').textContent=`${previewTime!==null?'Preview ':''}${t.toFixed(3)} / ${duration.toFixed(3)} s`;
  range=dragRange||visibleRange(position(),duration,+$('#timelineZoom').value);const signature=range.join(',')+','+$('#audioWaveform').clientWidth;if(signature!==renderSignature){renderSignature=signature;renderBackground();}
  overlays.forEach(({can,overlay,wrap},j)=>{
   const g=overlay.getContext('2d'),dpr=devicePixelRatio||1,w=can.width/dpr,h=can.height/dpr,L=j?38:50,R=w-(j?12:18),T=j?15:24,B=h-(j?30:42),durationOnScreen=range[1]-range[0],n=+$('#stftWindow').value,x=L+(t-range[0])/durationOnScreen*(R-L),end=L+(t+n/fs-range[0])/durationOnScreen*(R-L);
   g.clearRect(0,0,overlay.width,overlay.height);g.save();g.scale(dpr,dpr);g.beginPath();g.rect(L,T,R-L,B-T);g.clip();
   g.fillStyle='#ee52751c';g.fillRect(x,T,end-x,B-T);
   if(j===0){g.beginPath();for(let k=0;k<n;k++){const px=x+(end-x)*k/n,mid=(T+B)/2,py=mid-hannWeight(k,n)*(mid-T);k?g.lineTo(px,py):g.moveTo(px,py);}g.strokeStyle='#d73f76';g.lineWidth=2;g.stroke();}
   g.strokeStyle='#d73f76';g.lineWidth=1.5;g.beginPath();g.moveTo(x,T);g.lineTo(x,B);g.stroke();g.restore();
   wrap.setAttribute('aria-valuenow',position().toFixed(3));wrap.setAttribute('aria-valuetext',position().toFixed(3)+' seconds');
  });
  if(force||Math.abs(t-lastInspector)>.1){lastInspector=t;inspect(t);}
 }
 function inspect(t){
  const n=+$('#stftWindow').value,winMs=n/fs*1000,stats=scaled.map(x=>windowMetrics(x,fs,t,n)),spectra=scaled.map(x=>frameSpectrum(x,fs,t,n,fft));
  const waves=scaled.map((x,j)=>({color:j?'#d8783e':'#136f91',points:Array.from({length:n},(_,i)=>[i/fs*1000,(x[Math.floor(t*fs)+i]||0)/peak])}));
  waves.push({color:'#d73f76',points:Array.from({length:n},(_,i)=>[i/fs*1000,hannWeight(i,n)])});
  plot('#frameWave',waves,{xmax:winMs,ymin:-1,ymax:1,xticks:[0,winMs/2,winMs],yticks:[-1,0,1],xlabel:'Milliseconds into selected window',ylabel:'Signal / peak; Hann weight 0–1'});
  plot('#frameFrequency',spectra.map((x,j)=>({color:j?'#d8783e':'#136f91',points:Array.from(x,(v,k)=>[k*fs/n,v])})),{xmax:8000,ymin:-100,ymax:6,xticks:[0,2000,4000,6000,8000],yticks:[6,0,-25,-50,-75,-100],xlabel:'Frequency (Hz)',ylabel:'Windowed amplitude (dBFS)'});
  const bothSilent=stats.every(s=>s.rms<1e-7),tail=stats[0].rms<1e-7&&stats[1].rms>=1e-7;
  $('#frameSummary').textContent=`${previewTime!==null?'Preview':'Selected'} slice: ${t.toFixed(3)}–${(t+n/fs).toFixed(3)} s (${winMs} ms, ${n} samples). ${bothSilent?'Both signals are silent or near-silent here.':tail?'The original is near-silent but the room output still contains energy: inspect the lingering tail.':'Both views show the same selected slice: waveform on the left, its frequency components on the right.'}`;
  const db=r=>r<1e-8?'below −160':(20*Math.log10(r)).toFixed(1);
  $('#frameMetrics').innerHTML=`<div class="frame-values"><p><b>Original RMS</b><strong>${stats[0].rms.toFixed(5)}</strong><small>${db(stats[0].rms)} dBFS</small></p><p><b>Room RMS</b><strong>${stats[1].rms.toFixed(5)}</strong><small>${db(stats[1].rms)} dBFS</small></p></div>`;
  onInspect({time:t,windowMs:winMs,kind:data.meta.kind,originalRms:stats[0].rms,roomRms:stats[1].rms});
  frameData={time_s:t,windowSamples:n,sampleRate:fs,matched:$('#match').checked,configuration:data.meta.id,originalRMS:stats[0].rms,roomRMS:stats[1].rms,spectra};
 }
 $('#timelinePlay').onclick=()=>localPlay($('#timelineTrack').value);$('#timelineExcerpt').onclick=()=>localPlay($('#timelineTrack').value,true);$('#timelinePause').onclick=pause;
 $('#timelineSeek').onfocus=pause;$('#timelineSeek').onchange=e=>seek(+e.target.value,false);$('#timelineSeek').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();seek(+e.target.value,false);}};
 $('#timelineTrack').onchange=()=>{if(isPlaying())void playTrack();};
 $('#timelineZoom').onchange=()=>{previewTime=null;redraw();};
 $('#previousFrame').onclick=()=>seek(position()-(+$('#stftWindow').value)/4/fs,false);
 $('#nextFrame').onclick=()=>seek(position()+(+$('#stftWindow').value)/4/fs,false);
 const updateLoop=()=>{$('#loopRange').textContent=`Loop: ${loopFrom.toFixed(3)}–${loopTo.toFixed(3)} s`;if(isPlaying())void playTrack();};
 $('#markStart').onclick=()=>{const t=position();if(loopTo-t<.02){$('#timelineHelp').textContent='Choose a loop start at least 20 ms before its end.';return;}loopFrom=t;updateLoop();};
 $('#markEnd').onclick=()=>{const t=position();if(t-loopFrom<.02){$('#timelineHelp').textContent='Choose a loop end at least 20 ms after its start.';return;}loopTo=t;updateLoop();};
 $('#timelineLoop').onchange=updateLoop;
 overlays.forEach(({wrap,can},j)=>{
  let dragging=false;
  const timeAt=e=>{const rect=can.getBoundingClientRect();return plotTime(e.clientX,rect.left,rect.width,j?38:50,j?12:18,dragRange||range,duration);};
  wrap.addEventListener('pointermove',e=>{if(!data||!range.length)return;if(dragging){seek(timeAt(e),false);return;}if(node||e.pointerType==='touch')return;previewTime=timeAt(e);if(!hoverFrame)hoverFrame=requestAnimationFrame(()=>{hoverFrame=0;paintCursor(true);});});
  wrap.addEventListener('pointerleave',()=>{if(dragging)return;previewTime=null;cancelAnimationFrame(hoverFrame);hoverFrame=0;paintCursor(true);});
  wrap.addEventListener('pointerdown',e=>{if(!data||!range.length)return;e.preventDefault();dragRange=range.slice();dragging=true;wrap.setPointerCapture?.(e.pointerId);seek(timeAt(e),false);wrap.focus?.();});
  const endDrag=e=>{if(!dragging)return;dragging=false;dragRange=null;if(wrap.hasPointerCapture?.(e.pointerId))wrap.releasePointerCapture(e.pointerId);paintCursor(true);};
  wrap.addEventListener('pointerup',endDrag);wrap.addEventListener('pointercancel',endDrag);
  wrap.addEventListener('keydown',e=>{if(!data)return;const hop=(+$('#stftWindow').value)/4/fs,step=e.shiftKey?.1:hop;let target;if(e.key==='ArrowLeft')target=position()-step;else if(e.key==='ArrowRight')target=position()+step;else if(e.key==='Home')target=0;else if(e.key==='End')target=duration;else if(e.key===' '){e.preventDefault();if(node)pause();else void playTrack();return;}else return;e.preventDefault();seek(target,false);});
 });
 $('#exportFrame').onclick=()=>{if(!frameData)return;const f=frameData,rows=['configuration,time_s,window_samples,frequency_Hz,original_dBFS,room_dBFS,RMS_matching'];for(let k=0;k<f.spectra[0].length;k++)rows.push([f.configuration,f.time_s,f.windowSamples,k*fs/f.windowSamples,f.spectra[0][k],f.spectra[1][k],f.matched].join(','));const url=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download='echolab-selected-spectrum.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setState('Selected spectrum exported');};
 function settingsChanged(){if(!data)return;const wasPlaying=isPlaying();pause();matchGains();buildSpectrograms();redraw();if(wasPlaying)void playTrack();}
 return {load,playTrack,pause,stop,clear,redraw,settingsChanged,matches:(id,kind)=>data?.meta.id===id&&data?.meta.kind===kind};
}
