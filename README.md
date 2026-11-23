# EchoLab — A Room Changes Everything

An interactive browser-based lab that teaches signal-processing concepts through classroom acoustics. Built for the DA3021 course.

> **The core question:** move your seat, or treat the room?

🌐 **Live site:** https://charan-435.github.io/MMDP-Project/

---

## Repo layout

```
MMDP-Project/
├── code/            # Website + simulation source
│   ├── index.html
│   ├── app.js
│   ├── *.css / *.js    (timeline, study, spectrogram, workbench)
│   ├── simulate.py     (generates data/)
│   ├── requirements.txt
│   └── start.ps1       (local dev server)
│
├── data/            # Generated acoustic data (committed for GitHub Pages)
│   ├── experiment.json   (all 180 cases + metadata)
│   ├── voice.wav         (synthetic speech sample)
│   └── *.wav             (180 impulse responses)
│
└── docs/            # Presentation materials
    └── (PDF / LaTeX / screenshots)
```

---

## Quick start (local)

```powershell
# 1. Install dependencies (once)
pip install -r code/requirements.txt

# 2. Generate experiment data (~30 seconds)
python code/simulate.py

# 3. Start dev server and open the site
.\code\start.ps1
# → Open http://127.0.0.1:8765/code/ in your browser
```

> Open via HTTP — not by double-clicking `index.html`. The site fetches audio and JSON over HTTP.

---

## The acoustic model

**Room:** 6 × 8 × 3 m shoebox · **Image-source method** (Allen & Berkley 1979) · reflection order 48

| Parameter | Value |
|---|---|
| Seats | 30 (6 rows × 5 columns) at 1.2 m height |
| Lecturer positions | Front-centre [3,1,1.5 m] · Front-left [1,1,1.5 m] |
| Surface absorption (α) | Low 0.18 · Medium 0.40 · High 0.70 |
| Sample rate | 16 000 Hz · Sound speed 343 m/s |

**Output:** 180 impulse responses + metrics (C₅₀, 90% energy time, centroid, D₅₀) in `data/experiment.json`.

**Key modelling choices:** √(1−α) pressure reflection · 1/(4πd) spreading · 4th-order 80 Hz high-pass to remove DC buildup · no furniture, scattering, or air absorption.

---

## Deployment

The site is deployed automatically via **GitHub Actions** on every push to `main`.  
The workflow (`.github/workflows/deploy.yml`) assembles `code/` + `data/` into a single deployable bundle and publishes it to GitHub Pages.

**GitHub Pages must be set to: Settings → Pages → Source → GitHub Actions.**

---

## References

- Allen & Berkley (1979) — image-source method: https://jontalle.web.engr.illinois.edu/Public/AllenBerkley79.pdf
- Bradley et al. (2003) — early reflections and speech: https://pubmed.ncbi.nlm.nih.gov/12822796/
- Pyroomacoustics (reference only): https://pyroomacoustics.readthedocs.io/

Implemented with NumPy, SciPy, Web Audio API, Canvas, and SVG.
