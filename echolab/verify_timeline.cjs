// Code-only numerical tests: no browser or playback device is opened.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, 'dist/app.js'), 'utf8');
const math = fs.readFileSync(path.join(__dirname, 'dist/timeline-math.js'), 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(math.replace(/export /g, ''), ctx);
const fftStart = source.indexOf('function fft(');
const fftEnd = source.indexOf('function spectrum(', fftStart);
assert(fftStart >= 0 && fftEnd > fftStart, 'FFT extraction boundary changed');
vm.runInContext(source.slice(fftStart, fftEnd), ctx);
const near = (actual, expected, tolerance = 1e-9) => assert(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

const state = { offset: 1, started: 10, now: 10.5, duration: 5, loop: false, from: 0, to: 5 };
near(ctx.clockPosition(state), 1.5);
near(ctx.clockPosition({ ...state, now: 30 }), 5);
near(ctx.clockPosition({ ...state, now: 9 }), 1);
near(ctx.clockPosition({ ...state, offset: 1.5, now: 11, loop: true, from: 1, to: 2 }), 1.5);
near(ctx.clockPosition({ ...state, offset: 1.5, now: 14, loop: true, from: 1, to: 2 }), 1.5);
near(ctx.clockPosition({ ...state, offset: 1.5, now: 10.5, loop: true, from: 1, to: 2 }), 1);
assert.deepEqual(Array.from(ctx.visibleRange(.3, 5, 2)), [0, 2]);
assert.deepEqual(Array.from(ctx.visibleRange(4.9, 5, 2)), [3, 5]);
assert.deepEqual(Array.from(ctx.visibleRange(4.9, 5, 0)), [0, 5]);

near(ctx.sampleEnergy([1, -1, .5]), 2.25);
near(ctx.playbackGain([.1, -.1], 2, true), .9);
near(ctx.playbackGain([1], 10000, true), .95); // Peak cap can prevent RMS target.
near(ctx.playbackGain([0, 0], 2, true), 1);
near(ctx.playbackGain([.1, -.1], 2, false), 1);
near(ctx.windowMetrics([1, -1], 4, 0, 4).rms, Math.sqrt(.5)); // Zero padding.
near(ctx.windowMetrics([1, -1], 4, .25, 4).energy, 1);
near(ctx.windowMetrics([1, -1], 4, 1, 4).rms, 0);
near(ctx.plotTime(316,0,600,50,18,[0,2],2),1);
near(ctx.plotTime(-50,0,600,50,18,[1,2],2),1);
near(ctx.plotTime(900,0,600,50,18,[1,2],2),2);

for (const n of [64, 256, 512, 1024]) {
  near(ctx.hannWeight(0,n),0);
  near(ctx.hannWeight(n-1,n),0);
  for(let i=0;i<n;i++) {
    near(ctx.hannWeight(i,n),ctx.hannWeight(n-1-i,n));
    assert(ctx.hannWeight(i,n)>=0 && ctx.hannWeight(i,n)<=1);
  }
  const sampleRate = 16000;
  const tone = Float64Array.from({ length: n * 2 }, (_, k) => .5 * Math.cos(2 * Math.PI * 1000 * k / sampleRate));
  const spectrum = ctx.frameSpectrum(tone, sampleRate, 0, n, ctx.fft);
  const peak = Math.max(...spectrum);
  const index = Array.from(spectrum).indexOf(peak);
  assert.equal(index * sampleRate / n, 1000);
  // A short symmetric Hann window has a small contribution from the negative
  // frequency image. Check exact direct-DFT amplitude, then approximate tone gain.
  let real=0, imaginary=0, weight=0;
  for(let k=0;k<n;k++){
    const w=.5-.5*Math.cos(2*Math.PI*k/(n-1));
    weight+=w;real+=tone[k]*w*Math.cos(2*Math.PI*index*k/n);
    imaginary-=tone[k]*w*Math.sin(2*Math.PI*index*k/n);
  }
  near(peak,20*Math.log10(2*Math.hypot(real,imaginary)/weight),.00001);
  near(peak, 20 * Math.log10(.5), n===64?.003:.001);
  const silence = ctx.frameSpectrum(new Float64Array(n), sampleRate, 0, n, ctx.fft);
  assert(Array.from(silence).every(v => v === -160));
  const dc = ctx.frameSpectrum(new Float64Array(n).fill(.25), sampleRate, 0, n, ctx.fft);
  near(dc[0], 20 * Math.log10(.25), .0001); // DC must not get factor two.
}
console.log('PASS: playback clock/loop wrapping, plot ranges, gain/peak safety, padded RMS, and Hann-window FFT amplitude at all 4 window sizes.');
