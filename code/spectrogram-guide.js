// Course-reading cues are deliberately separate from measurements of this clip.
export function explainSpectrogramSlice({time=0, windowMs=32, kind='voice', originalRms, roomRms} = {}) {
  if (![time, windowMs, originalRms, roomRms].every(Number.isFinite) || originalRms < 0 || roomRms < 0) {
    return {title:'Prepare a sound to inspect its results', result:'No audio window is selected yet.', meaning:'The guide below describes patterns to look for; it has not identified anything in your recording.', next:'Use Play beside a plot, then pause and click or drag directly on the plot to select a moment.'};
  }
  const limit=1e-7, dryQuiet=originalRms<limit, wetQuiet=roomRms<limit;
  const stamp=`${time.toFixed(3)}–${(time+windowMs/1000).toFixed(3)} s`;
  let title, result, meaning;
  if(dryQuiet && wetQuiet){
    title='This slice is near-silent in both tracks';
    result=`At ${stamp}, both RMS values are below our near-silence threshold.`;
    meaning='There is little signal to interpret here. A dark area is not evidence of a particular consonant or a better room.';
  } else if(dryQuiet && !wetQuiet){
    title='The room output continues into this pause';
    result=`At ${stamp}, the original is near-silent, while the room output remains above the same threshold.`;
    meaning='This is evidence of a response tail at this moment. Compare its extent over time; it does not tell us how many words a listener understands.';
  } else if(!dryQuiet && wetQuiet){
    title='The original has signal; the room slice is near-silent';
    result=`At ${stamp}, only the original exceeds the near-silence threshold.`;
    meaning='The selected output window is weaker at the current gain. Inspect neighbouring windows before drawing a conclusion about the whole recording.';
  } else {
    title='Both tracks contain signal in this slice';
    result=`At ${stamp}, both RMS values exceed the near-silence threshold.`;
    meaning='Compare the pattern at the same time and frequency. Colour alone cannot identify a phoneme or establish which recording is easier to understand.';
  }
  const next=kind==='pulse'
    ? 'For diagnostic clicks, inspect just after 0.315 s: the first input pulse has ended. Look for a longer patch in the room plot. These are brief 1.3 kHz tones, not speech.'
    : 'For speech, pause on a sustained vowel and look for repeated horizontal lines. Then inspect a hiss or a pause. Use your ears to locate the sound; these plots do not automatically label words or phonemes.';
  return {title,result,meaning,next};
}

export function installSpectrogramGuide() {
  const spectra=document.querySelector('#spectrograms');
  if(!spectra) return {update(){},clear(){}};
  const section=document.createElement('section');
  section.id='spectrogramReading';section.className='spectrogram-reading';
  section.innerHTML=`<div class="spectrogram-result"><p class="eyebrow">EXPLAIN THIS MOMENT</p><h3 id="spectrogramResultTitle"></h3><p id="spectrogramResult"></p><p id="spectrogramMeaning"></p><p id="spectrogramNext" class="spectrogram-next"></p><details><summary>What is this conclusion based on?</summary><p>Only the selected window’s RMS values, using a near-silence threshold of 0.0000001. This is a numerical display threshold, not a hearing threshold. Measurements include the current listening gain. We do not automatically estimate pitch, formants or phonemes.</p></details></div>
  <details class="spectrogram-patterns" open><summary>Learn to read the patterns · course connection</summary><div class="pattern-grid">
    <div><b>Parallel horizontal lines → harmonics</b><p>Regularly spaced lines suggest periodic vibration. Their spacing relates to fundamental frequency; the lowest bright line is not always the fundamental.</p></div>
    <div><b>Broad strong bands → formant regions</b><p>Formants are vocal-tract resonances. They shape which harmonics are stronger; a formant is not simply every horizontal line.</p></div>
    <div><b>Fuzzy energy → noise-like sound</b><p>Fricatives such as a hiss can spread energy across many frequencies. A short vertical splash can mark a brief burst.</p></div>
    <div><b>Change the window → change the view</b><p>Short windows sharpen timing; long windows reveal closer frequency components. Hann tapering reduces leakage. Darker pixels can mean energy fell below the chosen colour range, not absolute silence.</p></div>
  </div><p class="caption">Reading cues, not automatic diagnoses. Based on the course’s <a href="https://spinlabiitg.github.io/sap/speech/spectrogram.html" target="_blank" rel="noopener">Seeing sound: the spectrogram</a> module.</p></details>
  <details class="spectrogram-patterns"><summary>How to compare Original and Room fairly</summary><ol><li><b>Keep the same sound and window setting.</b> Changing a window can change the apparent time spread even when the recording is unchanged.</li><li><b>Find an ending or pause.</b> Inspect the room plot at that same moment. A tail extending after the original is the feature this experiment investigates.</li><li><b>Use the shared colour bar.</b> Listening-level matching can change brightness. It does not change the simulated impulse-response timing reported above.</li><li><b>State a limited conclusion.</b> Say “the output retains energy into this pause,” when the selected data supports it—not “speech is clearer” just because a plot looks cleaner.</li></ol></details>`;
  // Outside the hidden plots so reading help is available before preparation.
  const mount=document.querySelector('#spectrogramGuideMount');
  if(mount)mount.append(section);else spectra.after(section);
  const find=id=>section.querySelector('#'+id);
  function update(input){
    const text=explainSpectrogramSlice(input);
    find('spectrogramResultTitle').textContent=text.title;
    find('spectrogramResult').textContent=text.result;
    find('spectrogramMeaning').textContent=text.meaning;
    find('spectrogramNext').textContent=text.next;
  }
  function clear(){update();}
  clear();
  return {update,clear};
}
