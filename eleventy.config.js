// Eleventy: baut die Seiten aus src/ nach _site/. Rechenkern, Tool-Skripte, Daten und Bilder werden
// unveraendert kopiert (Passthrough), Plotly kommt aus node_modules (Version im Dateinamen).
import { readFileSync } from 'node:fs';
import { structuredData } from './config/structuredData.js';
import katex from './config/vendor/katex/katex.mjs';

const plotlyVersion = JSON.parse(readFileSync('node_modules/plotly.js-basic-dist-min/package.json', 'utf8')).version;
const plotlyScript = `/assets/vendor/plotly-basic-${plotlyVersion}.min.js`;

const DATE_FORMATS = {
  short: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
  long: new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
};

// Anker-IDs wie github-slugger (rehype-slug im Original): klein, Satzzeichen weg, Leerzeichen -> "-"
function githubSlug(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '').replace(/ /g, '-');
}

function markdownTweaks(md) {
  // Ueberschriften im Markdown bekommen IDs (Duplikate: -1, -2 ...)
  md.core.ruler.push('heading_ids', (state) => {
    const seen = new Map();
    state.tokens.forEach((token, i) => {
      if (token.type !== 'heading_open' || token.attrGet('id')) return;
      const text = state.tokens[i + 1].children
        .filter((t) => t.type === 'text' || t.type === 'code_inline').map((t) => t.content).join('');
      const base = githubSlug(text);
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      token.attrSet('id', count ? `${base}-${count}` : base);
    });
  });
  // Bilder spaet laden; externe Links in neuem Tab
  const renderImage = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    tokens[idx].attrSet('loading', 'lazy');
    tokens[idx].attrSet('decoding', 'async');
    return renderImage(tokens, idx, options, env, self);
  };
  const renderLinkOpen = md.renderer.rules.link_open ?? ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    if (/^https?:\/\//.test(tokens[idx].attrGet('href') ?? '')) {
      tokens[idx].attrSet('target', '_blank');
      tokens[idx].attrSet('rel', 'noopener noreferrer');
    }
    return renderLinkOpen(tokens, idx, options, env, self);
  };
}

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy('assets');
  eleventyConfig.addPassthroughCopy('images');
  eleventyConfig.addPassthroughCopy({ 'node_modules/plotly.js-basic-dist-min/plotly-basic.min.js': plotlyScript.slice(1) });
  for (const file of ['favicon.svg', 'site.webmanifest', 'robots.txt', '_headers', '_redirects']) {
    eleventyConfig.addPassthroughCopy(file);
  }

  eleventyConfig.addGlobalData('plotlyScript', plotlyScript);
  eleventyConfig.addGlobalData('buildYear', new Date().getUTCFullYear());

  eleventyConfig.amendLibrary('md', markdownTweaks);

  eleventyConfig.addFilter('readableDate', (date, style = 'short') => DATE_FORMATS[style].format(new Date(date)));
  eleventyConfig.addFilter('isoDate', (date) => new Date(date).toISOString().slice(0, 10));
  eleventyConfig.addFilter('isoDateTime', (date) => new Date(date).toISOString());
  // "<" maskiert, damit kein Text das umgebende <script> beenden kann
  eleventyConfig.addFilter('structuredData', (options) => JSON.stringify(structuredData(options)).replace(/</g, '\\u003c'));
  eleventyConfig.addFilter('head', (items, n) => items.slice(0, n));
  eleventyConfig.addFilter('fixed', (value, decimals = 2) => Number(value).toFixed(decimals));
  eleventyConfig.addFilter('bySlug', (items, slug) => items.find((item) => item.slug === slug));
  eleventyConfig.addFilter('hasSecondaryControls', (groups) => groups.some((g) => g.items.some((c) => !c.primary)));

  // LaTeX -> MathML beim Build (KaTeX, siehe config/vendor/katex/README.md). Fehler brechen den Build ab.
  // KaTeX schreibt Betragsstriche als U+2223 (Teiler); Chrome streckt das nicht. Deshalb ein dehnbares "|".
  const tex = (source, displayMode) => katex
    .renderToString(source.trim(), { displayMode, output: 'mathml', throwOnError: true })
    .replaceAll('<mo fence="true">∣</mo>', '<mo fence="true" stretchy="true" symmetric="true">|</mo>');
  eleventyConfig.addPairedShortcode('math', (content) => tex(content, true));
  eleventyConfig.addPairedShortcode('mi', (content) => tex(content, false));

  return {
    dir: { input: 'src', output: '_site', includes: '_includes', data: '_data' },
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
  };
}
