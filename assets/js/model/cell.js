// Port der Rechnung aus apps/cell_tanks.py (ocv_teaching@master): beide Figures eines Reruns.
import { CellOCVReconstruction } from './cellReconstruction.js';
import { BatteryTankPlotter } from './tankPlotter.js';

export function buildCell({ anode, cathode, soc, vMin, vMax, npRatio, lipRatio }) {
  const cell = new CellOCVReconstruction({ cath: cathode, an: anode, npRatio, lipRatio, vMin, vMax });
  const plotter = new BatteryTankPlotter(cell, 400);

  const figDqdv = plotter.setupTankCanvas(500, 650);
  const figVoltage = plotter.setupVoltageCanvas(500, 650);
  plotter.plotTanks(figDqdv);
  const dV = plotter.fillTanks(figDqdv, soc);
  plotter.addReferenceVoltageLines(figDqdv);
  plotter.plotVoltageVsSoc(figVoltage);
  plotter.plotVoltagePoint(figVoltage, soc, dV);
  return { figDqdv, figVoltage, dV };
}
