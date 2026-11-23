// Pure calculation tests; never launches a browser.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../dist/study.js'), 'utf8');
const context = {};
vm.createContext(context);
vm.runInContext(source.slice(0, source.indexOf('export function installStudy')).replace('export function', 'function'), context);
assert.equal(context.energyComparison(1, 1).db, 0);
assert.equal(context.energyComparison(.1, 1).db, -10);
assert.equal(context.energyComparison(10, 1).db, 10);
assert.equal(context.energyComparison(.5, 1).percent, 50);
assert.throws(() => context.energyComparison(0, 1));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../dist/data/experiment.json'), 'utf8'));
for (const current of data.cases) {
  const base = data.cases.find(c => c.source === current.source && c.seat === current.seat && c.absorption === 0);
  const result = context.energyComparison(current.totalEnergy, base.totalEnergy);
  assert(Number.isFinite(result.db));
  assert(Math.abs(10 ** (result.db / 10) - result.ratio) < 1e-10);
  assert.equal(current.arrivalMs, base.arrivalMs);
}
console.log('PASS: dB/energy conversions and same-seat reference integrity for 180 cases.');

