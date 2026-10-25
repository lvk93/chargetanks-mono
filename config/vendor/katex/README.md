# KaTeX 0.16.47 (nur fuer den Build)

`katex.mjs` aus dem npm-Paket `katex` (MIT, siehe LICENSE), unveraendert kopiert. Eleventy rendert damit
LaTeX im Template (`{% math %}…{% endmath %}`, `{% mi %}…{% endmi %}`) beim Build zu MathML. Im Browser laeuft kein
KaTeX, es werden keine Schriften oder Stylesheets ausgeliefert; die Formeln zeichnet der Browser selbst.

Liegt im Repo statt in `package.json`, weil die Paketinstallation in den Claude-Sessions gesperrt war.
Kann jederzeit durch `npm install -D katex` und `import katex from 'katex'` ersetzt werden.
