import * as THREE from 'three';
import { Building, BuildingCategory } from '../types/world';
import { IslandMaterialLibrary } from './islandMaterials';
import { getIslandHeight, percentToWorldXZ, WATER_LEVEL } from './islandTerrain';

export interface AnimatedBuildingPart {
  object: THREE.Object3D;
  kind: 'turbine' | 'crane' | 'smoke';
  phase: number;
  baseY: number;
}

export const BUILDING_WORLD_SCALE = 2.25;

export interface BuildingCollider {
  buildingId: string;
  x: number;
  z: number;
  yaw: number;
  halfW: number;
  halfD: number;
  plinthHalfW: number;
  plinthTopY: number;
  wallTopY: number;
}

export interface BuiltStructureResult {
  group: THREE.Group;
  hitProxy: THREE.Mesh;
  animatedParts: AnimatedBuildingPart[];
  targetScale: number;
  collider: BuildingCollider;
}

// Shared primitive geometry cache to avoid allocating duplicate buffers
const geoCache = {
  plinth: new THREE.BoxGeometry(2.7, 0.95, 2.7),
  shadowPlane: new THREE.PlaneGeometry(3.8, 3.8),
  hitBox: new THREE.BoxGeometry(3.1, 3.6, 3.1),
  // Agriculture
  barnBody: new THREE.BoxGeometry(1.3, 0.9, 1.0),
  barnRoof: new THREE.ConeGeometry(1.0, 0.65, 4),
  siloBody: new THREE.CylinderGeometry(0.32, 0.34, 1.25, 12),
  siloCap: new THREE.ConeGeometry(0.36, 0.34, 12),
  cropBed: new THREE.BoxGeometry(1.05, 0.14, 0.42),
  fencePost: new THREE.CylinderGeometry(0.04, 0.04, 0.36, 6),
  // Factory
  factoryHall: new THREE.BoxGeometry(1.85, 1.05, 1.35),
  sawRoof: new THREE.BoxGeometry(0.6, 0.35, 1.38),
  smokestack: new THREE.CylinderGeometry(0.14, 0.19, 1.85, 10),
  stackBand: new THREE.CylinderGeometry(0.16, 0.16, 0.12, 10),
  crate: new THREE.BoxGeometry(0.28, 0.28, 0.28),
  smokePuff: new THREE.SphereGeometry(0.16, 8, 8),
  // Infrastructure (Cistern / Aqueduct / Harbor)
  basinWall: new THREE.BoxGeometry(2.1, 0.55, 2.1),
  basinWater: new THREE.BoxGeometry(1.75, 0.38, 1.75),
  archPier: new THREE.BoxGeometry(0.35, 1.3, 0.45),
  archTop: new THREE.BoxGeometry(2.1, 0.28, 0.48),
  valveWheel: new THREE.TorusGeometry(0.18, 0.04, 6, 12),
  // Energy (Solar & Wind)
  substation: new THREE.BoxGeometry(0.95, 0.65, 0.85),
  solarPanel: new THREE.BoxGeometry(0.75, 0.06, 0.52),
  solarMount: new THREE.CylinderGeometry(0.05, 0.07, 0.42, 6),
  turbineMast: new THREE.CylinderGeometry(0.08, 0.15, 2.6, 10),
  turbineHub: new THREE.SphereGeometry(0.14, 8, 8),
  turbineBlade: new THREE.BoxGeometry(0.09, 1.05, 0.03),
  // Health & Civic & Science
  hallMain: new THREE.BoxGeometry(1.75, 0.95, 1.35),
  hallWing: new THREE.BoxGeometry(2.15, 0.72, 0.9),
  pillar: new THREE.CylinderGeometry(0.07, 0.08, 0.85, 8),
  dome: new THREE.SphereGeometry(0.58, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
  spire: new THREE.ConeGeometry(0.32, 1.15, 8),
  windowStrip: new THREE.BoxGeometry(0.22, 0.28, 0.06),
  telescope: new THREE.CylinderGeometry(0.08, 0.11, 0.72, 8),
  // Construction & Planned
  scaffoldPost: new THREE.CylinderGeometry(0.04, 0.04, 1.45, 6),
  craneMast: new THREE.CylinderGeometry(0.06, 0.08, 2.2, 6),
  craneBoom: new THREE.BoxGeometry(1.5, 0.08, 0.08),
  blueprintCube: new THREE.BoxGeometry(2.0, 1.35, 2.0),
};

const hitProxyMat = new THREE.MeshBasicMaterial({ visible: false });
const smokeMat = new THREE.MeshStandardMaterial({
  color: '#d8e2e8',
  transparent: true,
  opacity: 0.58,
  roughness: 0.95,
  depthWrite: false,
});
const waterPoolMat = new THREE.MeshStandardMaterial({
  color: '#25a4b8',
  roughness: 0.12,
  metalness: 0.2,
});

function addCastReceive(obj: THREE.Object3D, castShadow: boolean) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const m = child as THREE.Mesh;
      if (m.material === hitProxyMat) return;
      m.castShadow = castShadow;
      m.receiveShadow = true;
    }
  });
}

function buildCategoryDetails(
  category: BuildingCategory,
  mats: IslandMaterialLibrary,
  animatedParts: AnimatedBuildingPart[],
  phaseSeed: number
): THREE.Group {
  const model = new THREE.Group();

  if (category === 'agriculture') {
    const barn = new THREE.Mesh(geoCache.barnBody, mats.timberMat);
    barn.position.set(-0.45, 0.55, -0.35);
    model.add(barn);

    const roof = new THREE.Mesh(geoCache.barnRoof, mats.terracottaRoofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(-0.45, 1.32, -0.35);
    model.add(roof);

    const silo = new THREE.Mesh(geoCache.siloBody, mats.sandstoneMat);
    silo.position.set(0.55, 0.72, -0.45);
    model.add(silo);

    const siloCap = new THREE.Mesh(geoCache.siloCap, mats.brassMat);
    siloCap.position.set(0.55, 1.5, -0.45);
    model.add(siloCap);

    for (let r = 0; r < 3; r++) {
      const bed = new THREE.Mesh(geoCache.cropBed, mats.cropMat);
      bed.position.set(0.15, 0.18, 0.25 + r * 0.42);
      model.add(bed);
    }

    const fence1 = new THREE.Mesh(geoCache.fencePost, mats.timberMat);
    fence1.position.set(-1.0, 0.28, 0.95);
    const fence2 = new THREE.Mesh(geoCache.fencePost, mats.timberMat);
    fence2.position.set(1.0, 0.28, 0.95);
    model.add(fence1, fence2);
  } else if (category === 'factory') {
    const hall = new THREE.Mesh(geoCache.factoryHall, mats.darkStoneMat);
    hall.position.set(-0.1, 0.62, 0.05);
    model.add(hall);

    for (let i = -1; i <= 1; i++) {
      const saw = new THREE.Mesh(geoCache.sawRoof, mats.terracottaRoofMat);
      saw.rotation.z = 0.35;
      saw.position.set(-0.1 + i * 0.56, 1.24, 0.05);
      model.add(saw);
    }

    const stack1 = new THREE.Mesh(geoCache.smokestack, mats.stoneMat);
    stack1.position.set(0.68, 1.02, -0.45);
    const band1 = new THREE.Mesh(geoCache.stackBand, mats.brassMat);
    band1.position.set(0.68, 1.85, -0.45);
    model.add(stack1, band1);

    const stack2 = new THREE.Mesh(geoCache.smokestack, mats.stoneMat);
    stack2.scale.set(0.85, 0.85, 0.85);
    stack2.position.set(0.32, 0.88, -0.45);
    model.add(stack2);

    const win1 = new THREE.Mesh(geoCache.windowStrip, mats.glowWindowMat);
    win1.position.set(-0.55, 0.65, 0.74);
    const win2 = new THREE.Mesh(geoCache.windowStrip, mats.glowWindowMat);
    win2.position.set(0.05, 0.65, 0.74);
    model.add(win1, win2);

    const crate1 = new THREE.Mesh(geoCache.crate, mats.timberMat);
    crate1.position.set(-0.75, 0.24, 0.9);
    const crate2 = new THREE.Mesh(geoCache.crate, mats.timberMat);
    crate2.position.set(-0.42, 0.24, 0.92);
    model.add(crate1, crate2);

    // Rising steam puff
    const puff = new THREE.Mesh(geoCache.smokePuff, smokeMat);
    puff.position.set(0.68, 2.15, -0.45);
    model.add(puff);
    animatedParts.push({ object: puff, kind: 'smoke', phase: phaseSeed, baseY: 2.1 });
  } else if (category === 'infrastructure') {
    const wall = new THREE.Mesh(geoCache.basinWall, mats.stoneMat);
    wall.position.set(0, 0.36, 0.15);
    model.add(wall);

    const water = new THREE.Mesh(geoCache.basinWater, waterPoolMat);
    water.position.set(0, 0.48, 0.15);
    model.add(water);

    for (const px of [-0.75, 0, 0.75]) {
      const pier = new THREE.Mesh(geoCache.archPier, mats.sandstoneMat);
      pier.position.set(px, 0.75, -0.78);
      model.add(pier);
    }

    const archTop = new THREE.Mesh(geoCache.archTop, mats.sandstoneMat);
    archTop.position.set(0, 1.48, -0.78);
    model.add(archTop);

    const valve = new THREE.Mesh(geoCache.valveWheel, mats.brassMat);
    valve.position.set(0.75, 0.72, 1.18);
    model.add(valve);
  } else if (category === 'energy') {
    const station = new THREE.Mesh(geoCache.substation, mats.sandstoneMat);
    station.position.set(-0.55, 0.42, 0.35);
    model.add(station);

    const indicator = new THREE.Mesh(geoCache.windowStrip, mats.glowWindowMat);
    indicator.position.set(-0.55, 0.5, 0.79);
    model.add(indicator);

    // 4 angled reflective solar panels
    for (let sx = 0; sx < 2; sx++) {
      for (let sz = 0; sz < 2; sz++) {
        const px = 0.22 + sx * 0.78;
        const pz = -0.35 + sz * 0.72;
        const mount = new THREE.Mesh(geoCache.solarMount, mats.steelMat);
        mount.position.set(px, 0.32, pz);
        const panel = new THREE.Mesh(geoCache.solarPanel, mats.solarGlassMat);
        panel.position.set(px, 0.56, pz);
        panel.rotation.x = 0.42;
        model.add(mount, panel);
      }
    }

    // Wind turbine mast & spinning rotor
    const mast = new THREE.Mesh(geoCache.turbineMast, mats.steelMat);
    mast.position.set(-0.65, 1.4, -0.55);
    model.add(mast);

    const rotor = new THREE.Group();
    rotor.position.set(-0.65, 2.65, -0.4);
    const hub = new THREE.Mesh(geoCache.turbineHub, mats.brassMat);
    rotor.add(hub);
    for (let b = 0; b < 3; b++) {
      const bladePivot = new THREE.Group();
      bladePivot.rotation.z = (b * Math.PI * 2) / 3;
      const blade = new THREE.Mesh(geoCache.turbineBlade, mats.steelMat);
      blade.position.y = 0.52;
      bladePivot.add(blade);
      rotor.add(bladePivot);
    }
    model.add(rotor);
    animatedParts.push({ object: rotor, kind: 'turbine', phase: phaseSeed, baseY: 2.65 });
  } else if (category === 'health') {
    const main = new THREE.Mesh(geoCache.hallMain, mats.sandstoneMat);
    main.position.set(0, 0.58, 0);
    model.add(main);

    const wing = new THREE.Mesh(geoCache.hallWing, mats.sandstoneMat);
    wing.position.set(0, 0.46, 0.1);
    model.add(wing);

    const dome = new THREE.Mesh(geoCache.dome, mats.tealRoofMat);
    dome.position.set(0, 1.05, 0);
    model.add(dome);

    const crossV = new THREE.Mesh(geoCache.windowStrip, mats.terracottaRoofMat);
    crossV.scale.set(0.7, 1.4, 1);
    crossV.position.set(0, 0.72, 0.7);
    const crossH = new THREE.Mesh(geoCache.windowStrip, mats.terracottaRoofMat);
    crossH.scale.set(1.4, 0.5, 1);
    crossH.position.set(0, 0.72, 0.7);
    model.add(crossV, crossH);

    for (const px of [-0.55, 0.55]) {
      const col = new THREE.Mesh(geoCache.pillar, mats.stoneMat);
      col.position.set(px, 0.52, 0.78);
      model.add(col);
    }
  } else if (category === 'science') {
    const main = new THREE.Mesh(geoCache.hallMain, mats.stoneMat);
    main.position.set(0, 0.58, 0);
    model.add(main);

    const dome = new THREE.Mesh(geoCache.dome, mats.brassMat);
    dome.scale.set(1.15, 1.2, 1.15);
    dome.position.set(0, 1.05, 0);
    model.add(dome);

    const scope = new THREE.Mesh(geoCache.telescope, mats.steelMat);
    scope.rotation.z = -0.65;
    scope.rotation.y = 0.4;
    scope.position.set(0.32, 1.56, 0.18);
    model.add(scope);

    for (const wx of [-0.45, 0, 0.45]) {
      const win = new THREE.Mesh(geoCache.windowStrip, mats.glowWindowMat);
      win.position.set(wx, 0.62, 0.7);
      model.add(win);
    }
  } else {
    // civic
    const main = new THREE.Mesh(geoCache.hallMain, mats.sandstoneMat);
    main.position.set(0, 0.6, 0);
    model.add(main);

    const wing = new THREE.Mesh(geoCache.hallWing, mats.stoneMat);
    wing.position.set(0, 0.46, 0);
    model.add(wing);

    const spire = new THREE.Mesh(geoCache.spire, mats.brassMat);
    spire.position.set(0, 1.62, 0);
    model.add(spire);

    for (const px of [-0.62, -0.22, 0.22, 0.62]) {
      const col = new THREE.Mesh(geoCache.pillar, mats.sandstoneMat);
      col.position.set(px, 0.54, 0.74);
      model.add(col);
    }
  }

  return model;
}

export function createBuildingGroup(
  building: Building,
  mats: IslandMaterialLibrary,
  isSoftwareGl: boolean
): BuiltStructureResult {
  const group = new THREE.Group();
  group.name = `building_${building.id}`;

  const { x, z } = percentToWorldXZ(building.xPercent, building.yPercent);
  const groundY = Math.max(WATER_LEVEL + 0.14, getIslandHeight(x, z));
  group.position.set(x, groundY, z);

  // Subtle deterministic rotation aligned gently with island valley
  const hash = building.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  group.rotation.y = ((hash % 8) - 4) * 0.12;

  const animatedParts: AnimatedBuildingPart[] = [];

  // Radial soft contact shadow under building plinth
  const contactShadow = new THREE.Mesh(
    geoCache.shadowPlane,
    new THREE.MeshBasicMaterial({
      map: mats.contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.75,
    })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.04;
  group.add(contactShadow);

  // Deep stone plinth foundation extending below terrain slope so nothing floats
  const plinth = new THREE.Mesh(geoCache.plinth, mats.stoneMat);
  plinth.position.y = -0.34;
  group.add(plinth);

  if (building.status === 'planned') {
    const ghost = new THREE.Mesh(geoCache.blueprintCube, mats.blueprintWireMat);
    ghost.position.y = 0.8;
    group.add(ghost);

    for (const cx of [-1.05, 1.05]) {
      for (const cz of [-1.05, 1.05]) {
        const stake = new THREE.Mesh(geoCache.fencePost, mats.brassMat);
        stake.position.set(cx, 0.3, cz);
        group.add(stake);
      }
    }
  } else {
    const model = buildCategoryDetails(building.category, mats, animatedParts, hash * 0.37);

    if (building.status === 'constructing') {
      const progressFrac = Math.max(0.32, Math.min(1, building.progress / 100));
      model.scale.y = progressFrac;

      // Timber scaffolding posts
      for (const sx of [-1.05, 1.05]) {
        for (const sz of [-0.95, 0.95]) {
          const post = new THREE.Mesh(geoCache.scaffoldPost, mats.scaffoldMat);
          post.position.set(sx, 0.8, sz);
          group.add(post);
        }
      }

      // Rotating construction crane
      const craneGroup = new THREE.Group();
      craneGroup.position.set(-1.05, 0.12, -0.95);
      const mast = new THREE.Mesh(geoCache.craneMast, mats.brassMat);
      mast.position.y = 1.1;
      const boomPivot = new THREE.Group();
      boomPivot.position.y = 2.15;
      const boom = new THREE.Mesh(geoCache.craneBoom, mats.brassMat);
      boom.position.x = 0.55;
      boomPivot.add(boom);
      craneGroup.add(mast, boomPivot);
      group.add(craneGroup);
      animatedParts.push({ object: boomPivot, kind: 'crane', phase: hash * 0.5, baseY: 2.15 });
    }

    group.add(model);
  }

  addCastReceive(group, !isSoftwareGl);

  // Invisible simplified raycast proxy box on layer 1
  const hitProxy = new THREE.Mesh(geoCache.hitBox, hitProxyMat);
  hitProxy.position.y = 1.25;
  hitProxy.layers.set(1);
  hitProxy.userData.buildingId = building.id;
  group.add(hitProxy);

  const levelScale =
    BUILDING_WORLD_SCALE * (1 + Math.min(0.28, Math.max(0, building.level - 1) * 0.06));

  // Precise OBB collision bounds matching visible structure footprint at human scale
  const footprintHalf = building.status === 'planned' ? 1.05 * levelScale : 1.08 * levelScale;
  const plinthTopY = groundY + 0.14 * levelScale;
  const wallTopY = groundY + (building.category === 'energy' ? 2.6 : 1.8) * levelScale;

  return {
    group,
    hitProxy,
    animatedParts,
    targetScale: levelScale,
    collider: {
      buildingId: building.id,
      x,
      z,
      yaw: group.rotation.y,
      halfW: footprintHalf,
      halfD: footprintHalf,
      plinthHalfW: 1.38 * levelScale,
      plinthTopY,
      wallTopY,
    },
  };
}

export function createSelectionBeacon(): THREE.Group {
  const beacon = new THREE.Group();
  beacon.name = 'selectionBeacon';

  const ringGeo = new THREE.RingGeometry(3.8, 4.35, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: '#fbbf24',
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.22;
  beacon.add(ring);

  const outerGeo = new THREE.RingGeometry(4.55, 4.78, 32);
  outerGeo.rotateX(-Math.PI / 2);
  const outerMat = new THREE.MeshBasicMaterial({
    color: '#34d399',
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.55,
  });
  const outer = new THREE.Mesh(outerGeo, outerMat);
  outer.position.y = 0.2;
  beacon.add(outer);

  beacon.visible = false;
  return beacon;
}
