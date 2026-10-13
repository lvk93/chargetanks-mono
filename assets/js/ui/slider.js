// st.slider (Streamlit 1.47.0, Slider.tsx + baseui/react-range) auf einem nativen <input type="range">:
// - Anzeige: sprintf("%0.2f") wie im Original-Frontend, Label ueber dem Thumb mit fixLabelOverflow
// - Neuberechnung: Debounce 200 ms (DEBOUNCE_TIME_MS) - auch waehrend des Ziehens
// - Tastatur wie gemessen: Pfeile +-1 Schritt, Bild auf/ab +-10 Schritte, Pos1/Ende ohne Wirkung
import { sprintfFixed } from '../core/pyformat.js';

const DEBOUNCE_TIME_MS = 200;

function decimals(step) {
  const text = String(step);
  return text.includes('.') ? text.split('.')[1].length : 0;
}

// Streamlit: Label links/rechts buendig am Thumb, wenn es zentriert aus dem Slider ragen wuerde
function fixLabelOverflow(slider, thumb, label) {
  label.style.left = '';
  label.style.right = '';
  const sliderRect = slider.getBoundingClientRect();
  const thumbRect = thumb.getBoundingClientRect();
  const labelRect = label.getBoundingClientRect();
  const mid = thumbRect.left + thumbRect.width / 2;
  label.style.left = mid - labelRect.width / 2 < sliderRect.left ? '0' : '';
  label.style.right = mid + labelRect.width / 2 > sliderRect.right ? '0' : '';
}

export function initSlider(root, onCommit) {
  const input = root.querySelector('input[type="range"]');
  const area = root.querySelector('.st-slider-track-area');
  const thumb = root.querySelector('.st-slider-thumb');
  const track = root.querySelector('.st-slider-track');
  const label = root.querySelector('.st-slider-value');
  const min = Number(input.min);
  const max = Number(input.max);
  const step = Number(input.step);
  const digits = decimals(input.step);
  let timer = null;

  const show = () => {
    const value = Number(input.value);
    const fraction = (value - min) / (max - min);
    area.style.setProperty('--pct', `${fraction * 100}%`);
    // react-range: translate((v-min)/(max-min) * Spurbreite - Thumb/2) in Pixeln (mit Bruchteilen)
    thumb.style.transform = `translate(${fraction * track.getBoundingClientRect().width - thumb.offsetWidth / 2}px, -4px)`;
    const text = sprintfFixed(value, 2);
    label.textContent = text;
    input.setAttribute('aria-valuetext', text);
    fixLabelOverflow(root, thumb, label);
  };

  input.addEventListener('input', () => {
    show();
    clearTimeout(timer);
    timer = setTimeout(() => onCommit(Number(input.value)), DEBOUNCE_TIME_MS);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      return;
    }
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      const delta = (event.key === 'PageUp' ? 10 : -10) * step;
      const next = Math.min(max, Math.max(min, Number(input.value) + delta));
      input.value = String(parseFloat(next.toFixed(digits)));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  new ResizeObserver(show).observe(root);
  show();
  return {
    get value() {
      return Number(input.value);
    },
  };
}
