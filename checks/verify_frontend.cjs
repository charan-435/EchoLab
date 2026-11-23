// Numerical tests only. This script never opens or controls a browser.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'dist', 'app.js'), 'utf8');
const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
let windowSize = 512;
const context = { $: () => ({ value: windowSize }) };
vm.createContext(context);
vm.runInContext(extract('function fft(', 'let lastSpectra;'), context);
vm.runInContext(extract('function toySignals(', 'function renderToy('), context);
for (const size of [64, 256, 512, 1024]) {
  let re = new Float64Array(size), im = new Float64Array(size);
  re[0] = 1;
  context.fft(re, im);
  assert(re.every(v => Math.abs(v - 1) < 1e-10));
  re = Float64Array.from({ length: size }, (_, i) => Math.cos(2 * Math.PI * 8 * i / size));
  im.fill(0); context.fft(re, im);
  assert(Math.abs(re[8] - size / 2) < 1e-8);
  windowSize = size;
  const signal = Float64Array.from({ length: 16000 }, (_, i) => Math.sin(2 * Math.PI * 1000 * i / 16000));
  const spectrum = context.spectrum(signal, 16000, 1);
  const firstFrame = Array.from(spectrum.data.slice(0, spectrum.rows));
  const peakBin = firstFrame.indexOf(Math.max(...firstFrame));
  assert.equal(peakBin * 16000 / size, 1000);
  assert.equal(spectrum.frames, Math.floor(16000 / (size / 4)));
}
assert.deepEqual(Array.from(context.toySignals(2, .5).y), [1, .5, 0, .25, -.25]);
assert.deepEqual(Array.from(context.toySignals(3, 0).y), [1, .5, -.5, 0, 0, 0]);
assert.deepEqual(Array.from(context.toySignals(1, 1).y), [1, 1.5, 0, -.5]);
const html = fs.readFileSync(path.join(__dirname, '..', 'dist/index.html'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML IDs');
const plotStart=html.indexOf('id="workbenchPlots"');
const notesStart=html.indexOf('id="audioExplanations"');
assert(plotStart>0 && notesStart>plotStart);
assert(html.indexOf('id="stftWindow"')<plotStart, 'Window control must precede plots');
assert(html.indexOf('id="windowExplanation"')>notesStart, 'Settings explanation belongs after plots');
assert(!html.slice(plotStart,notesStart).includes('class="read-guide"'), 'No prose interrupting the plot group');
const timeline=fs.readFileSync(path.join(__dirname,'dist/timeline.js'),'utf8');
assert(!timeline.includes('type="range"'), 'Audio time is selected on the plots, not repeated sliders');
for (const match of source.matchAll(/\$\(['"]#([\w-]+)['"]\)/g)) {
  assert(ids.includes(match[1]), `Missing control #${match[1]}`);
}
const modules = ['timeline.js', 'study.js', 'spectrogram-guide.js'].map(name => fs.readFileSync(path.join(__dirname, 'dist', name), 'utf8'));
const combinedMarkup = [html, ...modules].join('\n');
const available = new Set([...combinedMarkup.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
for (const code of modules) for (const match of code.matchAll(/\$\(['"]#([\w-]+)['"]\)/g)) {
  assert(available.has(match[1]), `Missing generated control #${match[1]}`);
}
console.log('PASS: FFT and STFT known-tone checks at all 4 window sizes; worked convolution examples; control IDs.');

