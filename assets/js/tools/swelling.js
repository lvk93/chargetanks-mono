// Swelling-Tool (Port von apps/swelling_demo.py): Silicon/NMC fest; buildSwelling rechnen, Diagramme zeigen.
// "Cylindrical?" blendet Compression aus; da der Regler im Original keinen key hat, kommt er beim Abwaehlen
// mit 0 zurueck (B3, beibehalten).
import { buildSwelling, createSwellingModel } from '../model/swelling.js';
import { loadMaterial } from '../ui/data.js';
import { initTool } from '../ui/tool.js';

const compressionControl = document.querySelector('[data-control="compression"]');
let modelPromise = null;

// B7: Bei SoH nahe 1 ist die SEI-Schicht (fast) null, ihr Label laege dann auf "Anode Particles".
// Dicke bei SoC 0.5 aus den Label-Positionen: y(SEI) = Dead + SEI/2, y(Dead) = Dead/2.
function withoutEmptySeiLabel(fig) {
  const { annotations } = fig.layout;
  const dead = annotations.find((a) => a.text === 'Dead volume (CCs + Sep)');
  const sei = annotations.find((a) => a.text === 'SEI');
  if (!dead || !sei || 2 * (sei.y - 2 * dead.y) >= 0.03) return fig;
  return { ...fig, layout: { ...fig.layout, annotations: annotations.filter((a) => a !== sei) } };
}

initTool({
  async compute(s) {
    modelPromise ??= Promise.all([loadMaterial('Silicon'), loadMaterial('NMC')])
      .then(([anode, cathode]) => createSwellingModel(anode, cathode));
    const model = await modelPromise;
    return buildSwelling({ model, soc: s.soc, soh: s.soh, compression: s.cylindrical ? null : s.compression,
      cylindrical: s.cylindrical });
  },
  render(r, charts) {
    charts.layers.update(r.figLayers);
    charts.classes.update(withoutEmptySeiLabel(r.figClasses));
    charts.compression.update(r.figCompression);
  },
  onInput(event, controls) {
    const cylindrical = document.getElementById('cylindrical');
    if (event?.target === cylindrical && !cylindrical.checked) controls.set('compression', 0);
    compressionControl.hidden = cylindrical.checked;
  },
});
