// Comparisons of the same unit-impulse response: no playback normalization.
export function energyComparison(value, reference) {
  if (!(value > 0) || !(reference > 0)) throw new RangeError('Energy must be positive.');
  const ratio = value / reference;
  return { ratio, percent: ratio * 100, db: 10 * Math.log10(ratio) };
}

export function installStudy({ getData, getCurrent, plot }) {
  const target = document.querySelector('#soundLesson');
  if (!target || document.querySelector('#studyEvidence')) return;
  const section = document.createElement('section');
  section.id = 'studyEvidence';
  section.className = 'study-evidence lesson';
  section.innerHTML = `
    <div class="study-heading"><div><p class="eyebrow">STUDY MODE · CHANGE ONE VARIABLE</p>
    <h2>Does absorption change delay or duration?</h2>
    <p>The reference is <strong>18% absorption at this same seat and lecturer position</strong>. All measurements use the same unit input pulse, before any playback-level matching.</p></div>
    <button id="studyExport" class="secondary">Download this study · CSV</button></div>
    <div id="studyContext" class="study-context"></div>
    <div id="studyMetrics" class="study-metric-grid" aria-live="polite"></div>
    <div id="studyConclusion" class="study-conclusion" aria-live="polite"></div>
    <div class="study-plots">
      <article class="card"><p class="eyebrow">HOW SPREAD OUT · ENERGY TIMING</p><h3>Most energy can arrive in a shorter interval</h3>
      <p class="read-guide">Across: the same absorption settings. Up: time after first arrival needed to collect <strong>90% of each response’s own total energy</strong>. A lower point means most energy is concentrated earlier.</p>
      <canvas id="studyDurationPlot" aria-label="Time containing 90 percent of response energy versus absorption"></canvas>
      <p id="studyTimeConclusion" class="insight"></p>
      <p class="caption">The 90% thresholds refer to different energy totals. They do not show the same quantity of energy travelling faster. This is a descriptive energy statistic, not standardized reverberation time.</p></article>
      <article class="card"><p class="eyebrow">FIRST ARRIVAL · PROPAGATION DELAY</p><h3>The first sound does not arrive sooner</h3><p class="read-guide">Across: surface absorption. Up: time from emission until the direct sound arrives. The horizontal line means the lecturer-to-listener distance remains fixed.</p><canvas id="studyArrivalPlot" aria-label="Direct arrival time versus absorption"></canvas><p class="insight">Absorption changes reflection amplitudes. The direct path still covers the same distance at 343 m/s, so the first-arrival delay is unchanged.</p></article>
    </div>
    <div class="card study-table-card"><h3>Three settings. Everything else held fixed.</h3>
      <div class="study-table-scroll"><table><caption id="studyTableCaption"></caption><thead><tr><th scope="col">Absorption</th><th scope="col">90% energy time</th><th scope="col">Change from Low</th><th scope="col">First arrival</th></tr></thead><tbody id="studyRows"></tbody></table></div>
      <details><summary>How to use this in your project explanation</summary><ol><li><b>Question:</b> What changes when surfaces absorb more?</li><li><b>Control:</b> keep the input pulse, lecturer, seat and room dimensions fixed.</li><li><b>Evidence:</b> report the energy-duration change in ms and whether the first arrival changed.</li><li><b>Interpretation:</b> reflections lose energy; the unchanged direct distance leaves the first arrival unchanged.</li><li><b>Limit:</b> a listening experiment is still needed to claim improved speech understanding.</li></ol></details>
    </div><details id="studyDbDetails" class="card study-db-details"><summary>Optional add-on · how much energy changes in dB</summary>      <article class="card"><p class="eyebrow">HOW MUCH · ENERGY RATIO</p><h3>Decibels with an explicit reference</h3>
      <p class="read-guide">Across: surface absorption. Up: total response energy relative to Low, in dB. <strong>0 dB = the Low reference; −10 dB = one-tenth its energy.</strong> Negative values mean less total energy for this input.</p>
      <canvas id="studyEnergyPlot" aria-label="Response energy change in decibels versus surface absorption"></canvas>
      <div id="studyEnergyCalculation" class="study-formula"></div>
      <p class="caption">E = Σ |h[n]|². This is a ratio of simulated signal energies. It is not sound pressure level (dB SPL), perceived loudness, or a word-understanding score.</p></article>
</details>`;
  target.before(section);
  const find = id => section.querySelector(`#${id}`);
  const signed = (value, digits = 1) => `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
  let lastStudy;
  function render() {
    const data = getData(), current = getCurrent();
    if (!data || !current) return;
    const cases = data.cases.filter(c => c.source === current.source && c.seat === current.seat).sort((a, b) => a.absorption - b.absorption);
    const base = cases.find(c => c.absorption === 0);
    if (!base || cases.length !== data.alphas.length) return;
    const rows = cases.map(c => ({ c, alpha: data.alphas[c.absorption] * 100, ...energyComparison(c.totalEnergy, base.totalEnergy) }));
    const selected = rows.find(row => row.c.id === current.id);
    const dt = current.energy90Ms - base.energy90Ms;
    const rowNumber = Math.floor(current.seat / 5) + 1, seatNumber = current.seat % 5 + 1;
    const context = `Row ${rowNumber}, Seat ${seatNumber} · ${current.source ? 'Front-left' : 'Front-centre'} lecturer · selected absorption ${selected.alpha.toFixed(0)}%`;
    find('studyContext').textContent = context;
    find('studyMetrics').innerHTML = [
      ['90% ENERGY TIME', `${current.energy90Ms.toFixed(1)} ms`, 'Time after first arrival containing 90% of this response’s own energy.'],
      ['ENERGY DURATION CHANGE', `${signed(dt)} ms`, dt < 0 ? '90% of the response energy arrives over a shorter interval.' : dt > 0 ? '90% of the response energy takes a longer interval to arrive.' : 'Same duration as the Low reference.'],
      ['FIRST ARRIVAL', `${current.arrivalMs.toFixed(2)} ms`, 'Measured from emission. Absorption does not change the direct distance.']
    ].map(([title, value, note]) => `<article><span>${title}</span><strong>${value}</strong><p>${note}</p></article>`).join('');
    find('studyConclusion').innerHTML = current.absorption === 0
      ? '<b>You are viewing Low, the reference.</b><p>Select Medium or High above to compare energy duration at the same seat. The sweep below already shows all three settings.</p>'
      : `<b>Result at ${selected.alpha.toFixed(0)}% absorption</b><p>The 90% energy time is <strong>${current.energy90Ms.toFixed(1)} ms</strong>, compared with ${base.energy90Ms.toFixed(1)} ms at Low. The first arrival remains <strong>${current.arrivalMs.toFixed(2)} ms</strong>. ${dt < 0 ? 'Most energy is concentrated earlier; sound is not travelling faster.' : 'The change describes the response’s energy distribution, not sound speed.'}</p>`;
    find('studyEnergyCalculation').innerHTML = `<b>Worked calculation</b><p>10 × log₁₀(Eselected / Elow)<br>= 10 × log₁₀(${selected.ratio.toFixed(4)}) = <strong>${signed(selected.db, 2)} dB</strong></p><small>The energy ratio ${selected.ratio.toFixed(4)} × 100 gives ${selected.percent.toFixed(1)}%. Values displayed are rounded.</small>`;
    const high = rows[rows.length - 1];
    find('studyTimeConclusion').textContent = `Low → High: ${base.energy90Ms.toFixed(1)} → ${high.c.energy90Ms.toFixed(1)} ms. The first-arrival plot stays flat. The response ends up more concentrated in time; the direct sound does not travel faster.`;
    find('studyTableCaption').textContent = 'All values come from the effective 80 Hz high-passed room response. Lines connect three simulated settings; intermediate absorption values were not simulated. The selected setting is highlighted.';
    find('studyRows').innerHTML = rows.map(row => `<tr${row.c.id === current.id ? ' class="study-selected" aria-current="true"' : ''}><th scope="row">${row.alpha.toFixed(0)}%${row.c.id === current.id ? ' · selected' : ''}</th><td>${row.c.energy90Ms.toFixed(1)} ms</td><td>${signed(row.c.energy90Ms-base.energy90Ms)} ms</td><td>${row.c.arrivalMs.toFixed(2)} ms</td></tr>`).join('');
    const lower = Math.min(-5, Math.floor(Math.min(...rows.map(r => r.db)) / 5) * 5);
    const upper = Math.max(0, Math.ceil(Math.max(...rows.map(r => r.db)) / 5) * 5);
    const ticks = []; for (let v = lower; v <= upper; v += 5) ticks.push(v);
    plot('#studyEnergyPlot', [{ points: rows.map(r => [r.alpha, r.db]), color: '#7859b4', width: 2.5 }], { xmin: 18, xmax: 70, ymin: lower, ymax: upper, xticks: [18, 40, 70], yticks: ticks, xlabel: 'Surface absorption (%)', ylabel: 'Energy change vs Low (dB)' });
    plot('#studyDurationPlot', [{ points: rows.map(r => [r.alpha, r.c.energy90Ms]), color: '#136f91', width: 2.5 }], { xmin: 18, xmax: 70, ymin: 0, ymax: 160, xticks: [18, 40, 70], yticks: [0, 40, 80, 120, 160], xlabel: 'Surface absorption (%)', ylabel: '90% energy time (ms)' });
    plot('#studyArrivalPlot', [{ points: rows.map(r => [r.alpha, r.c.arrivalMs]), color: '#d8783e', width: 2.5 }], { xmin: 18, xmax: 70, ymin: 0, ymax: 30, xticks: [18, 40, 70], yticks: [0, 10, 20, 30], xlabel: 'Surface absorption (%)', ylabel: 'First-arrival delay (ms)' });
    lastStudy = { data, current, base, rows };
  }
  find('studyExport').addEventListener('click', () => {
    if (!lastStudy) return;
    const { data, current, base, rows } = lastStudy;
    const headings = ['case_id', 'reference_case_id', 'source_index', 'seat_index', 'absorption_fraction', 'energy_ratio_vs_low', 'energy_change_dB', 'energy_remaining_pct', 'energy90_ms', 'direct_arrival_ms', 'highpass_Hz', 'input'];
    const lines = rows.map(row => [row.c.id, base.id, current.source, current.seat, data.alphas[row.c.absorption], row.ratio, row.db, row.percent, row.c.energy90Ms, row.c.arrivalMs, data.highpassHz, 'unit_impulse']);
    const csv = [headings, ...lines].map(row => row.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `echolab-study-${current.source}-${current.seat}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    find('studyContext').textContent += ' · Study CSV prepared';
  });
  find('studyDbDetails').addEventListener('toggle', () => { if (find('studyDbDetails').open) render(); });
  document.addEventListener('echolab:selection', render);
  window.addEventListener('resize', () => { if (section.getClientRects().length) render(); });
  // Covers installation after data loading as well as the usual before-data path.
  render();
  return { render };
}
