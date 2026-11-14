import { VILLAGE_DEFS, TARO_FIELDS, FACILITIES } from '../../src/world/layout';
import { getHeight } from '../../src/world/height';
import fs from 'node:fs';
const file = 'public/data/places.json';
const j = JSON.parse(fs.readFileSync(file, 'utf8'));
const P = j.places;
const r1 = (n: number) => Math.round(n * 10) / 10;
for (const v of VILLAGE_DEFS) { P[v.id].x = r1(v.cx); P[v.id].z = r1(v.cz); }
for (const f of TARO_FIELDS) {
  const u = (f.tiers * f.cellU) / 2 + 0.9;
  P[f.id].x = r1(f.cx + f.fx * u); P[f.id].z = r1(f.cz + f.fz * u);
  console.log(f.id, P[f.id].x, P[f.id].z, getHeight(P[f.id].x, P[f.id].z).toFixed(2));
}
P.clinic.x = r1(FACILITIES.clinic.x); P.clinic.z = r1(FACILITIES.clinic.z);
P.airport.x = r1(FACILITIES.terminal.x); P.airport.z = r1(FACILITIES.terminal.z);
P.imorod.tao = 'Imorod';
fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n');
console.log(JSON.stringify(P, null, 0).slice(0, 400));
