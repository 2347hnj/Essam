import * as THREE from 'three';
import { IslandMaterialLibrary } from './islandMaterials';

export interface PlayerCharacterRig {
  root: THREE.Group;
  contactShadow: THREE.Mesh;
  setJacketColor: (hex: string) => void;
  setDisplayNameTag: (name: string) => void;
  updateAnimation: (
    delta: number,
    horizontalSpeed: number,
    isSprinting: boolean,
    isGrounded: boolean,
    verticalVel: number,
    heightAboveGround: number
  ) => void;
  dispose: () => void;
}

export interface PlayerCharacterOptions {
  jacketColor?: string;
  trimColor?: string;
  displayNameTag?: string;
}

function drawNameTagTexture(label: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 68;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(7, 17, 24, 0.84)';
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.72)';
    ctx.lineWidth = 3;
    const r = 14;
    ctx.beginPath();
    ctx.roundRect(8, 8, canvas.width - 16, canvas.height - 16, r);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 24px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label.slice(0, 22), canvas.width / 2, canvas.height / 2 + 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createPlayerCharacter(
  mats: IslandMaterialLibrary,
  isSoftwareGl: boolean,
  options?: PlayerCharacterOptions
): PlayerCharacterRig {
  const root = new THREE.Group();
  root.name = 'playerCharacter';

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // Distinct PBR materials for player readability against green terrain & stone roads
  const skinMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#eec39a', roughness: 0.68, metalness: 0.02 })
  );
  const jacketMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: options?.jacketColor || '#1b6b63',
      roughness: 0.72,
      metalness: 0.06,
    })
  );
  const jacketTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: options?.trimColor || '#e2a33a',
      roughness: 0.45,
      metalness: 0.25,
    })
  );
  const trouserMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#243546', roughness: 0.82, metalness: 0.04 })
  );
  const bootMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#4d301d', roughness: 0.58, metalness: 0.08 })
  );
  const hairMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#2b201b', roughness: 0.86, metalness: 0.04 })
  );
  const packMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#8a5d3b', roughness: 0.78, metalness: 0.05 })
  );
  const eyeMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.3, metalness: 0.1 })
  );

  // Dynamic ground contact shadow directly beneath feet
  const shadowGeo = trackGeo(new THREE.PlaneGeometry(1.18, 1.18));
  const shadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: mats.contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.78,
    })
  );
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.04;
  root.add(contactShadow);

  // Pelvis & Waist (pivot y = 0.84 -> legs span down 0.84m to sole at y = 0)
  const pelvisGroup = new THREE.Group();
  pelvisGroup.position.y = 0.84;
  root.add(pelvisGroup);

  const pelvisMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.36, 0.14, 0.22)), trouserMat);
  pelvisGroup.add(pelvisMesh);

  const beltMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.38, 0.06, 0.24)), bootMat);
  beltMesh.position.y = 0.05;
  pelvisGroup.add(beltMesh);

  const buckleMesh = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.08, 0.055, 0.04)),
    jacketTrimMat
  );
  buckleMesh.position.set(0, 0.05, 0.12);
  pelvisGroup.add(buckleMesh);

  // Articulated Torso + Explorer Backpack + Neck/Head
  const torsoPivot = new THREE.Group();
  torsoPivot.position.y = 0.07;
  pelvisGroup.add(torsoPivot);

  const chestMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.42, 0.52, 0.24)), jacketMat);
  chestMesh.position.y = 0.26;
  torsoPivot.add(chestMesh);

  const collarMesh = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.12, 0.15, 0.07, 10)),
    jacketTrimMat
  );
  collarMesh.position.y = 0.52;
  torsoPivot.add(collarMesh);

  // Explorer backpack (-Z is back, +Z is forward)
  const packMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.28, 0.36, 0.14)), packMat);
  packMesh.position.set(0, 0.29, -0.17);
  torsoPivot.add(packMesh);

  const bedrollGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.055, 0.3, 10));
  bedrollGeo.rotateZ(Math.PI / 2);
  const bedrollMesh = new THREE.Mesh(bedrollGeo, jacketTrimMat);
  bedrollMesh.position.set(0, 0.48, -0.17);
  torsoPivot.add(bedrollMesh);

  // Head group (+Z is face forward)
  const headPivot = new THREE.Group();
  headPivot.position.y = 0.55;
  torsoPivot.add(headPivot);

  const neckMesh = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.065, 0.075, 0.09, 8)),
    skinMat
  );
  neckMesh.position.y = 0.03;
  headPivot.add(neckMesh);

  const craniumMesh = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.145, 14, 12)), skinMat);
  craniumMesh.position.y = 0.18;
  craniumMesh.scale.set(0.94, 1.05, 0.98);
  headPivot.add(craniumMesh);

  const hairCapMesh = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.154, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.56)),
    hairMat
  );
  hairCapMesh.position.set(0, 0.2, -0.015);
  hairCapMesh.rotation.x = -0.18;
  headPivot.add(hairCapMesh);

  const eyeGeo = trackGeo(new THREE.BoxGeometry(0.028, 0.022, 0.02));
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.048, 0.19, 0.135);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.048, 0.19, 0.135);
  headPivot.add(leftEye, rightEye);

  // Articulated Arms (Shoulder -> Upper Arm -> Elbow -> Forearm + Hand)
  const upperArmGeo = trackGeo(new THREE.CylinderGeometry(0.056, 0.048, 0.27, 8));
  upperArmGeo.translate(0, -0.135, 0);
  const forearmGeo = trackGeo(new THREE.CylinderGeometry(0.046, 0.04, 0.24, 8));
  forearmGeo.translate(0, -0.12, 0);
  const handGeo = trackGeo(new THREE.SphereGeometry(0.045, 8, 8));

  const makeArm = (side: -1 | 1) => {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * 0.265, 0.47, 0);
    torsoPivot.add(shoulderPivot);

    const upper = new THREE.Mesh(upperArmGeo, jacketMat);
    shoulderPivot.add(upper);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.y = -0.26;
    shoulderPivot.add(elbowPivot);

    const forearm = new THREE.Mesh(forearmGeo, skinMat);
    elbowPivot.add(forearm);

    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.y = -0.25;
    elbowPivot.add(hand);

    return { shoulderPivot, elbowPivot };
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // Articulated Legs (Hip -> Thigh -> Knee -> Shin + Boot with toe pointing +Z)
  const thighGeo = trackGeo(new THREE.CylinderGeometry(0.075, 0.062, 0.4, 8));
  thighGeo.translate(0, -0.2, 0);
  const shinGeo = trackGeo(new THREE.CylinderGeometry(0.06, 0.048, 0.34, 8));
  shinGeo.translate(0, -0.17, 0);
  const bootGeo = trackGeo(new THREE.BoxGeometry(0.115, 0.11, 0.21));
  bootGeo.translate(0, -0.385, 0.035);

  const makeLeg = (side: -1 | 1) => {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(side * 0.105, -0.02, 0);
    pelvisGroup.add(hipPivot);

    const thigh = new THREE.Mesh(thighGeo, trouserMat);
    hipPivot.add(thigh);

    const kneePivot = new THREE.Group();
    kneePivot.position.y = -0.39;
    hipPivot.add(kneePivot);

    const shin = new THREE.Mesh(shinGeo, trouserMat);
    kneePivot.add(shin);

    const boot = new THREE.Mesh(bootGeo, bootMat);
    kneePivot.add(boot);

    return { hipPivot, kneePivot };
  };

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  // Shadows
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh && obj !== contactShadow) {
      obj.castShadow = !isSoftwareGl;
      obj.receiveShadow = true;
    }
  });

  // Procedural animation state
  let gaitPhase = 0;
  let idleTime = 0;
  let smoothSpeedNorm = 0;
  let smoothAirBlend = 0;
  let landingSquash = 0;
  let wasGrounded = true;

  const updateAnimation = (
    delta: number,
    horizontalSpeed: number,
    isSprinting: boolean,
    isGrounded: boolean,
    verticalVel: number,
    heightAboveGround: number
  ) => {
    idleTime += delta;

    // Detect landing impulse for subtle knee absorb
    if (!wasGrounded && isGrounded) {
      landingSquash = 0.14;
    }
    wasGrounded = isGrounded;
    landingSquash = THREE.MathUtils.damp(landingSquash, 0, 11, delta);

    // Normalized speed: 0 = idle, ~0.5 = walk, ~1.0 = run
    const targetNorm = Math.min(
      1,
      horizontalSpeed / (isSprinting ? 8.8 : 9.2)
    );
    smoothSpeedNorm = THREE.MathUtils.damp(smoothSpeedNorm, targetNorm, 10, delta);
    smoothAirBlend = THREE.MathUtils.damp(smoothAirBlend, isGrounded ? 0 : 1, 12, delta);

    // Advance gait phase smoothly proportional to movement speed
    if (smoothSpeedNorm > 0.04) {
      const freq = THREE.MathUtils.lerp(5.2, 10.2, smoothSpeedNorm);
      gaitPhase += delta * freq;
    }

    const walkSin = Math.sin(gaitPhase);
    const walkCos = Math.cos(gaitPhase);

    // Idle breathing + weight shift
    const breath = Math.sin(idleTime * 2.2) * 0.012;
    const idleArmSway = Math.sin(idleTime * 1.6) * 0.04;

    // Grounded stride angles scaled by movement intensity
    const strideAmp = THREE.MathUtils.lerp(0.0, 0.88, smoothSpeedNorm);
    const lHipGround = walkSin * strideAmp;
    const rHipGround = -walkSin * strideAmp;

    // Knee bends positively backwards when leg swings back/lifts
    const lKneeGround = Math.max(0, -walkCos) * (0.35 + smoothSpeedNorm * 0.72);
    const rKneeGround = Math.max(0, walkCos) * (0.35 + smoothSpeedNorm * 0.72);

    // Opposite arms swing counter to legs, elbows flex faster during sprint
    const armAmp = THREE.MathUtils.lerp(0.04, 0.95, smoothSpeedNorm);
    const lShoulderGround = -walkSin * armAmp + idleArmSway * (1 - smoothSpeedNorm);
    const rShoulderGround = walkSin * armAmp - idleArmSway * (1 - smoothSpeedNorm);
    const baseElbowFlex = THREE.MathUtils.lerp(-0.14, -1.05, smoothSpeedNorm);
    const lElbowGround = baseElbowFlex - Math.max(0, -walkSin) * smoothSpeedNorm * 0.45;
    const rElbowGround = baseElbowFlex - Math.max(0, walkSin) * smoothSpeedNorm * 0.45;

    // Airborne pose (GTA-like athletic mid-air tuck)
    const riseSign = THREE.MathUtils.clamp(verticalVel / 8, -1, 1);
    const lHipAir = -0.58 + riseSign * 0.12;
    const rHipAir = 0.34 - riseSign * 0.1;
    const lKneeAir = 0.85;
    const rKneeAir = 0.42;
    const lShoulderAir = -0.65;
    const rShoulderAir = 0.45;
    const lElbowAir = -0.55;
    const rElbowAir = -0.65;

    // Blend Grounded <-> Airborne
    leftLeg.hipPivot.rotation.x = THREE.MathUtils.lerp(lHipGround, lHipAir, smoothAirBlend);
    rightLeg.hipPivot.rotation.x = THREE.MathUtils.lerp(rHipGround, rHipAir, smoothAirBlend);
    leftLeg.kneePivot.rotation.x = THREE.MathUtils.lerp(lKneeGround, lKneeAir, smoothAirBlend);
    rightLeg.kneePivot.rotation.x = THREE.MathUtils.lerp(rKneeGround, rKneeAir, smoothAirBlend);

    leftArm.shoulderPivot.rotation.x = THREE.MathUtils.lerp(
      lShoulderGround,
      lShoulderAir,
      smoothAirBlend
    );
    rightArm.shoulderPivot.rotation.x = THREE.MathUtils.lerp(
      rShoulderGround,
      rShoulderAir,
      smoothAirBlend
    );
    leftArm.shoulderPivot.rotation.z = THREE.MathUtils.lerp(-0.07, -0.32, smoothAirBlend);
    rightArm.shoulderPivot.rotation.z = THREE.MathUtils.lerp(0.07, 0.32, smoothAirBlend);

    leftArm.elbowPivot.rotation.x = THREE.MathUtils.lerp(lElbowGround, lElbowAir, smoothAirBlend);
    rightArm.elbowPivot.rotation.x = THREE.MathUtils.lerp(rElbowGround, rElbowAir, smoothAirBlend);

    // Torso forward lean during sprint + natural counter-twist + landing bob
    const runLean = THREE.MathUtils.lerp(0.01, 0.22, smoothSpeedNorm) * (1 - smoothAirBlend * 0.4);
    torsoPivot.rotation.x = runLean;
    torsoPivot.rotation.y = walkSin * smoothSpeedNorm * 0.12 * (1 - smoothAirBlend);
    headPivot.rotation.x = -runLean * 0.55 + breath * 1.4;
    headPivot.rotation.y = -torsoPivot.rotation.y * 0.65;

    const strideBob =
      Math.abs(Math.sin(gaitPhase)) * smoothSpeedNorm * 0.055 * (1 - smoothAirBlend);
    pelvisGroup.position.y = 0.84 + strideBob + breath - landingSquash;

    // Keep contact shadow pinned to ground plane below jumping character
    contactShadow.position.y = -Math.max(0, heightAboveGround) + 0.04;
    const shadowScale = Math.max(0.42, 1 - heightAboveGround * 0.14);
    contactShadow.scale.setScalar(shadowScale);
    shadowMat.opacity = Math.max(0.22, 0.78 - heightAboveGround * 0.12);
  };

  let nameSprite: THREE.Sprite | null = null;
  let nameTex: THREE.CanvasTexture | null = null;
  let nameMat: THREE.SpriteMaterial | null = null;
  let currentTag = '';

  const setDisplayNameTag = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      if (nameSprite) nameSprite.visible = false;
      return;
    }
    if (trimmed === currentTag && nameSprite) {
      nameSprite.visible = true;
      return;
    }
    currentTag = trimmed;
    if (nameTex) nameTex.dispose();
    nameTex = drawNameTagTexture(trimmed);
    textures.push(nameTex);
    if (!nameMat) {
      nameMat = trackMat(
        new THREE.SpriteMaterial({
          map: nameTex,
          transparent: true,
          depthTest: false,
          depthWrite: false,
        })
      );
    } else {
      nameMat.map = nameTex;
      nameMat.needsUpdate = true;
    }
    if (!nameSprite) {
      nameSprite = new THREE.Sprite(nameMat);
      nameSprite.position.set(0, 2.25, 0);
      nameSprite.scale.set(1.55, 0.34, 1);
      nameSprite.renderOrder = 10;
      root.add(nameSprite);
    }
    nameSprite.visible = true;
  };

  if (options?.displayNameTag) {
    setDisplayNameTag(options.displayNameTag);
  }

  return {
    root,
    contactShadow,
    setJacketColor: (hex: string) => {
      try {
        jacketMat.color.set(hex);
      } catch {
        // Ignore invalid hex color strings
      }
    },
    setDisplayNameTag,
    updateAnimation,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
