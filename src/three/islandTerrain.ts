import * as THREE from 'three';
import { Building } from '../types/world';

export const TERRAIN_SCALE_XY = 140 / 60; // 2.3333x scale so 1 unit ≈ 1 meter for a 1.75m character
export const TERRAIN_SCALE_Y = 1.45;
export const WORLD_MAP_SPAN = 140; // Maps 0..100% <-> -70..+70 meters
export const TERRAIN_SIZE = 176;
export const TERRAIN_SEGMENTS = 128;
export const WATER_LEVEL = 0.0;

export function percentToWorldXZ(xPercent: number, yPercent: number): { x: number; z: number } {
  return {
    x: (xPercent / 100 - 0.5) * WORLD_MAP_SPAN,
    z: (yPercent / 100 - 0.5) * WORLD_MAP_SPAN,
  };
}

export function worldXZToPercent(x: number, z: number): { xPercent: number; yPercent: number } {
  const xPercent = Math.max(5, Math.min(95, Math.round((x / WORLD_MAP_SPAN + 0.5) * 100)));
  const yPercent = Math.max(5, Math.min(95, Math.round((z / WORLD_MAP_SPAN + 0.5) * 100)));
  return { xPercent, yPercent };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function gaussian2D(x: number, z: number, cx: number, cz: number, sx: number, sz: number): number {
  const dx = (x - cx) / sx;
  const dz = (z - cz) / sz;
  return Math.exp(-(dx * dx + dz * dz));
}

export function getRiverCenterX(worldZ: number): number {
  const z = worldZ / TERRAIN_SCALE_XY;
  const sx = -1.2 + Math.sin((z + 10) * 0.145) * 2.8 + (z > 10 ? (z - 10) * 0.28 : 0);
  return sx * TERRAIN_SCALE_XY;
}

export function getRiverHalfWidth(worldZ: number): number {
  const z = worldZ / TERRAIN_SCALE_XY;
  const progress = Math.max(0, Math.min(1, (z + 17) / 42));
  return (0.9 + progress * 1.15) * TERRAIN_SCALE_XY;
}

export function getIslandHeight(worldX: number, worldZ: number): number {
  const x = worldX / TERRAIN_SCALE_XY;
  const z = worldZ / TERRAIN_SCALE_XY;

  const angle = Math.atan2(z, x);
  const radialDist = Math.hypot(x * 0.94, z * 1.02);

  // Organic coastline silhouette with sheltered eastern bay around angle ~ 0.1..0.5
  const coastNoise =
    Math.sin(angle * 3 + 0.6) * 2.3 +
    Math.cos(angle * 5 - 1.1) * 1.35 +
    Math.sin(angle * 2 + 2.1) * 1.6;
  const bayIndent = Math.exp(-Math.pow((angle - 0.15) / 0.48, 2)) * 4.2;
  const islandRadius = 26.8 + coastNoise - bayIndent;

  // Base landmass elevation profile
  const coastMask = 1 - smoothstep(islandRadius - 6.5, islandRadius + 2.2, radialDist);
  let h = -2.2 + coastMask * 4.1;

  // Gentle rolling terrain undulation
  const rolling =
    (Math.sin(x * 0.16 + 0.4) * Math.cos(z * 0.15 - 0.3) * 0.55 +
      Math.sin((x + z) * 0.28) * 0.25) *
    coastMask;
  h += rolling;

  // Northern & Northwestern Mountain Range (Peaks + Ridge)
  const peakWest = gaussian2D(x, z, -15.5, -15.5, 6.8, 5.6) * 9.8;
  const peakEast = gaussian2D(x, z, 8.2, -16.8, 6.2, 5.2) * 8.4;
  const ridgeConnect = gaussian2D(x, z, -3.5, -18.2, 11.5, 4.4) * 5.2;
  const ridgeDetail =
    (Math.abs(Math.sin(x * 0.45) * Math.cos(z * 0.45)) * 1.15 +
      Math.sin(x * 0.8 + z * 0.6) * 0.4) *
    smoothstep(2.5, 9.0, peakWest + peakEast + ridgeConnect);

  h += (peakWest + peakEast + ridgeConnect + ridgeDetail) * coastMask;

  // Sunridge Plateau (supports starter Solar Station around x=-7.8, z=-15)
  const sunridgePad = gaussian2D(x, z, -7.8, -14.5, 3.8, 3.2);
  h = THREE.MathUtils.lerp(h, 3.4, sunridgePad * 0.65);

  // Western Forested Highlands
  h += gaussian2D(x, z, -14.5, 3.5, 7.5, 9.0) * 2.1 * coastMask;

  // Southern Fertile Valley Terrace (farms & clinic)
  const valleyPad = gaussian2D(x, z, 8.5, 10.5, 10.5, 8.5);
  h = THREE.MathUtils.lerp(h, Math.max(h, 1.55), valleyPad * 0.45 * coastMask);

  // Carve winding river gorge from mountain spring (z=-17) down to southern sea (z=26)
  if (z >= -17.5 && z <= 27) {
    const rcx = -1.2 + Math.sin((z + 10) * 0.145) * 2.8 + (z > 10 ? (z - 10) * 0.28 : 0);
    const progress = Math.max(0, Math.min(1, (z + 17) / 42));
    const halfW = 0.9 + progress * 1.15;
    const distRiver = Math.abs(x - rcx);
    const riverCarve = 1 - smoothstep(halfW * 0.35, halfW * 2.2, distRiver);
    const sourceFade = smoothstep(-17.8, -14.5, z);
    const channelFloor = z < -6 ? 0.55 - (z + 17) * 0.06 : -0.35;
    h = THREE.MathUtils.lerp(h, Math.min(h, channelFloor), riverCarve * sourceFade * 0.92);
  }

  return h >= 0 ? h * TERRAIN_SCALE_Y : h * 1.3;
}

export function getIslandSlopeInfo(
  worldX: number,
  worldZ: number
): { y: number; slope: number; gx: number; gz: number } {
  const eps = 0.7;
  const y = getIslandHeight(worldX, worldZ);
  const hx = getIslandHeight(worldX + eps, worldZ);
  const hz = getIslandHeight(worldX, worldZ + eps);
  const gx = (hx - y) / eps;
  const gz = (hz - y) / eps;
  return { y, slope: Math.hypot(gx, gz), gx, gz };
}

export function getRiverSurfaceHeight(worldZ: number): number {
  const z = worldZ / TERRAIN_SCALE_XY;
  if (z < -6) {
    return Math.max(0.14, (0.95 - (z + 17) * 0.08) * TERRAIN_SCALE_Y);
  }
  return 0.14;
}

export function createTerrainMesh(
  detailTexture: THREE.CanvasTexture
): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> {
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const count = pos.count;
  const colors = new Float32Array(count * 3);

  const cDeep = new THREE.Color('#0a2e3f');
  const cShallow = new THREE.Color('#1a5f6b');
  const cSand = new THREE.Color('#c8b07b');
  const cGrassLow = new THREE.Color('#2c6b42');
  const cGrassHigh = new THREE.Color('#3b7a48');
  const cRock = new THREE.Color('#5a656e');
  const cSnow = new THREE.Color('#dce6ec');
  const tmpColor = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = getIslandHeight(x, z);
    pos.setY(i, y);

    // Compute local slope estimate for rock cliffs (scale-adjusted)
    const hx = getIslandHeight(x + 1.2, z);
    const hz = getIslandHeight(x, z + 1.2);
    const slope = Math.hypot(hx - y, hz - y) / 1.2;

    if (y < -1.0) {
      tmpColor.copy(cDeep);
    } else if (y < 0.08) {
      tmpColor.copy(cDeep).lerp(cShallow, smoothstep(-1.0, 0.08, y));
    } else if (y < 0.95) {
      tmpColor.copy(cSand).lerp(cGrassLow, smoothstep(0.45, 0.95, y));
    } else if (y < 6.5) {
      tmpColor.copy(cGrassLow).lerp(cGrassHigh, smoothstep(1.2, 5.2, y));
      if (slope > 0.45) {
        tmpColor.lerp(cRock, smoothstep(0.45, 0.9, slope));
      }
    } else if (y < 12.2) {
      const rockMix = Math.max(smoothstep(6.0, 11.0, y), smoothstep(0.42, 0.85, slope));
      tmpColor.copy(cGrassHigh).lerp(cRock, rockMix);
    } else {
      tmpColor.copy(cRock).lerp(cSnow, smoothstep(11.8, 15.2, y));
    }

    // Subtle river bank moisture darkening
    if (z >= -17 * TERRAIN_SCALE_XY && z <= 25 * TERRAIN_SCALE_XY) {
      const distR = Math.abs(x - getRiverCenterX(z));
      const rw = getRiverHalfWidth(z);
      if (distR < rw * 1.4 && y > 0.04) {
        tmpColor.lerp(cShallow, 0.22 * (1 - distR / (rw * 1.4)));
      }
    }

    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: detailTexture,
    roughness: 0.88,
    metalness: 0.04,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'islandTerrain';
  return mesh;
}

export function createRiverMesh(
  rippleTexture: THREE.CanvasTexture,
  timeUniform: { value: number }
): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
  const steps = 60;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const z = THREE.MathUtils.lerp(-16.2 * TERRAIN_SCALE_XY, 25.5 * TERRAIN_SCALE_XY, t);
    const cx = getRiverCenterX(z);
    const hw = getRiverHalfWidth(z) * 1.15;
    const y = getRiverSurfaceHeight(z);

    positions.push(cx - hw, y, z);
    positions.push(cx + hw, y, z);

    uvs.push(0, t * 14);
    uvs.push(1, t * 14);

    if (i < steps) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: '#2095a8',
    roughness: 0.14,
    metalness: 0.12,
    transparent: true,
    opacity: 0.88,
    bumpMap: rippleTexture,
    bumpScale: 0.06,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  mat.customProgramCacheKey = () => 'island-river-v1';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         varying vec2 vRiverUv;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vRiverUv = uv;
         transformed.y += sin(position.z * 0.7 - uTime * 2.8) * 0.035;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         varying vec2 vRiverUv;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float flowFoam = sin(vRiverUv.y * 12.0 - uTime * 3.4) * 0.5 + 0.5;
         diffuseColor.rgb += vec3(0.08, 0.14, 0.15) * pow(flowFoam, 3.0);`
      );
  };

  const riverMesh = new THREE.Mesh(geo, mat);
  riverMesh.receiveShadow = true;
  riverMesh.name = 'islandRiver';
  return riverMesh;
}

export interface RoadPathLoop {
  curve: THREE.CatmullRomCurve3;
  length: number;
}

export function buildSettlementRoadPaths(buildings: Building[]): RoadPathLoop[] {
  const toGroundPt = (x: number, z: number) =>
    new THREE.Vector3(x, Math.max(WATER_LEVEL + 0.35, getIslandHeight(x, z)) + 0.08, z);

  const s = TERRAIN_SCALE_XY;

  // Core island loop connecting River Cistern, Timber Coast, Clinic, Southern Farm, and Central Plaza
  const coreLoop = new THREE.CatmullRomCurve3(
    [
      toGroundPt(-0.6 * s, -4.2 * s),  // Cistern
      toGroundPt(5.2 * s, -5.0 * s),
      toGroundPt(10.8 * s, -5.4 * s),  // Coastal Factory
      toGroundPt(15.2 * s, 1.4 * s),
      toGroundPt(16.8 * s, 7.8 * s),   // Health Hall
      toGroundPt(12.2 * s, 12.6 * s),
      toGroundPt(7.2 * s, 13.2 * s),   // Emerald Farm
      toGroundPt(2.8 * s, 7.6 * s),
      toGroundPt(1.5 * s, 1.0 * s),
    ],
    true
  );

  // Secondary Sunridge spur connecting North Ridge Solar Station to River Cistern
  const northSpur = new THREE.CatmullRomCurve3(
    [
      toGroundPt(-0.6 * s, -4.2 * s),
      toGroundPt(-4.2 * s, -9.2 * s),
      toGroundPt(-7.8 * s, -14.8 * s),
      toGroundPt(-4.2 * s, -9.2 * s),
    ],
    true
  );

  const loops: RoadPathLoop[] = [
    { curve: coreLoop, length: coreLoop.getLength() },
    { curve: northSpur, length: northSpur.getLength() },
  ];

  // Add subtle spur paths to any additional decision-spawned buildings outside starter set
  const hub = toGroundPt(4.5 * s, 3.2 * s);
  for (const b of buildings) {
    if (
      b.id === 'bld_pioneer_farm' ||
      b.id === 'bld_river_cistern' ||
      b.id === 'bld_timber_factory' ||
      b.id === 'bld_solar_station' ||
      b.id === 'bld_pioneer_clinic'
    ) {
      continue;
    }
    const { x, z } = percentToWorldXZ(b.xPercent, b.yPercent);
    const target = toGroundPt(x, z);
    const mid = toGroundPt((hub.x + target.x) * 0.5, (hub.z + target.z) * 0.5);
    const spurCurve = new THREE.CatmullRomCurve3([hub, mid, target, mid], true);
    loops.push({ curve: spurCurve, length: spurCurve.getLength() });
  }

  return loops;
}

export function createRoadNetworkMesh(
  paths: RoadPathLoop[],
  cobbleTexture: THREE.CanvasTexture
): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  for (let pIdx = 0; pIdx < paths.length; pIdx++) {
    const curve = paths[pIdx].curve;
    const segments = pIdx === 0 ? 96 : 44;
    const halfWidth = pIdx === 0 ? 1.45 : 1.05;
    const pts = curve.getPoints(segments);

    for (let i = 0; i <= segments; i++) {
      const curr = pts[i % pts.length];
      const next = pts[(i + 1) % pts.length];
      const dx = next.x - curr.x;
      const dz = next.z - curr.z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;

      const lx = curr.x + nx * halfWidth;
      const lz = curr.z + nz * halfWidth;
      const rx = curr.x - nx * halfWidth;
      const rz = curr.z - nz * halfWidth;

      const ly = Math.max(WATER_LEVEL + 0.34, getIslandHeight(lx, lz)) + 0.09;
      const ry = Math.max(WATER_LEVEL + 0.34, getIslandHeight(rx, rz)) + 0.09;

      positions.push(lx, ly, lz, rx, ry, rz);
      uvs.push(0, i * 1.1, 1.4, i * 1.1);

      if (i < segments) {
        const a = vertexOffset + i * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        indices.push(a, c, b, b, c, d);
      }
    }
    vertexOffset += (segments + 1) * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    map: cobbleTexture,
    roughness: 0.9,
    metalness: 0.02,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const roadMesh = new THREE.Mesh(geo, mat);
  roadMesh.receiveShadow = true;
  roadMesh.name = 'islandRoads';
  return roadMesh;
}
