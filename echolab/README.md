# EchoLab

An interactive classroom-acoustics experiment for DA3021. The site is static; Python generates the reproducible numerical data beforehand.

## Run

From the repository root:

```powershell
python echolab/simulate.py
python -m http.server 8765 --bind 127.0.0.1 --directory echolab/dist
```

Open http://127.0.0.1:8765/ in a browser. Do not open index.html directly: data and audio are fetched over HTTP. NumPy and SciPy are the only simulation requirements. Install `echolab/requirements.txt` if needed. The generated WAV assets are ignored by Git and must be regenerated before serving or deploying a new checkout.

## Experiment

- Room: 6 x 8 x 3 metres, point source at 1.5 m and receiver at 1.2 m.
- 30 seats, two lecturer positions, three uniform energy absorption coefficients (0.18, 0.40, 0.70).
- Three-dimensional image-source model through total reflection order 48.
- Signed index q = 2n - p, image position = 2nL + (1-2p)s, order = sum(abs(q)).
- Pressure reflection coefficient = sqrt(1-alpha), distance loss = 1/(4*pi*d), sound speed = 343 m/s.
- Linear fractional-delay deposition at 16 kHz. This approximates delays and introduces frequency-dependent interpolation error.
- A fourth-order causal 80 Hz high-pass filter removes artificial low-frequency buildup caused by positive reflection pulses. All exported responses, C50 measurements and room playback include this filter. This is not a standardized octave-band acoustic measurement.
- C50 uses squared samples in the first 50 ms relative to direct arrival versus all later samples. The floor of the fractional direct-arrival index defines the onset (less than one-sample quantization).

## Validation

`simulate.py` checks direct arrival, free-field spreading, six first-order images, unit-impulse convolution, and C50 convergence at 18 representative source/seat/absorption combinations. It compares orders 32, 48 and 64 and requires the 48-to-64 change to be below 0.15 dB. These are numerical tests, not experimental validation against a measured room.

Latest checks are in `validation.json`; the website reads the same checks from `dist/data/experiment.json`.

## Audio

The default `dist/data/voice.wav` is labelled synthetic Windows speech. It was generated locally with System.Speech; it is not the student's recording. A missing default recording produces an explicit message and users can select diagnostic clicks or a local audio file instead.

To regenerate the synthetic sample on Windows:

```powershell
Add-Type -AssemblyName System.Speech
$echoVoice = New-Object System.Speech.Synthesis.SpeechSynthesizer
$echoVoice.SetOutputToWaveFile((Join-Path (Get-Location) 'echolab/dist/data/voice.wav'))
$echoVoice.Speak('A classroom changes the sound we hear. Speech reaches us directly, and also reflects from the walls, floor, and ceiling. In this experiment, we explore how changing our position and the room absorption changes the received sound.')
$echoVoice.Dispose()
```

The website decodes user-selected files locally, mixes channels to mono and limits playback to 20 seconds. Web Audio convolution uses normalize=false to retain physical model gain. Optional RMS matching uses a common target with a peak safety cap; it does not preserve absolute level differences. The diagnostic clicks reveal tail structure but cannot be used for speech-intelligibility claims.

Spectrograms show the first eight seconds, use a 512-point Hann window with 128-sample hop (32 ms and 8 ms at 16 kHz), and share a colour reference. Received audio is aligned by direct-arrival time and RMS-scaled for visual comparison. Labels describe energy bins and spectra, not inferred human understanding.

## Contribution and limits

The image-source method is established. The project contribution is the interactive comparison, controlled experiment, numerical checking and explanation. No furniture, scattering, directionality, air absorption, background noise or binaural hearing is modelled. Surface settings are assumed coefficients, not calibrated material presets. A changed C50 does not establish a perceptible difference or increased comprehension.

The initial implementation showed that constant positive reflection pulses create low-frequency buildup; the explicit high-pass correction and its effect on results are part of the model record. The original unconditioned results should not be mixed with the final exported data.

## Sources and assistance

- Allen and Berkley (1979), https://jontalle.web.engr.illinois.edu/Public/AllenBerkley79.pdf
- Bradley et al. (2003), https://pubmed.ncbi.nlm.nih.gov/12822796/
- Pyroomacoustics documentation, https://pyroomacoustics.readthedocs.io/en/stable/pyroomacoustics.room.html (reference, not installed or used by this implementation)
- Implementation: NumPy, SciPy, HTML, CSS, Canvas, SVG and Web Audio.
- AI assistance: implementation, mathematical explanation, literature lookup and test design. Student reflections must come from the student's actual experience.

Course lab upgrade: the Explore page now derives cumulative energy, adjustable C-tau, energy centroid, normalized pressure waveform and full-response Fourier magnitude from the playback WAV. Centre-column C50 curves isolate absorption and receiver row. Explanations distinguish acoustic ratios from comprehension, energy centroid from reverberation time, and FFT bin spacing from physical resolving power. STFT supports 256/512/1024-sample Hann windows with 75% overlap. The guided experiment saves a low-absorption baseline for controlled comparison.

## Course-first learning flow

The main website now teaches sampling, time shift, impulse response, convolution,
discrete signal energy, Fourier magnitude, decibels, waveform analysis, RMS and STFT.
A three-sample convolution example exposes the actual multiplication and addition
for each selected output sample. Charts include axis-reading instructions and
interpretations tied to the selected room configuration.

The 90% energy time is an explicitly labelled descriptive application of cumulative
signal energy, not a claimed syllabus metric or a standardized reverberation time.
Its clock begins at the floored direct-arrival sample. Delay instead begins at
emission. `simulate.py` exports `energy90Ms`, `centroidMs`, and `totalEnergy` alongside
the original acoustic data. C50 and D50 are kept in an optional extension.

Generate plots without playback using the audio lab button. Spectrograms show all
positive-frequency FFT bins (excluding Nyquist) for each selected Hann window.
Waveform and spectrogram comparisons remove the nearest integer direct delay and
match energy over a common zero-padded duration, equivalent to matching RMS over
that duration. Playback matching uses each complete playback buffer's RMS and a
peak cap; it is a listening aid, not a calibrated perceived-loudness comparison.

Code-only checks (neither launches a browser):

```powershell
python echolab/verify.py
node echolab/verify_frontend.cjs
```

These verify all 180 exported energy summaries, FFT/STFT known-frequency behaviour,
the small convolution examples, map ranges and referenced UI IDs. They do not
replace a visual or audio review in a browser.

## Synchronized audio study workbench

The audio lab now prepares the whole selected clip (up to 20 seconds of input plus
the response tail). Original and room output are padded to a common duration.
Room audio is aligned by removing the rounded direct-arrival delay for synchronized
listening; saved comparisons retain physical propagation delay. This distinction
is disclosed in the UI. The timeline uses the AudioContext clock, not an interval
counter. Hardware output latency can still cause a small audible/visual offset.

Controls include play/pause, track switching, a time scrubber, click-to-seek,
full/2-second/0.5-second plot zoom, one-hop stepping, and a repeat interval with a
20 ms minimum. The pink cursor and shaded STFT window are shared by the waveform
and both spectrograms. A selected-window inspector shows samples, windowed FFT,
and optional RMS/dBFS values, with a spectrum CSV export. Both plots and listening
use the RMS matching setting, with a common duration and a 0.95 peak cap. Display
waveforms additionally divide by a shared peak; this does not change audio gain.

The time-first study section plots energy duration and direct-arrival delay across
all three absorption values with a table and CSV export. Energy ratios in dB are
an optional add-on, always relative to Low at the same seat and source. No claims
about real-world comprehension are inferred from these plots.

Additional code-only checks:

```powershell
node echolab/verify_study.cjs
node echolab/verify_timeline.cjs
```

Browser previews are intentionally left to the user. Code checks cannot establish
visual layout quality or actual device playback synchronization.

Transport lifecycle regression checks (mock audio/DOM, no browser):

```powershell
node echolab/verify_transport.cjs
```

Includes pause/seek offsets, loop wrap, stop/reset, and cancellation of stale
asynchronous audio loads or play requests after settings change.

## Plot-local listening and course-linked spectrogram reading

Every audio plot now has nearby playback, pause, seek and excerpt controls. Play
prepares the selected recording automatically at that location. Controls share a
single player and time cursor, preventing overlapping audio. The waveform and
both spectrograms offer local time zoom; the selected-sample and selected-FFT
plots instead offer a local analysis-window selector. A 0.3 s excerpt is clipped
at the recording end and ignores the full-interval loop setting. Advanced loop
and frame-step controls are in a collapsed panel.

Original and Room spectrograms have separate panels. The reading guide links to
https://spinlabiitg.github.io/sap/speech/spectrogram.html and distinguishes harmonics,
formant regions, noise/bursts and window effects. It is a reading guide, not an
automatic speech classifier. The selected-window conclusion uses only measured
RMS and the explicit near-silence threshold; it cannot identify words or establish
intelligibility. The 4 ms (64-sample) option adds a short-window timing view.

Code-only checks also cover automatic plot-local preparation, all linked sliders,
local window versus viewport controls, excerpt boundaries and near-silence
explanations. Run `node echolab/verify_spectrogram_guide.cjs` for the latter.
Screen-reader status updates are centralized; continuously changing timestamp
outputs are marked aria-live=off.
