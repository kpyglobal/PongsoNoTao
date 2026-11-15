#!/usr/bin/env python3
"""
0.1.4: build src/world/outline.ts (the island coastline used by the heightfield) from the public
OpenStreetMap island polygon of 蘭嶼 (relation 10730513, via Nominatim; data © OpenStreetMap
contributors, ODbL 1.0). Only the coastline geometry is used, heavily simplified; no map art.
  python3 scripts/dev/make-outline.py [cached.json]
Projection: equirectangular around the polygon's bounding-box centre, north = -z, SCALE game units per km.
"""
import json, math, sys, urllib.request

SCALE = 11.2   # game units per km (0.1.3 island ≈ 4 800 u², this gives ≈ 5 700 u²)
TOL_KM = 0.07  # Douglas–Peucker tolerance

if len(sys.argv) > 1:
    data = json.load(open(sys.argv[1]))
else:
    req = urllib.request.Request('https://nominatim.openstreetmap.org/lookup?osm_ids=R10730513&format=json&polygon_geojson=1',
                                 headers={'User-Agent': 'tao-rpg-dev/0.1'})
    data = json.load(urllib.request.urlopen(req))
e = data[0]
ring = e['geojson']['coordinates'][0]
lons = [p[0] for p in ring]; lats = [p[1] for p in ring]
LON0 = (min(lons) + max(lons)) / 2
LAT0 = (min(lats) + max(lats)) / 2
KX = 111320 * math.cos(math.radians(LAT0)) / 1000
KZ = 110574 / 1000

def proj(lon, lat):
    return ((lon - LON0) * KX * SCALE, -(lat - LAT0) * KZ * SCALE)

pts = [proj(*p) for p in ring]
if pts[0] == pts[-1]: pts = pts[:-1]

def dp(P, tol):
    if len(P) < 3: return P
    a, b = P[0], P[-1]
    dx, dz = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dz) or 1e-9
    best, bi = -1, 0
    for i in range(1, len(P) - 1):
        d = abs((P[i][0] - a[0]) * dz - (P[i][1] - a[1]) * dx) / L
        if d > best: best, bi = d, i
    if best <= tol: return [a, b]
    return dp(P[:bi + 1], tol)[:-1] + dp(P[bi:], tol)

# split the closed ring at its two farthest points so DP keeps them
i0 = min(range(len(pts)), key=lambda i: pts[i][0]); i1 = max(range(len(pts)), key=lambda i: pts[i][0])
lo, hi = sorted((i0, i1))
s = dp(pts[lo:hi + 1], TOL_KM * SCALE)[:-1] + dp(pts[hi:] + pts[:lo + 1], TOL_KM * SCALE)[:-1]
area = 0.5 * abs(sum(s[i][0] * s[(i + 1) % len(s)][1] - s[(i + 1) % len(s)][0] * s[i][1] for i in range(len(s))))
flat = ', '.join(f'{x:.1f}, {z:.1f}' for x, z in s)
out = f"""/**
 * 0.1.4: 蘭嶼 coastline, from the public OpenStreetMap island polygon (relation 10730513;
 * data © OpenStreetMap contributors, ODbL 1.0), simplified by scripts/dev/make-outline.py.
 * Only the outline geometry is used (no map art). {SCALE} game units per km, +x east, +z south,
 * centred on the polygon's bounding box (lon {LON0:.5f}, lat {LAT0:.5f}). {len(s)} points, ≈ {area:.0f} u².
 */
export const OUTLINE_SCALE = {SCALE};
export const OUTLINE_LON0 = {LON0:.6f};
export const OUTLINE_LAT0 = {LAT0:.6f};
/** flat x, z pairs, closed implicitly */
export const LANYU_OUTLINE: readonly number[] = [{flat}];

/** real lon / lat → game x / z (same projection as the outline) */
export function geo(lon: number, lat: number): {{ x: number; z: number }} {{
  return {{ x: (lon - OUTLINE_LON0) * {KX:.4f} * OUTLINE_SCALE, z: -(lat - OUTLINE_LAT0) * {KZ:.4f} * OUTLINE_SCALE }};
}}
"""
open('src/world/outline.ts', 'w').write(out)
print(len(s), 'points, area', round(area), 'bbox', [round(min(p[0] for p in s)), round(max(p[0] for p in s)), round(min(p[1] for p in s)), round(max(p[1] for p in s))])
