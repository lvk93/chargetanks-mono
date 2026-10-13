// pandas Index.get_indexer([target], method="nearest") fuer einen aufsteigenden Float-Index.
// Referenz: pandas 2.3.3, core/indexes/base.py _get_nearest_indexer:
//   left = pad (letzter Wert <= target, sonst -1), right = backfill (erster Wert >= target, sonst -1);
//   Abstaende |index[i] - target| (Index -1 greift wie numpy auf das letzte Element zu);
//   links nur bei strikt kleinerem Abstand (operator.lt bei monoton steigendem Index) oder right == -1.
export function getIndexerNearest(index, target) {
  const n = index.length;
  let left = -1;
  let right = -1;
  for (let i = 0; i < n; i += 1) {
    if (index[i] <= target) left = i;
    if (right === -1 && index[i] >= target) right = i;
  }
  const at = (i) => index[i < 0 ? n + i : i];
  const leftDistance = Math.abs(at(left) - target);
  const rightDistance = Math.abs(at(right) - target);
  return leftDistance < rightDistance || right === -1 ? left : right;
}
