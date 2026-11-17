import * as THREE from 'three';

export interface IslandMaterialLibrary {
  terrainDetailTex: THREE.CanvasTexture;
  waterRippleTex: THREE.CanvasTexture;
  cobbleTex: THREE.CanvasTexture;
  cropFurrowTex: THREE.CanvasTexture;
  contactShadowTex: THREE.CanvasTexture;
  stoneMat: THREE.MeshStandardMaterial;
  darkStoneMat: THREE.MeshStandardMaterial;
  sandstoneMat: THREE.MeshStandardMaterial;
  timberMat: THREE.MeshStandardMaterial;
  terracottaRoofMat: THREE.MeshStandardMaterial;
  tealRoofMat: THREE.MeshStandardMaterial;
  steelMat: THREE.MeshStandardMaterial;
  solarGlassMat: THREE.MeshStandardMaterial;
  brassMat: THREE.MeshStandardMaterial;
  cropMat: THREE.MeshStandardMaterial;
  glowWindowMat: THREE.MeshStandardMaterial;
  blueprintWireMat: THREE.MeshBasicMaterial;
  scaffoldMat: THREE.MeshStandardMaterial;
  dispose: () => void;
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function createTerrainDetailTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256);
  ctx.fillStyle = '#e8ece8';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle organic grain
  for (let i = 0; i < 3600; i++) {
    const x = (i * 73) % 256;
    const y = (i * 137) % 256;
    const v = 212 + ((i * 29) % 36);
    ctx.fillStyle = `rgb(${v},${v + 2},${v - 2})`;
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createWaterRippleTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 4) {
    for (let x = 0; x < 256; x += 4) {
      const wave =
        Math.sin((x / 256) * Math.PI * 6) * Math.cos((y / 256) * Math.PI * 6) * 0.5 + 0.5;
      const g = Math.round(90 + wave * 90);
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(x, y, 4, 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createCobbleTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128);
  ctx.fillStyle = '#8b7b63';
  ctx.fillRect(0, 0, 128, 128);

  // Warm stone pavers
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 4; col++) {
      const x = col * 32 + (row % 2) * 16;
      const y = row * 16;
      const shade = 148 + ((row * 7 + col * 13) % 28);
      ctx.fillStyle = `rgb(${shade},${shade - 12},${shade - 26})`;
      ctx.fillRect((x + 2) % 128, y + 2, 26, 12);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createCropFurrowTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128);
  ctx.fillStyle = '#47331f';
  ctx.fillRect(0, 0, 128, 128);

  for (let y = 0; y < 128; y += 16) {
    ctx.fillStyle = y % 32 === 0 ? '#5c9338' : '#b7973c';
    ctx.fillRect(0, y + 3, 128, 9);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128);
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(3, 10, 14, 0.62)');
  grad.addColorStop(0.55, 'rgba(3, 10, 14, 0.28)');
  grad.addColorStop(1, 'rgba(3, 10, 14, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createIslandMaterialLibrary(renderer: THREE.WebGLRenderer): IslandMaterialLibrary {
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);

  const terrainDetailTex = createTerrainDetailTexture(maxAniso);
  const waterRippleTex = createWaterRippleTexture(maxAniso);
  const cobbleTex = createCobbleTexture(maxAniso);
  const cropFurrowTex = createCropFurrowTexture(maxAniso);
  const contactShadowTex = createContactShadowTexture();

  const stoneMat = new THREE.MeshStandardMaterial({
    color: '#9aa4aa',
    roughness: 0.85,
    metalness: 0.06,
  });

  const darkStoneMat = new THREE.MeshStandardMaterial({
    color: '#525f68',
    roughness: 0.88,
    metalness: 0.08,
  });

  const sandstoneMat = new THREE.MeshStandardMaterial({
    color: '#d8cbb0',
    roughness: 0.78,
    metalness: 0.04,
  });

  const timberMat = new THREE.MeshStandardMaterial({
    color: '#7c5333',
    roughness: 0.82,
    metalness: 0.04,
  });

  const terracottaRoofMat = new THREE.MeshStandardMaterial({
    color: '#b85a3a',
    roughness: 0.68,
    metalness: 0.08,
  });

  const tealRoofMat = new THREE.MeshStandardMaterial({
    color: '#2c7e74',
    roughness: 0.58,
    metalness: 0.14,
  });

  const steelMat = new THREE.MeshStandardMaterial({
    color: '#c4cdd4',
    roughness: 0.28,
    metalness: 0.78,
  });

  const solarGlassMat = new THREE.MeshStandardMaterial({
    color: '#193a5e',
    roughness: 0.14,
    metalness: 0.86,
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: '#d9a441',
    roughness: 0.22,
    metalness: 0.88,
  });

  const cropMat = new THREE.MeshStandardMaterial({
    map: cropFurrowTex,
    roughness: 0.86,
    metalness: 0.02,
  });

  const glowWindowMat = new THREE.MeshStandardMaterial({
    color: '#ffcf70',
    emissive: '#f59e0b',
    emissiveIntensity: 0.75,
    roughness: 0.25,
    metalness: 0.1,
  });

  const blueprintWireMat = new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    wireframe: true,
    transparent: true,
    opacity: 0.7,
  });

  const scaffoldMat = new THREE.MeshStandardMaterial({
    color: '#d2a25e',
    roughness: 0.85,
    metalness: 0.05,
  });

  const textures = [
    terrainDetailTex,
    waterRippleTex,
    cobbleTex,
    cropFurrowTex,
    contactShadowTex,
  ];
  const materials = [
    stoneMat,
    darkStoneMat,
    sandstoneMat,
    timberMat,
    terracottaRoofMat,
    tealRoofMat,
    steelMat,
    solarGlassMat,
    brassMat,
    cropMat,
    glowWindowMat,
    blueprintWireMat,
    scaffoldMat,
  ];

  return {
    terrainDetailTex,
    waterRippleTex,
    cobbleTex,
    cropFurrowTex,
    contactShadowTex,
    stoneMat,
    darkStoneMat,
    sandstoneMat,
    timberMat,
    terracottaRoofMat,
    tealRoofMat,
    steelMat,
    solarGlassMat,
    brassMat,
    cropMat,
    glowWindowMat,
    blueprintWireMat,
    scaffoldMat,
    dispose: () => {
      textures.forEach((t) => t.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
