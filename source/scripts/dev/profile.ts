import { getHeight } from '../../src/world/height';
const rows: string[] = [];
for (const z of [-30, -12, 0, 13, 25]) {
  let s = `z=${z}: `;
  for (let x = -40; x <= 40; x += 2.5) s += getHeight(x, z).toFixed(1).padStart(5);
  rows.push(s);
}
console.log(rows.join('\n'));
