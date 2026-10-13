// st.image mit Element-Werkzeugleiste (Streamlit 1.47.0, ElementFullscreen/Toolbar):
// Button "Fullscreen" -> Rahmen fuellt den Viewport (Body ohne Scrollen), "Close fullscreen" oder Escape beendet.
const ENTER_PATH = 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z';
const EXIT_PATH = 'M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z';

let openFrame = null;

function setFullscreen(frame, on) {
  const button = frame.querySelector('.st-toolbar-button');
  frame.classList.toggle('is-fullscreen', on);
  button.setAttribute('aria-label', on ? 'Close fullscreen' : 'Fullscreen');
  button.querySelector('path:last-child').setAttribute('d', on ? EXIT_PATH : ENTER_PATH);
  document.body.style.overflow = on ? 'hidden' : '';
  button.blur(); // Original: Werkzeugleiste wird beim Umschalten neu aufgebaut, der Fokus geht verloren
  openFrame = on ? frame : null;
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && openFrame) setFullscreen(openFrame, false);
});

export function initImage(frame) {
  frame.querySelector('.st-toolbar-button').addEventListener('click', () => {
    const on = !frame.classList.contains('is-fullscreen');
    if (on && openFrame) setFullscreen(openFrame, false);
    setFullscreen(frame, on);
  });
}
