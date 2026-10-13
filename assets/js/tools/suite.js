// Landing der Suite (Port von apps/landing.py): statisch; nur die Vollbild-Werkzeugleiste der Vorschaubilder.
import { initImage } from '../ui/image.js';

for (const frame of document.querySelectorAll('[data-st-image]')) initImage(frame);
