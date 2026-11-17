import * as THREE from 'three';
import { Building } from '../types/world';
import { IslandMaterialLibrary } from './islandMaterials';
import {
  getIslandHeight,
  getRiverCenterX,
  getRiverHalfWidth,
  percentToWorldXZ,
  RoadPathLoop,
  TERRAIN_SCALE_XY,
  WATER_LEVEL,
} from './islandTerrain';

export interface CircleCollider {
  x: number;
  z: number;
  radius: number;
}

export interface OceanSystem {
  mesh: THREE.Mesh;
  boatsGroup: THREE.Group;
  dispose: () => void;
}

export interface ForestSystem {
  trunks: THREE.InstancedMesh;
  canopies: THREE.InstancedMesh;
  rocks: THREE.InstancedMesh;
  colliders: CircleCollider[];
  dispose: () => void;
}

export interface CitizenCrowdSystem {
  bodies: THREE.InstancedMesh;
  heads: THREE.InstancedMesh;
  update: (elapsed: number, population: number, paths: RoadPathLoop[]) => void;
  dispose: () => void;
}

function seededRand(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function createOceanSystem(
  mats: IslandMaterialLibrary,
  timeUniform: { value: number }
): OceanSystem {
  const oceanGeo = new THREE.PlaneGeometry(520, 520, 56, 56);
  oceanGeo.rotateX(-Math.PI / 2);

  const oceanMat = new THREE.MeshStandardMaterial({
    color: '#0e4c63',
    roughness: 0.16,
    metalness: 0.22,
    bumpMap: mats.waterRippleTex,
    bumpScale: 0.08,
    transparent: true,
    opacity: 0.94,
  });

  oceanMat.customProgramCacheKey = () => 'island-ocean-v1';
  oceanMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         varying vec2 vOceanUv;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vOceanUv = uv;
         float distCenter = length(position.xz);
         float wave = sin(position.x * 0.14 + uTime * 1.35) * 0.14
                    + cos(position.z * 0.16 - uTime * 1.1) * 0.11;
         transformed.y += wave * smoothstep(32.0, 62.0, distCenter);`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         varying vec2 vOceanUv;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float shimmer = sin(vOceanUv.x * 32.0 + uTime * 1.8) * cos(vOceanUv.y * 32.0 - uTime * 1.4);
         diffuseColor.rgb += vec3(0.03, 0.08, 0.10) * max(0.0, shimmer);`
      );
  };

  const mesh = new THREE.Mesh(oceanGeo, oceanMat);
  mesh.position.y = WATER_LEVEL;
  mesh.receiveShadow = true;
  mesh.name = 'islandOcean';

  // Two human-scale (~4.2m) wooden sailboats anchored in the eastern crescent bay
  const boatsGroup = new THREE.Group();
  const hullGeo = new THREE.BoxGeometry(2.85, 0.85, 1.32);
  const mastGeo = new THREE.CylinderGeometry(0.06, 0.08, 3.1, 6);
  const sailGeo = new THREE.ConeGeometry(1.05, 2.4, 3);
  const sailMat = new THREE.MeshStandardMaterial({ color: '#f3ead8', roughness: 0.8 });

  const s = TERRAIN_SCALE_XY;
  const boatPositions = [
    { x: 24.8 * s, z: 3.4 * s, rot: 0.5 },
    { x: 23.2 * s, z: -3.2 * s, rot: -0.4 },
  ];

  boatPositions.forEach((bp, idx) => {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(hullGeo, mats.timberMat);
    hull.position.y = 0.18;
    const mast = new THREE.Mesh(mastGeo, mats.sandstoneMat);
    mast.position.y = 1.75;
    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.position.set(0.18, 1.95, 0);
    sail.scale.set(0.35, 1, 1);
    boat.add(hull, mast, sail);
    boat.position.set(bp.x, WATER_LEVEL + 0.12, bp.z);
    boat.rotation.y = bp.rot;
    boat.userData.phase = idx * 2.1;
    boatsGroup.add(boat);
  });

  return {
    mesh,
    boatsGroup,
    dispose: () => {
      oceanGeo.dispose();
      oceanMat.dispose();
      hullGeo.dispose();
      mastGeo.dispose();
      sailGeo.dispose();
      sailMat.dispose();
    },
  };
}

export function createForestAndRocks(
  buildings: Building[],
  timeUniform: { value: number },
  isSoftwareGl: boolean
): ForestSystem {
  const MAX_TREES = 240;
  const MAX_ROCKS = 58;

  // Human-scaled pine trees (~5.2m - 6.6m tall so 1.75m player walks beneath canopies)
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.85, 6);
  trunkGeo.translate(0, 0.925, 0);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: '#6b472b',
    roughness: 0.9,
    metalness: 0.02,
  });

  const canopyGeo = new THREE.ConeGeometry(1.38, 3.65, 7);
  canopyGeo.translate(0, 3.15, 0);
  const canopyMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.85,
    metalness: 0.02,
  });

  // Zero-CPU GPU wind sway on tree canopies
  canopyMat.customProgramCacheKey = () => 'island-canopy-sway-v1';
  canopyMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float swayFactor = smoothstep(1.3, 4.8, position.y);
         #ifdef USE_INSTANCING
           vec3 instPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
           float windPhase = instPos.x * 0.25 + instPos.z * 0.22;
         #else
           float windPhase = 0.0;
         #endif
         transformed.x += sin(uTime * 1.45 + windPhase) * 0.16 * swayFactor;
         transformed.z += cos(uTime * 1.15 + windPhase * 0.8) * 0.12 * swayFactor;`
      );
  };

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, MAX_TREES);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, MAX_TREES);
  trunks.castShadow = !isSoftwareGl;
  canopies.castShadow = !isSoftwareGl;
  canopies.receiveShadow = true;

  const rockGeo = new THREE.DodecahedronGeometry(1.05, 0);
  const rockMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.92,
    metalness: 0.05,
  });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, MAX_ROCKS);
  rocks.castShadow = !isSoftwareGl;
  rocks.receiveShadow = true;

  const buildingPts = buildings.map((b) => percentToWorldXZ(b.xPercent, b.yPercent));
  const dummy = new THREE.Object3D();
  const colliders: CircleCollider[] = [];
  const treePalette = [
    new THREE.Color('#235d3a'),
    new THREE.Color('#2f6e44'),
    new THREE.Color('#3a7c45'),
    new THREE.Color('#1f5036'),
    new THREE.Color('#478042'),
  ];
  const rockPalette = [
    new THREE.Color('#6b767f'),
    new THREE.Color('#5a656d'),
    new THREE.Color('#7a8286'),
  ];

  const s = TERRAIN_SCALE_XY;
  let treeCount = 0;
  let rockCount = 0;

  for (let i = 0; i < 1100 && (treeCount < MAX_TREES || rockCount < MAX_ROCKS); i++) {
    const rx = (seededRand(i * 3 + 1) - 0.5) * 52 * s;
    const rz = (seededRand(i * 3 + 2) - 0.5) * 52 * s;
    const y = getIslandHeight(rx, rz);

    // Exclude ocean & shore
    if (y < 1.05) continue;

    // Exclude river channel
    if (rz >= -17.5 * s && rz <= 26 * s) {
      const distR = Math.abs(rx - getRiverCenterX(rz));
      if (distR < getRiverHalfWidth(rz) * 1.9) continue;
    }

    // Exclude building footprints
    const nearBuilding = buildingPts.some((bp) => Math.hypot(bp.x - rx, bp.z - rz) < 8.2);
    if (nearBuilding) continue;

    // Exclude central settlement road ring & player spawn plaza
    if (Math.hypot(rx - 4.5 * s, rz - 2.0 * s) < 4.5) continue;

    const scaleVar = 0.85 + seededRand(i * 3 + 3) * 0.35;

    if (y >= 6.4 && y <= 12.6 && rockCount < MAX_ROCKS) {
      dummy.position.set(rx, y + 0.25, rz);
      dummy.rotation.set(
        seededRand(i + 10) * 0.6,
        seededRand(i + 20) * Math.PI * 2,
        seededRand(i + 30) * 0.6
      );
      dummy.scale.set(scaleVar * 1.2, scaleVar * 0.85, scaleVar * 1.1);
      dummy.updateMatrix();
      rocks.setMatrixAt(rockCount, dummy.matrix);
      rocks.setColorAt(rockCount, rockPalette[rockCount % rockPalette.length]);
      colliders.push({ x: rx, z: rz, radius: 1.0 * scaleVar });
      rockCount++;
      continue;
    }

    if (y >= 1.2 && y <= 7.8 && treeCount < MAX_TREES) {
      // Favor western highlands, northern foothills, and eastern woodlands
      const forestDensity =
        rx < -3 * s || rz < -6 * s || Math.hypot(rx - 14 * s, rz + 12 * s) < 9 * s ? 0.82 : 0.34;
      if (seededRand(i * 7 + 5) > forestDensity) continue;

      dummy.position.set(rx, y - 0.08, rz);
      dummy.rotation.set(0, seededRand(i * 5) * Math.PI * 2, 0);
      dummy.scale.set(scaleVar, scaleVar * (0.9 + seededRand(i * 9) * 0.35), scaleVar);
      dummy.updateMatrix();
      trunks.setMatrixAt(treeCount, dummy.matrix);
      canopies.setMatrixAt(treeCount, dummy.matrix);
      canopies.setColorAt(treeCount, treePalette[treeCount % treePalette.length]);
      colliders.push({ x: rx, z: rz, radius: 0.34 * scaleVar });
      treeCount++;
    }
  }

  trunks.count = treeCount;
  canopies.count = treeCount;
  rocks.count = rockCount;
  trunks.instanceMatrix.needsUpdate = true;
  canopies.instanceMatrix.needsUpdate = true;
  if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
  rocks.instanceMatrix.needsUpdate = true;
  if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;

  trunks.computeBoundingSphere();
  canopies.computeBoundingSphere();
  rocks.computeBoundingSphere();

  return {
    trunks,
    canopies,
    rocks,
    colliders,
    dispose: () => {
      trunkGeo.dispose();
      trunkMat.dispose();
      canopyGeo.dispose();
      canopyMat.dispose();
      rockGeo.dispose();
      rockMat.dispose();
    },
  };
}

export function createCitizenCrowdSystem(): CitizenCrowdSystem {
  const MAX_CITIZENS = 40;
  // Realistic ~1.68m NPC human proportions matching the player character
  const bodyGeo = new THREE.CylinderGeometry(0.19, 0.24, 1.22, 8);
  bodyGeo.translate(0, 0.61, 0);
  const headGeo = new THREE.SphereGeometry(0.17, 10, 10);
  headGeo.translate(0, 1.44, 0);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.72,
    metalness: 0.04,
  });
  const headMat = new THREE.MeshStandardMaterial({
    color: '#f2c9a0',
    roughness: 0.7,
    metalness: 0.02,
  });

  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, MAX_CITIZENS);
  const heads = new THREE.InstancedMesh(headGeo, headMat, MAX_CITIZENS);
  bodies.frustumCulled = false;
  heads.frustumCulled = false;

  const tunicColors = [
    new THREE.Color('#f59e0b'),
    new THREE.Color('#38bdf8'),
    new THREE.Color('#34d399'),
    new THREE.Color('#e2e8f0'),
    new THREE.Color('#fb7185'),
  ];

  const agentSpecs = Array.from({ length: MAX_CITIZENS }, (_, idx) => {
    bodies.setColorAt(idx, tunicColors[idx % tunicColors.length]);
    return {
      loopOffset: seededRand(idx * 11 + 3),
      speed: 0.008 + seededRand(idx * 17 + 7) * 0.006,
      dir: idx % 2 === 0 ? 1 : -1,
      lateralOffset: (seededRand(idx * 23 + 1) - 0.5) * 1.15,
      loopChoice: idx,
    };
  });
  if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;

  const _dummy = new THREE.Object3D();
  const _pt = new THREE.Vector3();
  const _tangent = new THREE.Vector3();

  const update = (elapsed: number, population: number, paths: RoadPathLoop[]) => {
    if (paths.length === 0) return;
    const activeCount = Math.min(MAX_CITIZENS, Math.max(0, Math.round(population)));
    bodies.count = activeCount;
    heads.count = activeCount;
    if (activeCount === 0) return;

    for (let i = 0; i < activeCount; i++) {
      const spec = agentSpecs[i];
      const path = paths[spec.loopChoice % paths.length];
      let t = (spec.loopOffset + elapsed * spec.speed * spec.dir) % 1;
      if (t < 0) t += 1;

      path.curve.getPointAt(t, _pt);
      path.curve.getTangentAt(t, _tangent);

      // Gentle lateral offset along road shoulder + crisp walking stride bob
      const nx = -_tangent.z;
      const nz = _tangent.x;
      const bob = Math.abs(Math.sin(elapsed * 6.5 + i * 1.3)) * 0.08;

      _dummy.position.set(
        _pt.x + nx * spec.lateralOffset,
        _pt.y + bob,
        _pt.z + nz * spec.lateralOffset
      );
      _dummy.rotation.set(
        0,
        Math.atan2(_tangent.x * spec.dir, _tangent.z * spec.dir),
        0
      );
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();

      bodies.setMatrixAt(i, _dummy.matrix);
      heads.setMatrixAt(i, _dummy.matrix);
    }

    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
  };

  return {
    bodies,
    heads,
    update,
    dispose: () => {
      bodyGeo.dispose();
      headGeo.dispose();
      bodyMat.dispose();
      headMat.dispose();
    },
  };
}
