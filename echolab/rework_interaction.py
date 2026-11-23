from pathlib import Path
p=Path('echolab/dist/timeline.js');s=p.read_text(encoding='utf-8')
s=s.replace('windowMetrics, frameSpectrum}', 'windowMetrics, frameSpectrum, hannWeight, plotTime}')
a=s.index(" const panel=document.createElement");b=s.index(" const canvases=",a)
s=s[:a]+''' const panel=document.createElement('section');panel.className='timeline-panel workbench-transport';panel.id='timelinePanel';
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
'''+s[b:]
s=s.replace("wrap.className='cursor-plot';", "wrap.className='cursor-plot';wrap.id=id.slice(1)+'Surface';wrap.tabIndex=0;wrap.setAttribute('role','slider');wrap.setAttribute('aria-label','Select time on '+id.slice(1));wrap.setAttribute('aria-valuemin','0');wrap.setAttribute('aria-valuemax','0');wrap.setAttribute('aria-valuenow','0');wrap.setAttribute('aria-describedby','plotInteractionHelp');")
s=s.replace("let activeLoop={from:0,to:0},excerptEnd=null,localBusy=false;", "let activeLoop={from:0,to:0},excerptEnd=null,localBusy=false,previewTime=null,dragRange=null,hoverFrame=0;")
s=s.replace("function setState(text){$('#transportState').textContent=text;for(const c of localControls)c.status.textContent=text;}", "function setState(text){$('#transportState').textContent=text;}")
s=s.replace("function syncZoom(){for(const c of localControls)c.zoom.value=$(c.isFrame?'#stftWindow':'#timelineZoom').value;}", "")
s=s.replace("async function localPlay(kind,controls,excerpt=false)", "async function localPlay(kind,excerpt=false)")
s=s.replace("if(!data)return;halt();const token=generation;", "if(!data)return;previewTime=null;dragRange=null;halt();const token=generation;")
s=s.replace("function seek(t,resume=isPlaying()){halt();", "function seek(t,resume=isPlaying()){previewTime=null;halt();")
s=s.replace("function clear(){halt();", "function clear(){previewTime=null;dragRange=null;cancelAnimationFrame(hoverFrame);hoverFrame=0;halt();")
s=s.replace("for(const c of localControls){c.seek.disabled=true;c.pause.disabled=true;c.excerpt.disabled=true;c.seek.value=0;c.time.textContent='Not prepared';}", "for(const c of localControls){c.pause.disabled=true;c.excerpt.disabled=true;}")
s=s.replace("for(const c of localControls){c.seek.disabled=false;c.pause.disabled=false;c.excerpt.disabled=false;c.seek.max=duration;}", "for(const c of localControls){c.pause.disabled=false;c.excerpt.disabled=false;}for(const item of overlays)item.wrap.setAttribute('aria-valuemax',String(duration));")
s=s.replace("function redraw(){syncZoom();", "function redraw(){")
s=s.replace("const t=position();offset=node?offset:t;$('#timelineSeek').value=t;$('#timelineTime').textContent=`${t.toFixed(3)} / ${duration.toFixed(3)} s`;for(const c of localControls){c.seek.value=t;c.time.textContent=`${t.toFixed(3)} / ${duration.toFixed(3)} s`;}", "const t=previewTime??position();$('#timelineSeek').value=position().toFixed(3);$('#timelineTime').textContent=`${previewTime!==null?'Preview ':''}${t.toFixed(3)} / ${duration.toFixed(3)} s`;")
s=s.replace("range=visibleRange(t,duration,+$('#timelineZoom').value);", "range=dragRange||visibleRange(position(),duration,+$('#timelineZoom').value);")
a=s.index("  overlays.forEach(({can,overlay},j)=>");b=s.index("  if(force||",a)
s=s[:a]+'''  overlays.forEach(({can,overlay,wrap},j)=>{
   const g=overlay.getContext('2d'),dpr=devicePixelRatio||1,w=can.width/dpr,h=can.height/dpr,L=j?38:50,R=w-(j?12:18),T=j?15:24,B=h-(j?30:42),durationOnScreen=range[1]-range[0],n=+$('#stftWindow').value,x=L+(t-range[0])/durationOnScreen*(R-L),end=L+(t+n/fs-range[0])/durationOnScreen*(R-L);
   g.clearRect(0,0,overlay.width,overlay.height);g.save();g.scale(dpr,dpr);g.beginPath();g.rect(L,T,R-L,B-T);g.clip();
   g.fillStyle='#ee52751c';g.fillRect(x,T,end-x,B-T);
   if(j===0){g.beginPath();for(let k=0;k<n;k++){const px=x+(end-x)*k/(n-1),py=B-hannWeight(k,n)*(B-T);k?g.lineTo(px,py):g.moveTo(px,py);}g.strokeStyle='#d73f76';g.lineWidth=2;g.stroke();}
   g.strokeStyle='#d73f76';g.lineWidth=1.5;g.beginPath();g.moveTo(x,T);g.lineTo(x,B);g.stroke();g.restore();
   wrap.setAttribute('aria-valuenow',position().toFixed(3));wrap.setAttribute('aria-valuetext',position().toFixed(3)+' seconds');
  });
'''+s[b:]
s=s.replace("plot('#frameWave',waves,", "waves.push({color:'#d73f76',points:Array.from({length:n},(_,i)=>[i/fs*1000,hannWeight(i,n)])});\n  plot('#frameWave',waves,")
s=s.replace("xlabel:'Milliseconds into selected window',ylabel:'Amplitude / shared display peak'", "xlabel:'Milliseconds into selected window',ylabel:'Signal / peak; Hann weight 0–1'")
s=s.replace("$('#timelinePlay').onclick=()=>void playTrack();", "$('#timelinePlay').onclick=()=>localPlay($('#timelineTrack').value);$('#timelineExcerpt').onclick=()=>localPlay($('#timelineTrack').value,true);")
s=s.replace("$('#timelineZoom').onchange=()=>{syncZoom();redraw();};", "$('#timelineZoom').onchange=()=>{previewTime=null;redraw();};")
a=s.index(" overlays.forEach(({wrap,can},j)=>wrap.addEventListener('pointerdown'");b=s.index(" $('#exportFrame').onclick",a)
s=s[:a]+''' overlays.forEach(({wrap,can},j)=>{
  let dragging=false;
  const timeAt=e=>{const rect=can.getBoundingClientRect();return plotTime(e.clientX,rect.left,rect.width,j?38:50,j?12:18,dragRange||range,duration);};
  wrap.addEventListener('pointermove',e=>{if(!data||!range.length)return;if(dragging){seek(timeAt(e),false);return;}if(node||e.pointerType==='touch')return;previewTime=timeAt(e);if(!hoverFrame)hoverFrame=requestAnimationFrame(()=>{hoverFrame=0;paintCursor(true);});});
  wrap.addEventListener('pointerleave',()=>{if(dragging)return;previewTime=null;cancelAnimationFrame(hoverFrame);hoverFrame=0;paintCursor(true);});
  wrap.addEventListener('pointerdown',e=>{if(!data||!range.length)return;e.preventDefault();dragRange=range.slice();dragging=true;wrap.setPointerCapture?.(e.pointerId);seek(timeAt(e),false);wrap.focus?.();});
  const endDrag=e=>{if(!dragging)return;dragging=false;dragRange=null;if(wrap.hasPointerCapture?.(e.pointerId))wrap.releasePointerCapture(e.pointerId);paintCursor(true);};
  wrap.addEventListener('pointerup',endDrag);wrap.addEventListener('pointercancel',endDrag);
  wrap.addEventListener('keydown',e=>{if(!data)return;const hop=(+$('#stftWindow').value)/4/fs,step=e.shiftKey?.1:hop;let target;if(e.key==='ArrowLeft')target=position()-step;else if(e.key==='ArrowRight')target=position()+step;else if(e.key==='Home')target=0;else if(e.key==='End')target=duration;else if(e.key===' '){e.preventDefault();if(node)pause();else void playTrack();return;}else return;e.preventDefault();seek(target,false);});
 });
'''+s[b:]
s=s.replace("function settingsChanged(){syncZoom();", "function settingsChanged(){")
s=s.replace("Click a waveform or spectrogram to seek.", "Hover to preview; click or drag to select a window. Arrow keys step through frames.")
p.write_text(s,encoding='utf-8')
p=Path('echolab/dist/timeline-math.js');s=p.read_text(encoding='utf-8');s+='''
export function hannWeight(i,n){return .5-.5*Math.cos(2*Math.PI*i/(n-1));}
export function plotTime(clientX,left,width,padLeft,padRight,range,duration){
 const ratio=clamp((clientX-left-padLeft)/Math.max(1,width-padLeft-padRight),0,1);
 return clamp(range[0]+ratio*(range[1]-range[0]),0,duration);
}
''';s=s.replace('const w=.5-.5*Math.cos(2*Math.PI*i/(n-1));weight+=w;', 'const w=hannWeight(i,n);weight+=w;');p.write_text(s,encoding='utf-8')
