"""Verify exported assets independently of the simulator's in-memory arrays."""
import json
from pathlib import Path
import numpy as np
from scipy.io import wavfile

root = Path(__file__).resolve().parent / '..' / 'docs' / 'data'
d = json.loads((root / 'experiment.json').read_text())
assert len(d['cases']) == 180
assert len({c['id'] for c in d['cases']}) == 180
worst = 0.
for c in d['cases']:
    fs, h = wavfile.read(root / (c['id'] + '.wav'))
    assert fs == d['fs'] and np.isfinite(h).all()
    h = h.astype(np.float64)
    start = int(np.floor(c['arrivalMs'] / 1000 * fs))
    split = start + int(.05 * fs)
    e, l = np.sum(h[start:split] ** 2), np.sum(h[split:] ** 2)
    actual = 10 * np.log10(e / l)
    worst = max(worst, abs(actual - c['c50']))
    assert abs(actual - c['c50']) < 1e-4
    assert abs(100 * e / (e + l) - c['earlyPercent']) < 1e-4
    assert 0 < c['earlyPercent'] < 100
    energy = h[start:] ** 2
    cumulative = np.cumsum(energy)
    crossing = int(round(c['energy90Ms'] / 1000 * fs))
    assert cumulative[crossing] >= .9 * cumulative[-1]
    assert crossing == 0 or cumulative[crossing - 1] < .9 * cumulative[-1]
    assert np.isclose(c['totalEnergy'], cumulative[-1], rtol=1e-6)
    assert 0 <= c['energy90Ms'] <= 160, 'Map scale would clip this case'
    assert c['arrivalMs'] <= 30, 'Arrival map scale would clip this case'
assert d['validation']['passed']
assert d['validation']['maxDeltaDb'] < d['validation']['toleranceDb']
print(f'PASS: 180 exported WAV files independently reproduce C50 and energy splits. Max C50 error {worst:.8f} dB.')
print('PASS: all 180 energy-duration thresholds and total energies match exported WAVs; map scales cover all values.')


