# KaTeX-Stil und Schriften (0.16.47, MIT, siehe LICENSE)

`katex.min.css` und `fonts/*.woff2` aus dem npm-Paket `katex@0.16.47`. Im CSS sind nur die woff2-Verweise
behalten (woff/ttf-Dateien liegen nicht im Repo) und `font-display: swap` ergaenzt. Die Formeln selbst setzt
KaTeX beim Build (config/vendor/katex), im Browser laeuft kein JavaScript dafuer. Eingebunden nur auf Seiten
mit `math: true` im Front Matter; die Schriften laden erst, wenn eine Formel sichtbar wird.
