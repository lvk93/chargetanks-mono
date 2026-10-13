// st.slider (Streamlit 1.47.0, Slider.tsx + baseui/react-range) auf einem nativen <input type="range">:
// - Anzeige: sprintf("%0.2f") wie im Original-Frontend, Label ueber dem Thumb mit fixLabelOverflow
// - Neuberechnung: Debounce 200 ms (DEBOUNCE_TIME_MS) - auch waehrend des Ziehens
// - Tastatur wie react-range: Pfeile/k/j +-1 Schritt, Bild auf/ab +-10 Schritte, Pos1/Ende ohne Wirkung,
//   neuer Wert immer ueber normalizeValue
// - Negativer Schritt (data-st-step, z. B. SoH in Swelling): react-range rechnet mit dem negativen Schritt;
//   Werte koennen unter min liegen (0.79), der Thumb wird wie getValueAsArray auf [min, max] geklemmt.
//   Zeiger-Eingaben laufen dann ebenfalls ueber normalizeValue statt ueber das native Einrasten.
import { sprintfFixed } from '../core/pyformat.js';

const DEBOUNCE_TIME_MS = 200;
const INCREASE_KEYS = ['ArrowRight', 'ArrowUp', 'k', 'PageUp'];
const DECREASE_KEYS = ['ArrowLeft', 'ArrowDown', 'j', 'PageDown'];

// react-range utils.getStepDecimals
function getStepDecimals(step) {
  const decimals = step.toString().split('.')[1];
  return decimals ? decimals.length : 0;
}

// react-range Range.normalizeValue (allowOverlap ohne Bedeutung bei einem Thumb), Zeichen fuer Zeichen
export function normalizeValue(value, min, max, step) {
  const BIG_NUM = 10e10;
  value = Math.round(value * BIG_NUM) / BIG_NUM;
  if (value > max) return max;
  if (value < min) return min;
  const remainder = Math.floor(value * BIG_NUM - min * BIG_NUM) % Math.floor(step * BIG_NUM);
  const floor = Math.floor(value * BIG_NUM - Math.abs(remainder));
  const rounded = remainder === 0 ? value : floor / BIG_NUM;
  const res = Math.abs(remainder / BIG_NUM) < step / 2 ? rounded : rounded + step;
  const dec = getStepDecimals(step);
  return parseFloat(res.toFixed(dec));
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
  const step = Number(root.dataset.stStep ?? input.step);
  const custom = step < 0;
  let value = Number(input.value);
  let timer = null;

  const show = () => {
    const shown = Math.min(max, Math.max(min, value));
    const fraction = (shown - min) / (max - min);
    area.style.setProperty('--pct', `${fraction * 100}%`);
    // react-range: translate((v-min)/(max-min) * Spurbreite - Thumb/2) in Pixeln (mit Bruchteilen)
    thumb.style.transform = `translate(${fraction * track.getBoundingClientRect().width - thumb.offsetWidth / 2}px, -4px)`;
    const text = sprintfFixed(value, 2);
    label.textContent = text;
    input.setAttribute('aria-valuetext', text);
    fixLabelOverflow(root, thumb, label);
  };

  const change = (next) => {
    value = next;
    input.value = String(next);
    show();
    clearTimeout(timer);
    timer = setTimeout(() => onCommit(value), DEBOUNCE_TIME_MS);
  };

  input.addEventListener('input', () => {
    // step < 0: der Browser rastet nativ auf das positive Raster - Wert kommt nur aus den eigenen Handlern
    if (custom) input.value = String(value);
    else change(Number(input.value));
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      return;
    }
    const sign = INCREASE_KEYS.includes(event.key) ? 1 : DECREASE_KEYS.includes(event.key) ? -1 : 0;
    if (!sign) return;
    event.preventDefault();
    const delta = (event.key.startsWith('Page') ? step * 10 : step) * sign;
    change(normalizeValue(value + delta, min, max, step));
  });

  if (custom) {
    // react-range onMove: Wert aus der Zeigerposition auf der Spur; |v - x| >= step/2 ist bei step < 0 immer wahr
    const fromPointer = (event) => {
      const rect = track.getBoundingClientRect();
      change(normalizeValue(((event.clientX - rect.left) / rect.width) * (max - min) + min, min, max, step));
    };
    input.addEventListener('pointerdown', (event) => {
      // kein preventDefault: Fokus wie bei einem Mausklick (ohne Fokusring)
      if (event.button !== 0) return;
      input.setPointerCapture(event.pointerId);
      fromPointer(event);
      const move = (e) => fromPointer(e);
      const up = () => {
        input.removeEventListener('pointermove', move);
        input.removeEventListener('pointerup', up);
        input.removeEventListener('pointercancel', up);
      };
      input.addEventListener('pointermove', move);
      input.addEventListener('pointerup', up);
      input.addEventListener('pointercancel', up);
    });
  }

  new ResizeObserver(show).observe(root);
  show();
  return {
    get value() {
      return value;
    },
    // Neuaufbau des Widgets mit Default (Streamlit: Widget ohne key verschwindet und kommt neu)
    reset(next) {
      clearTimeout(timer);
      value = next;
      input.value = String(next);
      show();
    },
  };
}
