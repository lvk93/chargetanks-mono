// Port von ocv_teaching/cell_reconstruction.py (master). Rechenreihenfolge Zeile fuer Zeile wie im
// Original, damit die Gleitkomma-Ergebnisse uebereinstimmen.
import { clip, linspace } from '../core/numpy.js';
import { interp1d } from '../core/scipy.js';
import { columnMax, columnMin } from './materials.js';

// utils.interpolate(xp, yp, x): interp1d linear mit Extrapolation
export function interpolate(xp, yp, x) {
  return interp1d(xp, yp, { fillValue: 'extrapolate' })(x);
}

export class CellOCVReconstruction {
  constructor({ cath, an, npRatio, vMin = 2.5, vMax = 4.2, formationLossAn = 0.0, formationLossCa = 0.0,
    lipRatio = null, bothDirections = false }) {
    this.cath = cath;
    this.an = an;
    this.npRatio = npRatio;
    this.lipRatio = lipRatio === null ? formationLossCa - npRatio * formationLossAn + 1 : lipRatio;
    this.vMin = vMin;
    this.vMax = vMax;
    this.bothDirections = bothDirections;
  }

  alignAnodeCathode(solCath, npRatio = this.npRatio, lipRatio = this.lipRatio) {
    return (lipRatio - solCath) / npRatio;
  }

  // reconstruct_voltage: soc_an = an0 + (an1 - an0) * soc_vec
  reconstructVoltage(an0, cath0, an1, cath1, direction = 'cha', socVec = linspace(0, 1, 400)) {
    const ocvName = `OCV_${direction}`;
    const dAn = an1 - an0;
    const dCath = cath1 - cath0;
    const socAn = Float64Array.from(socVec, (s) => an0 + dAn * s);
    const socCath = Float64Array.from(socVec, (s) => cath0 + dCath * s);
    const vCath = interpolate(this.cath.data.SoL_prac, this.cath.data[ocvName], socCath);
    const vAn = interpolate(this.an.data.SoL_prac, this.an.data[ocvName], socAn);
    const vCell = Float64Array.from(vCath, (v, i) => v - vAn[i]);
    return { vCell, vCath, vAn, socAn, socCath };
  }

  getStoichiometries({ npRatio = this.npRatio, lipRatio = this.lipRatio, vMin = this.vMin, vMax = this.vMax } = {}) {
    const anSol = this.an.data.SoL_prac;
    const cathSol = this.cath.data.SoL_prac;
    const cathMin = columnMin(cathSol);
    const cathMax = columnMax(cathSol);
    // lip_ratio - np_ratio * np.array([an.min, an.max]), dann np.clip
    const window = [lipRatio - npRatio * columnMin(anSol), lipRatio - npRatio * columnMax(anSol)]
      .map((v) => clip(v, cathMin, cathMax));
    const cath0 = npMax(window);
    const cath1 = npMin(window);
    const an0 = this.alignAnodeCathode(cath0, npRatio, lipRatio);
    const an1 = this.alignAnodeCathode(cath1, npRatio, lipRatio);
    const grid = linspace(0, 1, 400);
    const vcDis = this.reconstructVoltage(an0, cath0, an1, cath1, this.bothDirections ? 'dis' : 'cha', grid).vCell;
    const vcCha = this.reconstructVoltage(an0, cath0, an1, cath1, 'cha', grid).vCell;
    const soc0Cut = interpolate(vcDis, grid, vMin);
    const soc1Cut = interpolate(vcCha, grid, vMax);
    // an0_cut = soc0_cut * (an1 - an0) + an0
    const an0Cut = soc0Cut * (an1 - an0) + an0;
    const an1Cut = soc1Cut * (an1 - an0) + an0;
    const cath0Cut = soc0Cut * (cath1 - cath0) + cath0;
    const cath1Cut = soc1Cut * (cath1 - cath0) + cath0;
    return [an0Cut, cath0Cut, an1Cut, cath1Cut];
  }

  simulateAgingModes(lampe, lamne, lli) {
    const npAged = (this.npRatio * (1 - lamne)) / (1 - lampe);
    const lipAged = (this.lipRatio * (1 - lli)) / (1 - lampe);
    return this.getStoichiometries({ npRatio: npAged, lipRatio: lipAged });
  }
}

// ndarray.max()/min() ueber zwei Werte (NaN setzt sich durch wie bei numpy)
function npMax(values) {
  return values.some(Number.isNaN) ? NaN : Math.max(...values);
}

function npMin(values) {
  return values.some(Number.isNaN) ? NaN : Math.min(...values);
}
