import {
  Compass,
  Crosshair,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Settings,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { formatEffectList, TRANSLATIONS } from '../i18n/translations';
import { AVATAR_COLOR_PALETTE, toMillis } from '../lib/worldService';
import {
  AnimatedBuildingPart,
  BuildingCollider,
  createBuildingGroup,
  createSelectionBeacon,
} from '../three/buildingFactory';
import {
  CircleCollider,
  CitizenCrowdSystem,
  createCitizenCrowdSystem,
  createForestAndRocks,
  createOceanSystem,
  ForestSystem,
  OceanSystem,
} from '../three/environmentBuilder';
import { createIslandMaterialLibrary, IslandMaterialLibrary } from '../three/islandMaterials';
import {
  buildSettlementRoadPaths,
  createRiverMesh,
  createRoadNetworkMesh,
  createTerrainMesh,
  getIslandHeight,
  getIslandSlopeInfo,
  percentToWorldXZ,
  RoadPathLoop,
  TERRAIN_SCALE_XY,
  WATER_LEVEL,
  worldXZToPercent,
} from '../three/islandTerrain';
import { createPlayerCharacter, PlayerCharacterRig } from '../three/playerCharacter';
import {
  Building,
  CitizenProfile,
  CitizenWorldPosition,
  Civilization,
  Lang,
  WorldPresence,
} from '../types/world';

interface Island3DCanvasProps {
  lang: Lang;
  buildings: Building[];
  allBuildings: Building[];
  civ: Civilization | null;
  citizen: CitizenProfile | null;
  totalRegistered: number;
  onlineCitizens: WorldPresence[];
  selectedBuildingId: string | null;
  focusRequestTick: number;
  pickMode: boolean;
  worldFullscreen: boolean;
  onEnterWorld: () => void;
  onExitWorld: () => void;
  onSelectBuilding: (id: string | null) => void;
  onPickCoordinate?: (xPercent: number, yPercent: number) => void;
  onSaveWorldPosition?: (pos: CitizenWorldPosition, xpGain?: number) => void;
  onUpdatePresence?: (state: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    speed: number;
    isInWorld: boolean;
  }) => void;
  onUpdateAvatarColor?: (color: string) => void;
}

const _pointerNdc = new THREE.Vector2();

const PLAYER_RADIUS = 0.42;
const GRAVITY = -24.0;
const JUMP_SPEED = 9.4;
const WALK_SPEED = 4.6;
const RUN_SPEED = 9.2;

const TOUCH_DEADZONE_Y = 12;
const TOUCH_DEADZONE_X = 14;
const TOUCH_MAX_DRAG_Y = 115;
const TOUCH_MAX_DRAG_X = 120;

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function detectTouchCapability(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia?.('(pointer: coarse)').matches ||
    window.innerWidth < 1024
  );
}

function isFreshPresence(p: WorldPresence): boolean {
  if (!p.isOnline) return false;
  const ms = toMillis(p.lastSeenAt);
  return ms === 0 || Date.now() - ms < 95000;
}

export function Island3DCanvas({
  lang,
  buildings,
  allBuildings,
  civ,
  citizen,
  totalRegistered,
  onlineCitizens,
  selectedBuildingId,
  focusRequestTick,
  pickMode,
  worldFullscreen,
  onEnterWorld,
  onExitWorld,
  onSelectBuilding,
  onPickCoordinate,
  onSaveWorldPosition,
  onUpdatePresence,
  onUpdateAvatarColor,
}: Island3DCanvasProps) {
  const t = TRANSLATIONS[lang];
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);

  const [hoveredBuildingId, setHoveredBuildingId] = useState<string | null>(null);
  const [nearbyBuildingId, setNearbyBuildingId] = useState<string | null>(null);
  const [inspectOpenInWorld, setInspectOpenInWorld] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [touchSensitivity, setTouchSensitivity] = useState<number>(1.0);
  const [webglError, setWebglError] = useState(false);
  const [isTouchDevice] = useState<boolean>(detectTouchCapability);

  const defaultEco =
    typeof window !== 'undefined' &&
    (window.innerWidth < 768 || (navigator.hardwareConcurrency || 8) <= 4);
  const [ecoMode, setEcoMode] = useState<boolean>(defaultEco);

  const activeOnlineList = onlineCitizens.filter(isFreshPresence);
  const onlineCount = Math.max(citizen ? 1 : 0, activeOnlineList.length);
  const remoteWorldList = activeOnlineList.filter(
    (p) => p.uid !== citizen?.uid && p.isInWorld
  );

  // Synced refs for the continuous WebGL simulation loop
  const buildingsRef = useRef<Building[]>(buildings);
  const allBuildingsRef = useRef<Building[]>(allBuildings);
  const crowdTargetCountRef = useRef<number>(
    Math.max(0, totalRegistered - remoteWorldList.length - (worldFullscreen && citizen ? 1 : 0))
  );
  const citizenRef = useRef<CitizenProfile | null>(citizen);
  const remotePresenceRef = useRef<WorldPresence[]>(remoteWorldList);
  const selectedIdRef = useRef<string | null>(selectedBuildingId);
  const nearbyIdRef = useRef<string | null>(nearbyBuildingId);
  const pickModeRef = useRef<boolean>(pickMode);
  const worldFullscreenRef = useRef<boolean>(worldFullscreen);
  const ecoModeRef = useRef<boolean>(ecoMode);
  const touchSensitivityRef = useRef<number>(touchSensitivity);
  const inspectOpenRef = useRef<boolean>(inspectOpenInWorld);
  const onSelectRef = useRef(onSelectBuilding);
  const onPickRef = useRef(onPickCoordinate);
  const onExitWorldRef = useRef(onExitWorld);
  const onSaveWorldPosRef = useRef(onSaveWorldPosition);
  const onUpdatePresenceRef = useRef(onUpdatePresence);

  buildingsRef.current = buildings;
  allBuildingsRef.current = allBuildings;
  crowdTargetCountRef.current = Math.max(
    0,
    totalRegistered - remoteWorldList.length - (worldFullscreen && citizen ? 1 : 0)
  );
  citizenRef.current = citizen;
  remotePresenceRef.current = remoteWorldList;
  selectedIdRef.current = selectedBuildingId;
  nearbyIdRef.current = nearbyBuildingId;
  pickModeRef.current = pickMode;
  worldFullscreenRef.current = worldFullscreen;
  ecoModeRef.current = ecoMode;
  touchSensitivityRef.current = touchSensitivity;
  inspectOpenRef.current = inspectOpenInWorld;
  onSelectRef.current = onSelectBuilding;
  onPickRef.current = onPickCoordinate;
  onExitWorldRef.current = onExitWorld;
  onSaveWorldPosRef.current = onSaveWorldPosition;
  onUpdatePresenceRef.current = onUpdatePresence;

  const keysRef = useRef<Record<string, boolean>>({});
  const jumpBufferRef = useRef<number>(0);

  // Direct single-finger touch gesture state
  const touchGestureRef = useRef<{
    active: boolean;
    identifier: number | null;
    startX: number;
    startY: number;
    currX: number;
    currY: number;
    maxTravel: number;
  }>({
    active: false,
    identifier: null,
    startX: 0,
    startY: 0,
    currX: 0,
    currY: 0,
    maxTravel: 0,
  });

  const sceneApiRef = useRef<{
    adjustCameraZoom: (delta: number) => void;
    focusOnBuilding: (b: Building) => void;
    resetBehindPlayer: () => void;
    syncBuildings: (filtered: Building[], full: Building[]) => void;
    syncRemoteCitizens: (remotes: WorldPresence[]) => void;
    setPlayerPosAndColor: (pos?: CitizenWorldPosition, color?: string) => void;
    setPlayerColorOnly: (color: string) => void;
    getPlayerPose: () => CitizenWorldPosition;
    updateQuality: (eco: boolean) => void;
    raycastTapAt: (clientX: number, clientY: number) => void;
  } | null>(null);

  const restoredUidRef = useRef<string | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    const wrapper = wrapperRef.current;
    if (!container || !wrapper) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, ecoModeRef.current ? 1.25 : 1.75)
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initW = Math.max(300, container.clientWidth);
    const initH = Math.max(240, container.clientHeight);
    renderer.setSize(initW, initH);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError(true);
    };
    const onContextRestored = () => {
      setWebglError(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#071a26');
    scene.fog = new THREE.FogExp2('#071a26', 0.0028);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(48, initW / initH, 0.35, 360);

    const hemiLight = new THREE.HemisphereLight('#8cd6fa', '#1e3e2f', 0.88);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight('#fff1d2', 2.05);
    sunLight.position.set(42, 68, 36);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = ecoModeRef.current ? 1024 : 2048;
    sunLight.shadow.mapSize.height = ecoModeRef.current ? 1024 : 2048;
    sunLight.shadow.camera.near = 6;
    sunLight.shadow.camera.far = 190;
    const shadowBound = 68;
    sunLight.shadow.camera.left = -shadowBound;
    sunLight.shadow.camera.right = shadowBound;
    sunLight.shadow.camera.top = shadowBound;
    sunLight.shadow.camera.bottom = -shadowBound;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.04;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight('#52b0d6', 0.55);
    rimLight.position.set(-45, 28, -42);
    scene.add(rimLight);

    const uTime = { value: 0 };

    const mats: IslandMaterialLibrary = createIslandMaterialLibrary(renderer);
    const terrainMesh = createTerrainMesh(mats.terrainDetailTex);
    scene.add(terrainMesh);

    const riverMesh = createRiverMesh(mats.waterRippleTex, uTime);
    scene.add(riverMesh);

    const oceanSys: OceanSystem = createOceanSystem(mats, uTime);
    scene.add(oceanSys.mesh);
    scene.add(oceanSys.boatsGroup);

    const forestSys: ForestSystem = createForestAndRocks(
      allBuildingsRef.current,
      uTime,
      isSoftwareGl
    );
    scene.add(forestSys.trunks);
    scene.add(forestSys.canopies);
    scene.add(forestSys.rocks);

    const obstacleColliders: CircleCollider[] = forestSys.colliders;

    const citizenSys: CitizenCrowdSystem = createCitizenCrowdSystem();
    scene.add(citizenSys.bodies);
    scene.add(citizenSys.heads);

    const playerRig: PlayerCharacterRig = createPlayerCharacter(mats, isSoftwareGl, {
      jacketColor: citizenRef.current?.avatarColor || '#1b6b63',
    });
    scene.add(playerRig.root);

    // Multiplayer Remote Citizen Avatars
    const remotePlayersGroup = new THREE.Group();
    scene.add(remotePlayersGroup);
    const remoteAvatars = new Map<
      string,
      {
        rig: PlayerCharacterRig;
        x: number;
        y: number;
        z: number;
        yaw: number;
        targetX: number;
        targetY: number;
        targetZ: number;
        targetYaw: number;
        targetSpeed: number;
      }
    >();

    const syncRemoteCitizens = (remotes: WorldPresence[]) => {
      const wanted = new Set(remotes.map((r) => r.uid));
      for (const [uid, entry] of remoteAvatars.entries()) {
        if (!wanted.has(uid)) {
          remotePlayersGroup.remove(entry.rig.root);
          entry.rig.dispose();
          remoteAvatars.delete(uid);
        }
      }

      for (const p of remotes) {
        const existing = remoteAvatars.get(p.uid);
        if (existing) {
          existing.targetX = p.x;
          existing.targetY = p.y;
          existing.targetZ = p.z;
          existing.targetYaw = p.yaw;
          existing.targetSpeed = p.speed;
          existing.rig.setJacketColor(p.avatarColor);
          existing.rig.setDisplayNameTag(`${p.displayName} (${p.citizenshipCode})`);
        } else {
          const rig = createPlayerCharacter(mats, isSoftwareGl, {
            jacketColor: p.avatarColor,
            displayNameTag: `${p.displayName} (${p.citizenshipCode})`,
          });
          rig.root.position.set(p.x, p.y, p.z);
          rig.root.rotation.y = p.yaw;
          remotePlayersGroup.add(rig.root);
          remoteAvatars.set(p.uid, {
            rig,
            x: p.x,
            y: p.y,
            z: p.z,
            yaw: p.yaw,
            targetX: p.x,
            targetY: p.y,
            targetZ: p.z,
            targetYaw: p.yaw,
            targetSpeed: p.speed,
          });
        }
      }
    };

    const selectionBeacon = createSelectionBeacon();
    scene.add(selectionBeacon);

    let roadPaths: RoadPathLoop[] = [];
    let roadMesh: THREE.Mesh | null = null;
    const buildingsContainer = new THREE.Group();
    scene.add(buildingsContainer);

    const buildingEntries = new Map<
      string,
      {
        group: THREE.Group;
        hitProxy: THREE.Mesh;
        collider: BuildingCollider;
        animatedParts: AnimatedBuildingPart[];
        currentScale: number;
        targetScale: number;
        hashKey: string;
      }
    >();
    const knownEverIds = new Set<string>();
    let hitProxies: THREE.Mesh[] = [];
    let buildingColliders: BuildingCollider[] = [];

    const rebuildRoads = (fullList: Building[]) => {
      if (roadMesh) {
        scene.remove(roadMesh);
        roadMesh.geometry.dispose();
        (roadMesh.material as THREE.Material).dispose();
      }
      roadPaths = buildSettlementRoadPaths(fullList);
      roadMesh = createRoadNetworkMesh(roadPaths, mats.cobbleTex);
      scene.add(roadMesh);
    };

    const syncBuildings = (filtered: Building[], fullList: Building[]) => {
      const wantedIds = new Set(filtered.map((b) => b.id));

      for (const [id, entry] of buildingEntries.entries()) {
        if (!wantedIds.has(id)) {
          buildingsContainer.remove(entry.group);
          buildingEntries.delete(id);
        }
      }

      for (const b of filtered) {
        const hashKey = `${b.category}|${b.status}|${b.progress}|${b.level}|${b.xPercent}|${b.yPercent}`;
        const existing = buildingEntries.get(b.id);
        if (existing && existing.hashKey === hashKey) continue;

        const isNewlyAppeared = !existing && knownEverIds.size > 0 && !knownEverIds.has(b.id);
        if (existing) {
          buildingsContainer.remove(existing.group);
        }

        const built = createBuildingGroup(b, mats, isSoftwareGl);
        const startScale = isNewlyAppeared ? 0.12 : built.targetScale;
        built.group.scale.setScalar(startScale);
        buildingsContainer.add(built.group);

        buildingEntries.set(b.id, {
          group: built.group,
          hitProxy: built.hitProxy,
          collider: built.collider,
          animatedParts: built.animatedParts,
          currentScale: startScale,
          targetScale: built.targetScale,
          hashKey,
        });
      }

      fullList.forEach((b) => knownEverIds.add(b.id));
      hitProxies = Array.from(buildingEntries.values()).map((e) => e.hitProxy);
      buildingColliders = Array.from(buildingEntries.values()).map((e) => e.collider);
      rebuildRoads(fullList);
    };

    syncBuildings(buildingsRef.current, allBuildingsRef.current);
    syncRemoteCitizens(remotePresenceRef.current);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Player physical state (restored from citizen saved worldPosition if available)
    const savedPos = citizenRef.current?.worldPosition;
    const spawnX = savedPos ? THREE.MathUtils.clamp(savedPos.x, -74, 74) : 4.5 * TERRAIN_SCALE_XY;
    const spawnZ = savedPos ? THREE.MathUtils.clamp(savedPos.z, -74, 74) : 2.0 * TERRAIN_SCALE_XY;
    const spawnY = Math.max(WATER_LEVEL + 0.3, getIslandHeight(spawnX, spawnZ));

    const player = {
      x: spawnX,
      y: spawnY,
      z: spawnZ,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: savedPos ? savedPos.yaw : Math.PI * 0.85,
      isGrounded: true,
      coyoteTimer: 0,
    };
    playerRig.root.position.set(player.x, player.y, player.z);
    playerRig.root.rotation.y = player.yaw;

    const camState = {
      yaw: player.yaw + Math.PI,
      pitch: 0.28,
      dist: 7.2,
      lookPos: new THREE.Vector3(player.x, player.y + 1.48, player.z),
      focusOverride: null as { pos: THREE.Vector3; target: THREE.Vector3 } | null,
    };
    camera.position.set(
      player.x + Math.sin(camState.yaw) * Math.cos(camState.pitch) * camState.dist,
      player.y + 1.48 + Math.sin(camState.pitch) * camState.dist,
      player.z + Math.cos(camState.yaw) * Math.cos(camState.pitch) * camState.dist
    );
    camera.lookAt(camState.lookPos);

    // Track explored travel distance & periodic Firestore persistence
    let lastSavedX = player.x;
    let lastSavedZ = player.z;
    let exploredSinceSave = 0;
    let lastSaveClock = 0;
    let lastPresenceClock = 0;

    // Raycaster & Mouse/Preview Pointer Controls
    const raycaster = new THREE.Raycaster();
    let draggingPointerId: number | null = null;
    let pointerDownPos = { x: 0, y: 0 };
    let lastPointerPos = { x: 0, y: 0 };
    let lastHoverCheck = 0;

    const updateNdc = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      _pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const raycastTapAt = (clientX: number, clientY: number) => {
      updateNdc(clientX, clientY);
      if (pickModeRef.current && onPickRef.current) {
        raycaster.layers.set(0);
        raycaster.setFromCamera(_pointerNdc, camera);
        const hits = raycaster.intersectObject(terrainMesh, false);
        if (hits.length > 0) {
          const { xPercent, yPercent } = worldXZToPercent(hits[0].point.x, hits[0].point.z);
          onPickRef.current(xPercent, yPercent);
        }
        return;
      }

      raycaster.layers.set(1);
      raycaster.setFromCamera(_pointerNdc, camera);
      const hits = raycaster.intersectObjects(hitProxies, false);
      if (hits.length > 0) {
        const bId = hits[0].object.userData.buildingId as string;
        if (bId) {
          onSelectRef.current(bId);
          if (worldFullscreenRef.current) {
            setInspectOpenInWorld(true);
          }
        }
      }
    };

    // Mouse / embedded preview pointer handlers (touch in Fullscreen is handled strictly by single-finger gesture controller)
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && worldFullscreenRef.current) return;
      draggingPointerId = e.pointerId;
      pointerDownPos = { x: e.clientX, y: e.clientY };
      lastPointerPos = { x: e.clientX, y: e.clientY };
      try {
        renderer.domElement.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if not capturable
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && worldFullscreenRef.current) return;
      if (draggingPointerId === e.pointerId) {
        const dx = e.clientX - lastPointerPos.x;
        const dy = e.clientY - lastPointerPos.y;
        lastPointerPos = { x: e.clientX, y: e.clientY };
        camState.focusOverride = null;
        camState.yaw -= dx * 0.0062;
        camState.pitch = THREE.MathUtils.clamp(camState.pitch + dy * 0.0048, -0.15, 0.92);
        return;
      }

      if (pickModeRef.current) return;
      const now = performance.now();
      if (now - lastHoverCheck < 70) return;
      lastHoverCheck = now;

      updateNdc(e.clientX, e.clientY);
      raycaster.layers.set(1);
      raycaster.setFromCamera(_pointerNdc, camera);
      const hits = raycaster.intersectObjects(hitProxies, false);
      if (hits.length > 0) {
        const bId = hits[0].object.userData.buildingId as string;
        setHoveredBuildingId((prev) => (prev === bId ? prev : bId));
      } else {
        setHoveredBuildingId((prev) => (prev === null ? prev : null));
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && worldFullscreenRef.current) return;
      if (draggingPointerId === e.pointerId) {
        draggingPointerId = null;
      }
      const travel = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (travel > 7) return;
      raycastTapAt(e.clientX, e.clientY);
    };

    const onWheel = (e: WheelEvent) => {
      if (!worldFullscreenRef.current) return;
      e.preventDefault();
      camState.focusOverride = null;
      camState.dist = THREE.MathUtils.clamp(camState.dist + e.deltaY * 0.006, 4.2, 16.5);
    };

    // Single-Finger Direct Touch Control on empty world space (Fullscreen World Mode)
    const resetTouchGesture = () => {
      touchGestureRef.current.active = false;
      touchGestureRef.current.identifier = null;
      touchGestureRef.current.maxTravel = 0;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (!worldFullscreenRef.current || pickModeRef.current) return;
      const targetEl = e.target as HTMLElement | null;
      if (targetEl?.closest?.('[data-world-hud]')) return;
      if (touchGestureRef.current.active) return;

      const touch = e.changedTouches[0];
      if (!touch) return;
      e.preventDefault();
      camState.focusOverride = null;
      touchGestureRef.current = {
        active: true,
        identifier: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
        currX: touch.clientX,
        currY: touch.clientY,
        maxTravel: 0,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!worldFullscreenRef.current || !touchGestureRef.current.active) return;
      const id = touchGestureRef.current.identifier;
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        if (touch.identifier === id) {
          e.preventDefault();
          touchGestureRef.current.currX = touch.clientX;
          touchGestureRef.current.currY = touch.clientY;
          const dist = Math.hypot(
            touch.clientX - touchGestureRef.current.startX,
            touch.clientY - touchGestureRef.current.startY
          );
          if (dist > touchGestureRef.current.maxTravel) {
            touchGestureRef.current.maxTravel = dist;
          }
          break;
        }
      }
    };

    const onTouchEndOrCancel = (e: TouchEvent) => {
      if (!touchGestureRef.current.active) return;
      const id = touchGestureRef.current.identifier;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === id) {
          const wasQuickTap = e.type === 'touchend' && touchGestureRef.current.maxTravel < 10;
          resetTouchGesture();
          if (wasQuickTap && worldFullscreenRef.current) {
            raycastTapAt(touch.clientX, touch.clientY);
          }
          break;
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
    renderer.domElement.addEventListener('touchend', onTouchEndOrCancel, { passive: false });
    renderer.domElement.addEventListener('touchcancel', onTouchEndOrCancel, { passive: false });

    sceneApiRef.current = {
      adjustCameraZoom: (deltaDist) => {
        camState.focusOverride = null;
        camState.dist = THREE.MathUtils.clamp(camState.dist + deltaDist, 4.2, 22.0);
      },
      focusOnBuilding: (b) => {
        const { x, z } = percentToWorldXZ(b.xPercent, b.yPercent);
        const y = Math.max(WATER_LEVEL + 0.3, getIslandHeight(x, z));
        camState.focusOverride = {
          pos: new THREE.Vector3(x + 14, y + 11, z + 15),
          target: new THREE.Vector3(x, y + 1.8, z),
        };
      },
      resetBehindPlayer: () => {
        camState.focusOverride = null;
        camState.yaw = player.yaw + Math.PI;
        camState.pitch = 0.28;
        camState.dist = worldFullscreenRef.current ? 6.8 : 8.4;
      },
      syncBuildings,
      syncRemoteCitizens,
      setPlayerPosAndColor: (pos, color) => {
        if (pos) {
          const rx = THREE.MathUtils.clamp(pos.x, -74, 74);
          const rz = THREE.MathUtils.clamp(pos.z, -74, 74);
          const ry = Math.max(WATER_LEVEL + 0.3, getIslandHeight(rx, rz));
          player.x = rx;
          player.z = rz;
          player.y = ry;
          player.vx = 0;
          player.vy = 0;
          player.vz = 0;
          player.yaw = pos.yaw;
          camState.yaw = pos.yaw + Math.PI;
          playerRig.root.position.set(player.x, player.y, player.z);
          playerRig.root.rotation.y = player.yaw;
          lastSavedX = rx;
          lastSavedZ = rz;
        }
        if (color) {
          playerRig.setJacketColor(color);
        }
      },
      setPlayerColorOnly: (color) => {
        playerRig.setJacketColor(color);
      },
      getPlayerPose: () => ({
        x: player.x,
        y: player.y,
        z: player.z,
        yaw: player.yaw,
      }),
      updateQuality: (eco) => {
        if (isSoftwareGl) return;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, eco ? 1.25 : 1.75));
        sunLight.shadow.mapSize.width = eco ? 1024 : 2048;
        sunLight.shadow.mapSize.height = eco ? 1024 : 2048;
        sunLight.shadow.map?.dispose();
        sunLight.shadow.map = null;
      },
      raycastTapAt,
    };

    const handleResize = () => {
      const w = Math.max(280, container.clientWidth);
      const h = Math.max(220, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObs = new ResizeObserver(handleResize);
    resizeObs.observe(container);

    let isVisibleInViewport = true;
    let isTabVisible = document.visibilityState === 'visible';
    let frameId = 0;
    let destroyed = false;
    let nearbyCheckCounter = 0;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (destroyed) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    const scheduleNextFrame = () => {
      if (destroyed || !isVisibleInViewport || !isTabVisible) return;
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    function resolvePlayerCollisions(px: number, pz: number, py: number): {
      x: number;
      z: number;
      plinthSupportY: number;
    } {
      let outX = px;
      let outZ = pz;
      let plinthSupportY = -999;

      for (let i = 0; i < buildingColliders.length; i++) {
        const c = buildingColliders[i];
        const dx = outX - c.x;
        const dz = outZ - c.z;
        const cosA = Math.cos(-c.yaw);
        const sinA = Math.sin(-c.yaw);
        const lx = dx * cosA - dz * sinA;
        const lz = dx * sinA + dz * cosA;

        if (
          Math.abs(lx) <= c.plinthHalfW + PLAYER_RADIUS * 0.4 &&
          Math.abs(lz) <= c.plinthHalfW + PLAYER_RADIUS * 0.4 &&
          py >= c.plinthTopY - 0.55
        ) {
          if (c.plinthTopY > plinthSupportY) plinthSupportY = c.plinthTopY;
        }

        if (py < c.wallTopY - 0.2) {
          const clampedX = Math.max(-c.halfW, Math.min(c.halfW, lx));
          const clampedZ = Math.max(-c.halfD, Math.min(c.halfD, lz));
          const diffX = lx - clampedX;
          const diffZ = lz - clampedZ;
          const distSq = diffX * diffX + diffZ * diffZ;

          if (distSq < PLAYER_RADIUS * PLAYER_RADIUS) {
            let pushLx = 0;
            let pushLz = 0;

            if (distSq > 1e-6) {
              const dist = Math.sqrt(distSq);
              const overlap = PLAYER_RADIUS - dist;
              pushLx = (diffX / dist) * overlap;
              pushLz = (diffZ / dist) * overlap;
            } else {
              const penX = c.halfW - Math.abs(lx);
              const penZ = c.halfD - Math.abs(lz);
              if (penX < penZ) {
                pushLx = (lx >= 0 ? 1 : -1) * (penX + PLAYER_RADIUS);
              } else {
                pushLz = (lz >= 0 ? 1 : -1) * (penZ + PLAYER_RADIUS);
              }
            }

            const cosB = Math.cos(c.yaw);
            const sinB = Math.sin(c.yaw);
            outX += pushLx * cosB - pushLz * sinB;
            outZ += pushLx * sinB + pushLz * cosB;
          }
        }
      }

      for (let i = 0; i < obstacleColliders.length; i++) {
        const obs = obstacleColliders[i];
        const dx = outX - obs.x;
        const dz = outZ - obs.z;
        const minR = obs.radius + PLAYER_RADIUS;
        const distSq = dx * dx + dz * dz;
        if (distSq < minR * minR && distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const overlap = minR - dist;
          outX += (dx / dist) * overlap;
          outZ += (dz / dist) * overlap;
        }
      }

      return { x: outX, z: outZ, plinthSupportY };
    }

    function tick() {
      if (destroyed || !isVisibleInViewport || !isTabVisible) return;

      const delta = Math.min(0.05, Math.max(0.001, clock.getDelta()));
      uTime.value += delta;
      const elapsed = uTime.value;

      // 1. Third-Person Input (Desktop Keyboard + Direct One-Finger Touch Drag)
      let desiredMoveDirX = 0;
      let desiredMoveDirZ = 0;
      let desiredSpeedMag = 0;
      let isSprinting = false;

      const currTerrainY = getIslandHeight(player.x, player.z);
      const inShallowWater = player.isGrounded && currTerrainY < WATER_LEVEL + 0.05;
      const waterSlow = inShallowWater ? 0.74 : 1;

      if (worldFullscreenRef.current) {
        const keys = keysRef.current;
        let kbX = 0;
        let kbY = 0;
        if (keys['KeyW'] || keys['ArrowUp']) kbY += 1;
        if (keys['KeyS'] || keys['ArrowDown']) kbY -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) kbX += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) kbX -= 1;
        if (keys['ShiftLeft'] || keys['ShiftRight']) isSprinting = true;

        const kbMag = Math.hypot(kbX, kbY);
        if (kbMag > 0.05) {
          const fwdX = -Math.sin(camState.yaw);
          const fwdZ = -Math.cos(camState.yaw);
          const rightX = Math.cos(camState.yaw);
          const rightZ = -Math.sin(camState.yaw);
          const dx = fwdX * (kbY / kbMag) + rightX * (kbX / kbMag);
          const dz = fwdZ * (kbY / kbMag) + rightZ * (kbX / kbMag);
          const len = Math.hypot(dx, dz) || 1;
          desiredMoveDirX = dx / len;
          desiredMoveDirZ = dz / len;
          desiredSpeedMag = (isSprinting ? RUN_SPEED : WALK_SPEED) * waterSlow;
        } else if (touchGestureRef.current.active) {
          const sens = touchSensitivityRef.current;
          const rawDx = touchGestureRef.current.currX - touchGestureRef.current.startX;
          const rawDy = touchGestureRef.current.startY - touchGestureRef.current.currY; // bottom->top is +

          // Horizontal drag rotates character & camera together (right = clockwise, left = counter-clockwise)
          if (Math.abs(rawDx) > TOUCH_DEADZONE_X) {
            const normX = Math.min(1, (Math.abs(rawDx) - TOUCH_DEADZONE_X) / (TOUCH_MAX_DRAG_X / sens));
            const turnSign = rawDx > 0 ? 1 : -1;
            const turnAngle = turnSign * normX * (2.35 * sens) * delta;
            camState.yaw -= turnAngle;
            player.yaw -= turnAngle;
          }

          // Vertical drag moves character forward/backward proportionally (light = walk, deep = run)
          if (Math.abs(rawDy) > TOUCH_DEADZONE_Y) {
            const normY = Math.min(1, (Math.abs(rawDy) - TOUCH_DEADZONE_Y) / (TOUCH_MAX_DRAG_Y / sens));
            const fwdSign = rawDy > 0 ? 1 : -1;
            const fwdX = -Math.sin(camState.yaw) * fwdSign;
            const fwdZ = -Math.cos(camState.yaw) * fwdSign;
            desiredMoveDirX = fwdX;
            desiredMoveDirZ = fwdZ;
            isSprinting = normY >= 0.56;
            const speedCurve =
              normY <= 0.56
                ? THREE.MathUtils.lerp(1.5, WALK_SPEED, normY / 0.56)
                : THREE.MathUtils.lerp(WALK_SPEED, RUN_SPEED, (normY - 0.56) / 0.44);
            desiredSpeedMag = speedCurve * waterSlow;
          }
        }
      }

      const targetVx = desiredMoveDirX * desiredSpeedMag;
      const targetVz = desiredMoveDirZ * desiredSpeedMag;

      if (desiredSpeedMag > 0.05) {
        const desiredYaw = Math.atan2(desiredMoveDirX, desiredMoveDirZ);
        const diffYaw = Math.atan2(
          Math.sin(desiredYaw - player.yaw),
          Math.cos(desiredYaw - player.yaw)
        );
        player.yaw += diffYaw * (1 - Math.exp(-13 * delta));
      }

      player.vx = THREE.MathUtils.damp(player.vx, targetVx, 12, delta);
      player.vz = THREE.MathUtils.damp(player.vz, targetVz, 12, delta);

      let nextX = player.x + player.vx * delta;
      let nextZ = player.z + player.vz * delta;

      const resolved = resolvePlayerCollisions(nextX, nextZ, player.y);
      nextX = resolved.x;
      nextZ = resolved.z;

      const slopeInfo = getIslandSlopeInfo(nextX, nextZ);
      if (player.isGrounded && slopeInfo.slope > 1.05 && slopeInfo.y > 4.0) {
        const gLen = Math.hypot(slopeInfo.gx, slopeInfo.gz) || 1;
        nextX -= (slopeInfo.gx / gLen) * 3.8 * delta;
        nextZ -= (slopeInfo.gz / gLen) * 3.8 * delta;
      }

      const finalTerrainY = getIslandHeight(nextX, nextZ);
      if (finalTerrainY < WATER_LEVEL - 0.72) {
        const radial = Math.hypot(nextX, nextZ) || 1;
        nextX -= (nextX / radial) * 5.2 * delta;
        nextZ -= (nextZ / radial) * 5.2 * delta;
      }

      const prevPx = player.x;
      const prevPz = player.z;
      player.x = THREE.MathUtils.clamp(nextX, -76, 76);
      player.z = THREE.MathUtils.clamp(nextZ, -76, 76);
      exploredSinceSave += Math.hypot(player.x - prevPx, player.z - prevPz);

      if (player.isGrounded) {
        player.coyoteTimer = 0.12;
      } else {
        player.coyoteTimer = Math.max(0, player.coyoteTimer - delta);
      }
      if (jumpBufferRef.current > 0) {
        jumpBufferRef.current = Math.max(0, jumpBufferRef.current - delta);
      }

      if (jumpBufferRef.current > 0 && player.coyoteTimer > 0 && worldFullscreenRef.current) {
        player.vy = JUMP_SPEED;
        player.isGrounded = false;
        player.coyoteTimer = 0;
        jumpBufferRef.current = 0;
      }

      player.vy += GRAVITY * delta;
      player.y += player.vy * delta;

      const groundY = Math.max(
        getIslandHeight(player.x, player.z),
        resolved.plinthSupportY,
        WATER_LEVEL - 0.68
      );

      if (player.y <= groundY) {
        player.y = groundY;
        player.vy = 0;
        player.isGrounded = true;
      } else {
        player.isGrounded = false;
      }

      playerRig.root.position.set(player.x, player.y, player.z);
      playerRig.root.rotation.y = player.yaw;

      const horizSpeed = Math.hypot(player.vx, player.vz);
      playerRig.updateAnimation(
        delta,
        horizSpeed,
        isSprinting,
        player.isGrounded,
        player.vy,
        Math.max(0, player.y - groundY)
      );

      // 2. Smooth Multiplayer Remote Citizens Interpolation
      for (const remote of remoteAvatars.values()) {
        remote.x = THREE.MathUtils.damp(remote.x, remote.targetX, 8, delta);
        remote.y = THREE.MathUtils.damp(remote.y, remote.targetY, 8, delta);
        remote.z = THREE.MathUtils.damp(remote.z, remote.targetZ, 8, delta);
        const yawDiff = Math.atan2(
          Math.sin(remote.targetYaw - remote.yaw),
          Math.cos(remote.targetYaw - remote.yaw)
        );
        remote.yaw += yawDiff * (1 - Math.exp(-9 * delta));
        remote.rig.root.position.set(remote.x, remote.y, remote.z);
        remote.rig.root.rotation.y = remote.yaw;
        remote.rig.updateAnimation(
          delta,
          remote.targetSpeed,
          remote.targetSpeed > 5.8,
          true,
          0,
          0
        );
      }

      // 3. Throttled Firestore Position Save & Online Presence Heartbeat
      if (worldFullscreenRef.current && citizenRef.current) {
        if (elapsed - lastSaveClock >= 4.5) {
          const movedDist = Math.hypot(player.x - lastSavedX, player.z - lastSavedZ);
          if (movedDist > 1.8) {
            lastSaveClock = elapsed;
            lastSavedX = player.x;
            lastSavedZ = player.z;
            const xpReward = exploredSinceSave >= 28 ? 5 : 0;
            if (xpReward > 0) exploredSinceSave = 0;
            onSaveWorldPosRef.current?.(
              { x: player.x, y: player.y, z: player.z, yaw: player.yaw },
              xpReward
            );
          }
        }
        const presenceInterval = horizSpeed > 0.25 ? 0.95 : 8.0;
        if (elapsed - lastPresenceClock >= presenceInterval) {
          lastPresenceClock = elapsed;
          onUpdatePresenceRef.current?.({
            x: player.x,
            y: player.y,
            z: player.z,
            yaw: player.yaw,
            speed: horizSpeed,
            isInWorld: true,
          });
        }
      }

      // 4. GTA Third-Person Follow Camera with Terrain Occlusion Guard
      if (camState.focusOverride && !worldFullscreenRef.current) {
        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          camState.focusOverride.pos.x,
          5.5,
          delta
        );
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          camState.focusOverride.pos.y,
          5.5,
          delta
        );
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          camState.focusOverride.pos.z,
          5.5,
          delta
        );
        camState.lookPos.x = THREE.MathUtils.damp(
          camState.lookPos.x,
          camState.focusOverride.target.x,
          6.0,
          delta
        );
        camState.lookPos.y = THREE.MathUtils.damp(
          camState.lookPos.y,
          camState.focusOverride.target.y,
          6.0,
          delta
        );
        camState.lookPos.z = THREE.MathUtils.damp(
          camState.lookPos.z,
          camState.focusOverride.target.z,
          6.0,
          delta
        );
      } else {
        const targetX = player.x;
        const targetY = player.y + 1.52;
        const targetZ = player.z;

        const cosPitch = Math.cos(camState.pitch);
        let desiredCamX = targetX + Math.sin(camState.yaw) * cosPitch * camState.dist;
        let desiredCamZ = targetZ + Math.cos(camState.yaw) * cosPitch * camState.dist;
        let desiredCamY = targetY + Math.sin(camState.pitch) * camState.dist;

        const camGround = Math.max(
          WATER_LEVEL + 0.45,
          getIslandHeight(desiredCamX, desiredCamZ),
          getIslandHeight((targetX + desiredCamX) * 0.5, (targetZ + desiredCamZ) * 0.5)
        );
        if (desiredCamY < camGround + 0.95) {
          desiredCamY = camGround + 0.95;
        }

        const followLambda = worldFullscreenRef.current ? 16 : 9;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredCamX, followLambda, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredCamY, followLambda, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredCamZ, followLambda, delta);

        camState.lookPos.x = THREE.MathUtils.damp(camState.lookPos.x, targetX, 18, delta);
        camState.lookPos.y = THREE.MathUtils.damp(camState.lookPos.y, targetY, 18, delta);
        camState.lookPos.z = THREE.MathUtils.damp(camState.lookPos.z, targetZ, 18, delta);
      }
      camera.lookAt(camState.lookPos);

      // 5. Building animations
      for (const entry of buildingEntries.values()) {
        if (Math.abs(entry.currentScale - entry.targetScale) > 0.002) {
          entry.currentScale = THREE.MathUtils.damp(
            entry.currentScale,
            entry.targetScale,
            6.5,
            delta
          );
          entry.group.scale.setScalar(entry.currentScale);
        }
        for (const part of entry.animatedParts) {
          if (part.kind === 'turbine') {
            part.object.rotation.z = -(elapsed * 1.9 + part.phase);
          } else if (part.kind === 'crane') {
            part.object.rotation.y = Math.sin(elapsed * 0.65 + part.phase) * 0.75;
          } else if (part.kind === 'smoke') {
            const cycle = (elapsed * 0.45 + part.phase) % 1;
            part.object.position.y = part.baseY + cycle * 1.15;
            part.object.scale.setScalar(0.65 + cycle * 0.9);
          }
        }
      }

      // 6. Nearby building proximity detection
      nearbyCheckCounter++;
      if (nearbyCheckCounter >= 6) {
        nearbyCheckCounter = 0;
        let closestId: string | null = null;
        let closestDistSq = 10.5 * 10.5;
        for (let i = 0; i < buildingColliders.length; i++) {
          const c = buildingColliders[i];
          const dSq = (player.x - c.x) * (player.x - c.x) + (player.z - c.z) * (player.z - c.z);
          if (dSq < closestDistSq) {
            closestDistSq = dSq;
            closestId = c.buildingId;
          }
        }
        if (closestId !== nearbyIdRef.current) {
          setNearbyBuildingId(closestId);
        }
      }

      // 7. Selection Beacon
      const selId = selectedIdRef.current;
      const selEntry = selId ? buildingEntries.get(selId) : undefined;
      if (selEntry) {
        selectionBeacon.visible = true;
        selectionBeacon.position.copy(selEntry.group.position);
        selectionBeacon.rotation.y = elapsed * 0.75;
      } else {
        selectionBeacon.visible = false;
      }

      // 8. Bay boats & offline registered citizen avatars
      for (const boat of oceanSys.boatsGroup.children) {
        const ph = (boat.userData.phase as number) || 0;
        boat.position.y = WATER_LEVEL + 0.12 + Math.sin(elapsed * 1.5 + ph) * 0.08;
        boat.rotation.z = Math.sin(elapsed * 1.2 + ph) * 0.04;
      }
      citizenSys.update(elapsed, crowdTargetCountRef.current, roadPaths);

      renderer.render(scene, camera);
      scheduleNextFrame();
    }

    const pauseOrResumeLoop = () => {
      if (isVisibleInViewport && isTabVisible) {
        clock.getDelta();
        cancelAnimationFrame(frameId);
        clearTimeout(frameId);
        scheduleNextFrame();
      } else {
        resetTouchGesture();
        keysRef.current = {};
        cancelAnimationFrame(frameId);
        clearTimeout(frameId);
      }
    };

    const intersectionObs = new IntersectionObserver(
      (entries) => {
        isVisibleInViewport = entries[0]?.isIntersecting ?? true;
        pauseOrResumeLoop();
      },
      { threshold: 0.05 }
    );
    intersectionObs.observe(wrapper);

    const onVisibilityChange = () => {
      isTabVisible = document.visibilityState === 'visible';
      pauseOrResumeLoop();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    tick();

    return () => {
      destroyed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      intersectionObs.disconnect();
      resizeObs.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      renderer.domElement.removeEventListener('touchmove', onTouchMove);
      renderer.domElement.removeEventListener('touchend', onTouchEndOrCancel);
      renderer.domElement.removeEventListener('touchcancel', onTouchEndOrCancel);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      for (const remote of remoteAvatars.values()) {
        remote.rig.dispose();
      }
      remoteAvatars.clear();

      terrainMesh.geometry.dispose();
      terrainMesh.material.dispose();
      riverMesh.geometry.dispose();
      riverMesh.material.dispose();
      if (roadMesh) {
        roadMesh.geometry.dispose();
        (roadMesh.material as THREE.Material).dispose();
      }
      oceanSys.dispose();
      forestSys.dispose();
      citizenSys.dispose();
      playerRig.dispose();
      mats.dispose();
      envTex.dispose();
      renderer.dispose();
      sceneApiRef.current = null;
    };
  }, []);

  // Restore saved character position & color once citizen profile arrives from Firestore
  useEffect(() => {
    if (!citizen) {
      restoredUidRef.current = null;
      return;
    }
    if (restoredUidRef.current !== citizen.uid) {
      restoredUidRef.current = citizen.uid;
      sceneApiRef.current?.setPlayerPosAndColor(
        citizen.worldPosition,
        citizen.avatarColor || '#1b6b63'
      );
    } else if (citizen.avatarColor) {
      sceneApiRef.current?.setPlayerColorOnly(citizen.avatarColor);
    }
  }, [citizen?.uid, citizen?.avatarColor]);

  // Sync multiplayer remote online citizens into 3D scene
  useEffect(() => {
    sceneApiRef.current?.syncRemoteCitizens(remoteWorldList);
  }, [onlineCitizens, citizen?.uid]);

  // Keyboard listener active in Fullscreen Third-Person World (Desktop)
  useEffect(() => {
    if (!worldFullscreen) {
      keysRef.current = {};
      touchGestureRef.current.active = false;
      touchGestureRef.current.identifier = null;
      setInspectOpenInWorld(false);
      setSettingsOpen(false);
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (
        e.code === 'Space' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight'
      ) {
        e.preventDefault();
      }

      keysRef.current[e.code] = true;

      if (e.code === 'Space') {
        jumpBufferRef.current = 0.14;
      } else if (e.code === 'KeyE' && nearbyIdRef.current) {
        onSelectRef.current(nearbyIdRef.current);
        setInspectOpenInWorld((v) => !v);
      } else if (e.code === 'Escape') {
        if (inspectOpenRef.current) {
          setInspectOpenInWorld(false);
        } else if (sceneApiRef.current && citizenRef.current) {
          onSaveWorldPosRef.current?.(sceneApiRef.current.getPlayerPose(), 0);
          onExitWorldRef.current();
        } else {
          onExitWorldRef.current();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    const onBlur = () => {
      keysRef.current = {};
      touchGestureRef.current.active = false;
      touchGestureRef.current.identifier = null;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [worldFullscreen]);

  // Lock body scroll & sync camera behind character when entering fullscreen play; save pose on exit
  useEffect(() => {
    if (worldFullscreen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      sceneApiRef.current?.resetBehindPlayer();
      if (sceneApiRef.current && citizenRef.current) {
        const pose = sceneApiRef.current.getPlayerPose();
        onUpdatePresenceRef.current?.({
          ...pose,
          speed: 0,
          isInWorld: true,
        });
      }
      return () => {
        document.body.style.overflow = prevOverflow;
        if (sceneApiRef.current && citizenRef.current) {
          const pose = sceneApiRef.current.getPlayerPose();
          onSaveWorldPosRef.current?.(pose, 0);
          onUpdatePresenceRef.current?.({
            ...pose,
            speed: 0,
            isInWorld: false,
          });
        }
      };
    }
  }, [worldFullscreen]);

  // Sync buildings without remounting WebGL
  useEffect(() => {
    sceneApiRef.current?.syncBuildings(buildings, allBuildings);
  }, [buildings, allBuildings]);

  useEffect(() => {
    sceneApiRef.current?.updateQuality(ecoMode);
  }, [ecoMode]);

  useEffect(() => {
    if (focusRequestTick === 0 || !selectedBuildingId || worldFullscreen) return;
    const b = allBuildings.find((item) => item.id === selectedBuildingId);
    if (b) {
      sceneApiRef.current?.focusOnBuilding(b);
    }
  }, [focusRequestTick, selectedBuildingId, allBuildings, worldFullscreen]);

  const handleExitWorldClick = () => {
    if (sceneApiRef.current && citizenRef.current) {
      onSaveWorldPosition?.(sceneApiRef.current.getPlayerPose(), 0);
    }
    onExitWorld();
  };

  const nearbyBuilding = nearbyBuildingId
    ? allBuildings.find((b) => b.id === nearbyBuildingId) || null
    : null;
  const inspectedBuilding =
    worldFullscreen && inspectOpenInWorld
      ? allBuildings.find((b) => b.id === (selectedBuildingId || nearbyBuildingId)) || null
      : null;

  if (webglError) {
    return (
      <div
        className={
          worldFullscreen
            ? 'fixed inset-0 z-50 bg-[#06131c]'
            : 'relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-emerald-900/50 bg-[#06131c]'
        }
      >
        <img
          src="/src/assets/images/island_aerial_map_1794839888807.jpg"
          alt={t.islandOverview}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover opacity-80"
        />
        {worldFullscreen && (
          <button
            type="button"
            onClick={handleExitWorldClick}
            className="absolute top-4 start-4 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-[#071118] cursor-pointer"
          >
            {t.exitWorldBtn}
          </button>
        )}
        <div className="absolute inset-x-4 bottom-4 rounded-lg border border-amber-500/40 bg-[#071118]/90 px-4 py-2.5 text-xs text-amber-200">
          {t.webglFallbackNote}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      style={worldFullscreen ? { overscrollBehavior: 'none', touchAction: 'none' } : undefined}
      className={
        worldFullscreen
          ? 'fixed inset-0 z-50 h-[100dvh] w-screen overflow-hidden bg-[#071a26] select-none touch-none'
          : 'relative aspect-[16/10] min-h-[340px] w-full overflow-hidden rounded-xl border border-emerald-900/50 bg-[#071a26] select-none'
      }
    >
      {/* Isolated WebGL Mount Container */}
      <div
        ref={mountRef}
        className={`h-full w-full touch-none ${
          pickMode
            ? 'cursor-crosshair'
            : hoveredBuildingId
              ? 'cursor-pointer'
              : 'cursor-grab active:cursor-grabbing'
        }`}
      />

      {/* EMBEDDED HOME PAGE PREVIEW HUD */}
      {!worldFullscreen && (
        <>
          <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between gap-2">
            <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-emerald-800/60 bg-[#07131b]/90 px-3 py-1.5 text-xs text-slate-200">
              <Compass className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
              <span className="font-medium">{t.view3dBadge}</span>
            </div>

            <div className="pointer-events-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => sceneApiRef.current?.adjustCameraZoom(-2.0)}
                aria-label={t.zoomIn}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-800/60 bg-[#07131b]/90 text-slate-200 hover:text-white cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => sceneApiRef.current?.adjustCameraZoom(2.0)}
                aria-label={t.zoomOut}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-800/60 bg-[#07131b]/90 text-slate-200 hover:text-white cursor-pointer"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => sceneApiRef.current?.resetBehindPlayer()}
                aria-label={t.resetView}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-800/60 bg-[#07131b]/90 text-amber-300 hover:text-white cursor-pointer"
              >
                <Crosshair className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-center">
            <button
              type="button"
              onClick={onEnterWorld}
              className="pointer-events-auto flex min-h-[44px] items-center gap-2 rounded-xl border border-amber-300/60 bg-amber-500 px-5 py-2.5 text-sm font-bold text-[#071118] shadow-xl transition-transform hover:scale-[1.02] hover:bg-amber-400 cursor-pointer"
            >
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
              <span>{t.enterWorldBtn}</span>
            </button>
          </div>
        </>
      )}

      {/* CLEAN MINIMAL FULLSCREEN WORLD HUD (Only Exit + Settings + Unobtrusive Live Status; NO movement buttons/joystick) */}
      {worldFullscreen && (
        <>
          <div
            data-world-hud="true"
            className="pointer-events-none absolute inset-x-3 top-3 z-30 flex items-center justify-between gap-2 sm:inset-x-5 sm:top-4"
          >
            <div className="pointer-events-auto flex items-center gap-2">
              <button
                type="button"
                onClick={handleExitWorldClick}
                className="flex min-h-[38px] items-center gap-2 rounded-lg border border-amber-400/60 bg-[#07131b]/95 px-3.5 py-1.5 text-xs font-bold text-amber-200 shadow-lg hover:bg-[#0c202c] hover:text-white cursor-pointer"
              >
                <Minimize2 className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                <span>{t.exitWorldBtn}</span>
              </button>

              <div className="hidden sm:flex items-center gap-2 rounded-lg border border-emerald-800/60 bg-[#07131b]/90 px-3 py-2 text-xs text-slate-200 tabular-nums">
                <Users className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                <span>
                  {t.onlineCitizensShort}:{' '}
                  <strong className="text-emerald-300">{onlineCount}</strong>
                </span>
                <span aria-hidden="true" className="text-slate-600">
                  ·
                </span>
                <span>
                  {t.registeredCitizensShort}:{' '}
                  <strong className="text-white">{totalRegistered}</strong>
                </span>
                {civ && (
                  <>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span className="font-semibold text-amber-300">
                      {t.dayLabel} {civ.dayNumber}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="pointer-events-auto relative flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSettingsOpen((v) => !v)}
                aria-label={t.worldSettingsBtn}
                className={`flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-lg cursor-pointer ${
                  settingsOpen
                    ? 'border-amber-400 bg-amber-500 text-[#071118]'
                    : 'border-emerald-800/60 bg-[#07131b]/95 text-slate-200 hover:bg-[#0d222f]'
                }`}
              >
                <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.worldSettingsBtn}</span>
              </button>

              {settingsOpen && (
                <div className="absolute top-11 end-0 z-40 w-64 space-y-3.5 rounded-xl border border-emerald-800/70 bg-[#07131b]/95 p-4 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-emerald-900/50 pb-2">
                    <span className="text-xs font-bold text-white">{t.worldSettingsTitle}</span>
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(false)}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Quality Mode */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-300">{t.graphicsQualityLabel}</span>
                    <button
                      type="button"
                      onClick={() => setEcoMode((v) => !v)}
                      className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                        ecoMode
                          ? 'border-sky-500/60 bg-sky-950/90 text-sky-200'
                          : 'border-emerald-700/70 bg-emerald-950/70 text-emerald-200'
                      }`}
                    >
                      <Zap className="h-3 w-3" aria-hidden="true" />
                      <span>{ecoMode ? t.qualityEco : t.qualityHigh}</span>
                    </button>
                  </div>

                  {/* Sensitivity Slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>{t.touchSensitivityLabel}</span>
                      <span className="font-mono-data text-amber-300">
                        {touchSensitivity.toFixed(1)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={1.8}
                      step={0.1}
                      value={touchSensitivity}
                      onChange={(e) => setTouchSensitivity(Number(e.target.value))}
                      className="w-full accent-amber-400"
                    />
                  </div>

                  {/* Citizen Avatar Outfit Color */}
                  {citizen && onUpdateAvatarColor && (
                    <div className="space-y-1.5 border-t border-emerald-900/40 pt-2.5">
                      <div className="text-xs text-slate-300">{t.avatarColorLabel}</div>
                      <div className="flex flex-wrap gap-2">
                        {AVATAR_COLOR_PALETTE.map((hex) => {
                          const active = (citizen.avatarColor || '#1b6b63') === hex;
                          return (
                            <button
                              key={hex}
                              type="button"
                              onClick={() => onUpdateAvatarColor(hex)}
                              style={{ backgroundColor: hex }}
                              aria-label={hex}
                              className={`h-6 w-6 rounded-full border-2 cursor-pointer ${
                                active ? 'border-amber-300 scale-110' : 'border-slate-700'
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Unobtrusive Non-Blocking Control Hint (bottom-center) */}
          <div className="pointer-events-none fixed inset-x-4 bottom-3 z-20 flex justify-center">
            <div className="rounded-lg border border-emerald-900/50 bg-[#07131b]/80 px-3.5 py-1.5 text-center text-[11px] font-medium text-slate-300 shadow">
              {isTouchDevice ? t.touchControlsHint : t.thirdPersonHint}
            </div>
          </div>

          {/* Nearby Building Prompt */}
          {nearbyBuilding && !inspectOpenInWorld && (
            <div
              data-world-hud="true"
              className="pointer-events-none fixed inset-x-4 bottom-12 z-30 flex justify-center"
            >
              <button
                type="button"
                onClick={() => {
                  onSelectBuilding(nearbyBuilding.id);
                  setInspectOpenInWorld(true);
                }}
                className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-amber-400/70 bg-[#07131b]/95 px-4 py-2 text-xs font-semibold text-amber-200 shadow-xl hover:bg-[#0c202c] cursor-pointer"
              >
                <Compass className="h-4 w-4 text-amber-400" aria-hidden="true" />
                <span>
                  {lang === 'ar' ? nearbyBuilding.nameAr : nearbyBuilding.nameEn}
                </span>
                <span className="rounded bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-[#071118]">
                  {t.nearbyInteract}
                </span>
              </button>
            </div>
          )}

          {/* Compact Slide-Over Building Info Card inside Play Mode */}
          {inspectedBuilding && (
            <div
              data-world-hud="true"
              className="pointer-events-auto fixed top-16 end-3 z-30 w-[min(340px,92vw)] rounded-xl border border-emerald-800/70 bg-[#07131b]/95 p-4 shadow-2xl sm:end-5"
            >
              <div className="flex items-start justify-between gap-2 border-b border-emerald-900/50 pb-2.5">
                <div>
                  <div className="text-[11px] font-medium text-amber-300">
                    {t.buildingLevel} {inspectedBuilding.level} · {inspectedBuilding.progress}%
                  </div>
                  <h3 className="mt-0.5 text-sm font-bold text-white">
                    {lang === 'ar' ? inspectedBuilding.nameAr : inspectedBuilding.nameEn}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectOpenInWorld(false)}
                  aria-label={t.close}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="mt-2.5 text-xs leading-relaxed text-slate-300">
                {lang === 'ar'
                  ? inspectedBuilding.descriptionAr
                  : inspectedBuilding.descriptionEn}
              </p>

              <div className="mt-3 space-y-1.5 border-t border-emerald-900/40 pt-2.5 text-[11px]">
                <div className="font-medium text-slate-400">{t.dailyProductionLabel}</div>
                <div className="flex flex-wrap gap-1.5 font-semibold text-emerald-300">
                  {formatEffectList(inspectedBuilding.dailyOutput || {}, lang).map((eff) => (
                    <span key={eff} className="rounded bg-emerald-950/80 px-2 py-0.5">
                      {eff}
                    </span>
                  ))}
                  {formatEffectList(inspectedBuilding.dailyOutput || {}, lang).length === 0 && (
                    <span className="text-slate-500">{t.noProductionData}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
