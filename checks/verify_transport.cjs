// Fake DOM and audio nodes exercise lifecycle code without opening a browser/device.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const read = file => fs.readFileSync(path.join(__dirname, '..', 'dist', file), 'utf8');
const nodes = new Map();
const drawing = new Proxy({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }, { get: (o, k) => o[k] || (() => {}) });
class Element {
  constructor() { this.value = ''; this.checked = false; this.width = 600; this.height = 245; this.clientWidth = 600; this.disabled = false; this.textContent = ''; this.handlers = {}; }
  set innerHTML(text) { for (const m of text.matchAll(/id="([^"]+)"/g)) nodes.set('#' + m[1], new Element()); }
  set id(value){this._id=value;nodes.set('#'+value,this);}
  get id(){return this._id;}
  focus() {} setPointerCapture() {} hasPointerCapture(){return false;}
  getContext() { return drawing; }
  before() {} after() {} append() {} setAttribute() {} click() {} remove() {}
  addEventListener(type, fn) { this.handlers[type] = fn; }
  getBoundingClientRect() { return { left: 0, width: this.clientWidth }; }
}
const element = id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
const created = [], animationFrames=new Map();let animationId=0;
const flushFrame=()=>{const pending=[...animationFrames.values()];animationFrames.clear();pending.forEach(fn=>fn());};
const audio = {
  currentTime: 0,
  createBuffer(channels, length, rate) { return { length, sampleRate: rate, copyToChannel() {} }; },
  createBufferSource() { const node = { loop: false, connect() {}, disconnect() {}, stop() { this.stopped = true; }, start(when, offset, duration) { this.startOffset = offset; this.startDuration = duration; } }; created.push(node); return node; },
  destination: {}
};
let pendingContext = null, prepareLocal = async () => false;
const ctx = {
  document: { createElement: () => new Element(), querySelector: element },
  window: { addEventListener() {} },
  devicePixelRatio: 1, requestAnimationFrame: fn => {animationFrames.set(++animationId,fn);return animationId;}, cancelAnimationFrame: id=>animationFrames.delete(id),
  setTimeout, Blob, URL,
  getContext: () => pendingContext || Promise.resolve(audio), requestPrepare: () => prepareLocal(),
  canvasSetup: (can, height) => ({ g: drawing, w: 600, h: height }), plot() {}, stopOther() {}
};
vm.createContext(ctx);
vm.runInContext(read('timeline-math.js').replace(/export /g, ''), ctx);
const app = read('app.js');
vm.runInContext(app.slice(app.indexOf('function fft('), app.indexOf('function spectrum(')), ctx);
vm.runInContext(read('timeline.js').replace(/^import .*\r?\n/, '').replace('export function', 'function'), ctx);
const near = (a, b) => assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
(async () => {
  const transport = ctx.installTimeline(ctx);
  element('#stftWindow').value = 256; element('#match').checked = true;
  element('#timelineZoom').value = 0; element('#timelineTrack').value = 'wet';
  const sound = Float32Array.from({ length: 3200 }, (_, k) => .2 * Math.sin(k * .1));
  await transport.load(sound, sound, 16000, { id: '0-0-27', kind: 'pulse', label: 'test' });
  assert(transport.matches('0-0-27', 'pulse'));
  await transport.playTrack('wet');
  near(created.at(-1).startOffset, 0);
  audio.currentTime = .05;
  transport.pause();
  assert(element('#timelineTime').textContent.startsWith('0.050'));
  assert(created.at(-1).stopped);
  element('#timelineSeek').onchange({ target: { value: '.08' } });
  assert(element('#timelineTime').textContent.startsWith('0.080'));
  await transport.playTrack('dry');
  near(created.at(-1).startOffset, .08);
  audio.currentTime += .02;
  transport.stop();
  assert(element('#timelineTime').textContent.startsWith('0.000'));
  element('#timelineSeek').onchange({ target: { value: '.05' } });
  element('#markStart').onclick();
  element('#timelineSeek').onchange({ target: { value: '.15' } });
  element('#markEnd').onclick();
  element('#timelineLoop').checked = true;
  element('#timelineLoop').onchange();
  await transport.playTrack('wet');
  near(created.at(-1).startOffset, .05);
  near(created.at(-1).loopStart, .05); near(created.at(-1).loopEnd, .15);
  audio.currentTime += .16;
  transport.pause();
  assert(element('#timelineTime').textContent.startsWith('0.110'));
  transport.clear();
  assert(!transport.matches('0-0-27', 'pulse'));
  assert(element('#timelineControls').disabled);

  // A selection change during a suspended audio-context resume must discard old data.
  let resolve;
  pendingContext = new Promise(r => { resolve = r; });
  const staleLoad = transport.load(sound, sound, 16000, { id: 'stale', kind: 'pulse', label: 'stale' });
  transport.clear();
  resolve(audio); await staleLoad; pendingContext = null;
  assert(!transport.matches('stale', 'pulse'));
  assert(element('#timelineControls').disabled);

  await transport.load(sound, sound, 16000, { id: 'new', kind: 'pulse', label: 'new' });
  // A late play request must not start after Stop clears its generation.
  pendingContext = new Promise(r => { resolve = r; });
  const count = created.length;
  const delayedPlay = transport.playTrack('wet');
  transport.stop(); resolve(audio); await delayedPlay; pendingContext = null;
  assert.equal(created.length, count);
  assert(transport.matches('new', 'pulse'));
  // Direct interaction replaces duplicated sliders: hover previews without seeking.
  const wave=element('#audioWaveformSurface'),spec=element('#drySpectrumSurface');
  element('#timelineZoom').value=0;transport.redraw();
  const pointer=x=>({clientX:x,pointerId:1,pointerType:'mouse',preventDefault(){}});
  wave.handlers.pointermove(pointer(316)); // halfway across 50..582 => 0.1 s
  flushFrame();
  assert(element('#timelineTime').textContent.startsWith('Preview 0.100'));
  near(+element('#timelineSeek').value,0);
  wave.handlers.pointerleave();
  assert(element('#timelineTime').textContent.startsWith('0.000'));
  wave.handlers.pointerdown(pointer(316));wave.handlers.pointerup(pointer(316));
  near(+element('#timelineSeek').value,.1);
  // Drag keeps a stable axis; both plots share the selected timestamp.
  wave.handlers.pointerdown(pointer(316));wave.handlers.pointermove(pointer(449));
  near(+element('#timelineSeek').value,.15);
  wave.handlers.pointerup(pointer(449));
  spec.handlers.keydown({key:'ArrowLeft',shiftKey:false,preventDefault(){}});
  near(+element('#timelineSeek').value,.146); // 256/4/16000 = .004 s
  await element('#originalSpecPlayDry').onclick();
  near(created.at(-1).startOffset,.146);
  element('#originalSpecPause').onclick();assert(created.at(-1).stopped);
  element('#timelineSeek').onchange({target:{value:'.05'}});
  await element('#roomSpecExcerpt').onclick();
  near(created.at(-1).startOffset,.05);near(created.at(-1).startDuration,.15);
  assert.equal(created.at(-1).loop,false);created.at(-1).onended();
  assert(element('#timelineTime').textContent.startsWith('0.200'));
  transport.clear();assert(element('#roomSpecPause').disabled);
  let prepares=0;prepareLocal=async()=>{prepares++;await transport.load(sound,sound,16000,{id:'local',kind:'voice',label:'local'});return true;};
  await element('#roomSpecPlayWet').onclick();
  assert.equal(prepares,1);assert(transport.matches('local','voice'));
  assert(!element('#roomSpecPause').disabled);near(created.at(-1).startOffset,0);
  transport.clear();const beforeFailedPrepare=created.length;prepareLocal=async()=>false;
  await element('#wavePlayDry').onclick();assert.equal(created.length,beforeFailedPrepare);
  console.log('PASS: transport, direct hover preview/pin/drag, keyboard stepping, excerpts, loops, and stale async cancellation.');
})().catch(error => { console.error(error); process.exitCode = 1; });

