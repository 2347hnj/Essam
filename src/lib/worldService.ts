import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getIslandHeight, TERRAIN_SCALE_XY, WATER_LEVEL } from '../three/islandTerrain';
import {
  Building,
  BuildingCategory,
  BuildingStatus,
  ChronicleEntry,
  CitizenProfile,
  CitizenWorldPosition,
  Civilization,
  Decision,
  DecisionBuildingBlueprint,
  DecisionCategory,
  DecisionOption,
  IslandEvent,
  NewsBulletin,
  NewsCategory,
  ResourceEffects,
  Vote,
  WorldPresence,
  WorldRegistryCounter,
} from '../types/world';
import { db, FOUNDER_EMAIL, handleFirestoreError, OperationType } from './firebase';
import { runDailySimulationTick } from './simulationEngine';

export const DEFAULT_CIV_ID = 'civ-newworld';
export const CURRENT_SIM_VERSION = 3;

export const AVATAR_COLOR_PALETTE = [
  '#1b6b63',
  '#c2781a',
  '#1e6091',
  '#9b2c2c',
  '#5b3e96',
  '#2b5876',
];

export const CITIZEN_PROFESSIONS = [
  { id: 'pioneer', en: 'Island Pioneer', ar: 'رائد جزيرة' },
  { id: 'architect', en: 'Master Architect', ar: 'مهندس معماري' },
  { id: 'agronomist', en: 'Eco-Agronomist', ar: 'مهندس زراعي' },
  { id: 'scholar', en: 'Research Scholar', ar: 'باحث علوم' },
  { id: 'trader', en: 'Harbor Trader', ar: 'تاجر وملاّح' },
  { id: 'medic', en: 'Island Medic', ar: 'معالج طبي' },
] as const;

export const ISLAND_ASSETS_CATALOG = [
  { id: 'Pioneer Shelter', nameEn: 'Pioneer Shelter', nameAr: 'مأوى الرواد الأساسي', price: 0 },
  { id: 'Cedar Timber Cabin', nameEn: 'Cedar Timber Cabin', nameAr: 'كابينة خشب الأرز', price: 300 },
  { id: 'Private Botanical Plot', nameEn: 'Private Botanical Plot', nameAr: 'حديقة نباتية خاصة', price: 450 },
  { id: 'Eastern Bay Skiff', nameEn: 'Eastern Bay Skiff', nameAr: 'قارب الخليج الشرقي', price: 650 },
  { id: 'Starlight Terrace', nameEn: 'Starlight Terrace', nameAr: 'مرصد النجوم الخاص', price: 900 },
  { id: 'Stone Hill Residence', nameEn: 'Stone Hill Residence', nameAr: 'منزل التل الحجري', price: 1400 },
] as const;

export function getDefaultSpawnPosition(): CitizenWorldPosition {
  const x = 4.5 * TERRAIN_SCALE_XY;
  const z = 2.0 * TERRAIN_SCALE_XY;
  const y = Math.max(WATER_LEVEL + 0.3, getIslandHeight(x, z));
  return { x, y, z, yaw: Math.PI * 0.85 };
}

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function truncateStr(str: string, max: number): string {
  return str.trim().slice(0, max);
}

export function toMillis(ts: unknown): number {
  if (!ts) return 0;
  if (ts instanceof Date) return ts.getTime();
  if (typeof (ts as { toMillis?: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (typeof (ts as { seconds?: number }).seconds === 'number') {
    return (ts as { seconds: number }).seconds * 1000;
  }
  return 0;
}

export function subscribeToCivilization(
  civId: string,
  onData: (civ: Civilization | null) => void
) {
  const path = `civilizations/${civId}`;
  return onSnapshot(
    doc(db, 'civilizations', civId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      onData({ ...(snapshot.data() as Omit<Civilization, 'id'>), id: snapshot.id });
    },
    (error) => handleFirestoreError(error, OperationType.GET, path)
  );
}

export function subscribeToWorldRegistry(
  onData: (counter: WorldRegistryCounter | null) => void
) {
  const path = 'counters/world_registry';
  return onSnapshot(
    doc(db, 'counters', 'world_registry'),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      onData(snapshot.data() as WorldRegistryCounter);
    },
    (error) => handleFirestoreError(error, OperationType.GET, path)
  );
}

export function subscribeToOnlinePresence(onData: (list: WorldPresence[]) => void) {
  const path = 'world_presence';
  const q = query(collection(db, 'world_presence'), where('isOnline', '==', true));
  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map((d) => d.data() as WorldPresence));
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeToBuildings(
  civId: string,
  onData: (buildings: Building[]) => void
) {
  const path = 'buildings';
  const q = query(collection(db, 'buildings'), where('civId', '==', civId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Building[] = snapshot.docs.map((d) => ({
        ...(d.data() as Omit<Building, 'id'>),
        id: d.id,
      }));
      list.sort((a, b) => b.level - a.level);
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeToDecisions(
  civId: string,
  onData: (decisions: Decision[]) => void
) {
  const path = 'decisions';
  const q = query(collection(db, 'decisions'), where('civId', '==', civId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Decision[] = snapshot.docs.map((d) => ({
        ...(d.data() as Omit<Decision, 'id'>),
        id: d.id,
      }));
      list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeToDecisionVotes(
  decisionId: string,
  onData: (votes: Vote[]) => void
) {
  const path = `decisions/${decisionId}/votes`;
  const q = query(
    collection(db, 'decisions', decisionId, 'votes'),
    where('decisionId', '==', decisionId)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map((d) => d.data() as Vote));
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeToChronicles(
  civId: string,
  onData: (entries: ChronicleEntry[]) => void
) {
  const path = 'chronicles';
  const q = query(collection(db, 'chronicles'), where('civId', '==', civId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: ChronicleEntry[] = snapshot.docs.map((d) => ({
        ...(d.data() as Omit<ChronicleEntry, 'id'>),
        id: d.id,
      }));
      list.sort((a, b) => b.dayNumber - a.dayNumber);
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeToEvents(
  civId: string,
  onData: (events: IslandEvent[]) => void
) {
  const path = 'events';
  const q = query(collection(db, 'events'), where('civId', '==', civId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: IslandEvent[] = snapshot.docs.map((d) => ({
        ...(d.data() as Omit<IslandEvent, 'id'>),
        id: d.id,
      }));
      list.sort((a, b) => b.dayNumber - a.dayNumber);
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeToNews(
  civId: string,
  onData: (items: NewsBulletin[]) => void
) {
  const path = 'news';
  const q = query(collection(db, 'news'), where('civId', '==', civId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: NewsBulletin[] = snapshot.docs.map((d) => ({
        ...(d.data() as Omit<NewsBulletin, 'id'>),
        id: d.id,
      }));
      list.sort((a, b) => toMillis(b.publishedAt) - toMillis(a.publishedAt));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeToCitizens(onData: (citizens: CitizenProfile[]) => void) {
  const path = 'citizens';
  const q = query(
    collection(db, 'citizens'),
    where('status', 'in', ['active', 'suspended'])
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => d.data() as CitizenProfile);
      list.sort((a, b) => (b.xp || 0) - (a.xp || 0) || b.votesCount - a.votesCount);
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeToMyCitizenProfile(
  uid: string,
  onData: (profile: CitizenProfile | null) => void
) {
  const path = `citizens/${uid}`;
  return onSnapshot(
    doc(db, 'citizens', uid),
    (snapshot) => {
      onData(snapshot.exists() ? (snapshot.data() as CitizenProfile) : null);
    },
    (error) => handleFirestoreError(error, OperationType.GET, path)
  );
}

export function subscribeToAdminBadge(
  uid: string,
  onData: (isListedAdmin: boolean) => void
) {
  const path = `admins/${uid}`;
  return onSnapshot(
    doc(db, 'admins', uid),
    (snapshot) => {
      onData(snapshot.exists());
    },
    (error) => handleFirestoreError(error, OperationType.GET, path)
  );
}

/**
 * Atomically registers a brand new citizen account (incrementing totalRegistered &
 * assigning a unique sequential citizenshipCode) OR restores & updates a returning
 * citizen's profile without incrementing population.
 */
export async function syncCitizenOnLogin(user: User): Promise<{ isNewCitizen: boolean }> {
  const citizenRef = doc(db, 'citizens', user.uid);
  const privateRef = doc(db, 'users_private', user.uid);
  const counterRef = doc(db, 'counters', 'world_registry');
  const civRef = doc(db, 'civilizations', DEFAULT_CIV_ID);

  const displayName = truncateStr(user.displayName || 'Citizen', 100);
  const photoURL = truncateStr(user.photoURL || '', 500);
  const email = truncateStr(user.email || '', 200);
  const isFounder = user.email === FOUNDER_EMAIL && user.emailVerified;

  try {
    let isNewCitizen = false;

    await runTransaction(db, async (tx) => {
      const citizenSnap = await tx.get(citizenRef);
      const privateSnap = await tx.get(privateRef);
      const counterSnap = await tx.get(counterRef);
      const civSnap = await tx.get(civRef);

      if (!citizenSnap.exists()) {
        isNewCitizen = true;
        const prevTotal = counterSnap.exists()
          ? Number(counterSnap.data().totalRegistered || 0)
          : 0;
        const prevSeq = counterSnap.exists()
          ? Number(counterSnap.data().nextCitizenSeq || 0)
          : 0;
        const newTotal = prevTotal + 1;
        const newSeq = prevSeq + 1;
        const citizenshipCode = `NW-${String(newSeq).padStart(4, '0')}`;
        const avatarColor = AVATAR_COLOR_PALETTE[(newSeq - 1) % AVATAR_COLOR_PALETTE.length];

        tx.set(citizenRef, {
          uid: user.uid,
          displayName,
          photoURL,
          citizenshipNumber: newSeq,
          citizenshipCode,
          professionEn: CITIZEN_PROFESSIONS[0].en,
          professionAr: CITIZEN_PROFESSIONS[0].ar,
          coins: 500,
          assets: ['Pioneer Shelter'],
          xp: 0,
          level: 1,
          avatarColor,
          worldPosition: getDefaultSpawnPosition(),
          isOnline: true,
          votesCount: 0,
          participationsCount: 0,
          role: isFounder ? 'founder' : 'citizen',
          status: 'active',
          lastVotedDecisionId: '',
          joinedAt: serverTimestamp(),
          lastActiveAt: serverTimestamp(),
        });

        if (!counterSnap.exists()) {
          tx.set(counterRef, {
            id: 'world_registry',
            totalRegistered: 1,
            nextCitizenSeq: 1,
            updatedAt: serverTimestamp(),
          });
        } else {
          tx.update(counterRef, {
            totalRegistered: newTotal,
            nextCitizenSeq: newSeq,
            updatedAt: serverTimestamp(),
          });
        }

        if (civSnap.exists()) {
          tx.update(civRef, {
            population: newTotal,
            updatedAt: serverTimestamp(),
          });
        }
      } else {
        const data = citizenSnap.data() as CitizenProfile;
        if (data.status === 'active' || isFounder) {
          if (typeof data.citizenshipNumber !== 'number') {
            // One-time schema backfill for legacy accounts created before citizen dossiers
            const fallbackSeq = isFounder ? 1 : Math.max(2, (data.votesCount || 0) + 1);
            tx.update(citizenRef, {
              displayName,
              photoURL,
              citizenshipNumber: fallbackSeq,
              citizenshipCode: `NW-${String(fallbackSeq).padStart(4, '0')}`,
              professionEn: isFounder ? 'Commonwealth Founder' : CITIZEN_PROFESSIONS[0].en,
              professionAr: isFounder ? 'مؤسس الحضارة' : CITIZEN_PROFESSIONS[0].ar,
              coins: 500,
              assets: ['Pioneer Shelter'],
              xp: 0,
              level: 1,
              avatarColor: AVATAR_COLOR_PALETTE[0],
              worldPosition: getDefaultSpawnPosition(),
              isOnline: true,
              lastActiveAt: serverTimestamp(),
            });
          } else {
            tx.update(citizenRef, {
              displayName,
              photoURL,
              isOnline: true,
              lastActiveAt: serverTimestamp(),
            });
          }
        }
      }

      if (!privateSnap.exists()) {
        tx.set(privateRef, {
          uid: user.uid,
          email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.update(privateRef, {
          email,
          updatedAt: serverTimestamp(),
        });
      }
    });

    return { isNewCitizen };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `citizens/${user.uid}`);
  }
}

export async function updateCitizenProfileDetails(
  uid: string,
  updates: {
    professionEn?: string;
    professionAr?: string;
    avatarColor?: string;
  }
): Promise<void> {
  const path = `citizens/${uid}`;
  try {
    const clean: Record<string, unknown> = { lastActiveAt: serverTimestamp() };
    if (updates.professionEn) clean.professionEn = truncateStr(updates.professionEn, 80);
    if (updates.professionAr) clean.professionAr = truncateStr(updates.professionAr, 80);
    if (updates.avatarColor) clean.avatarColor = truncateStr(updates.avatarColor, 24);
    await updateDoc(doc(db, 'citizens', uid), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function purchaseCitizenAsset(
  uid: string,
  assetId: string,
  price: number
): Promise<void> {
  const citizenRef = doc(db, 'citizens', uid);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(citizenRef);
      if (!snap.exists()) throw new Error('Citizen profile not found');
      const data = snap.data() as CitizenProfile;
      const currentCoins = data.coins ?? 0;
      const currentAssets = Array.isArray(data.assets) ? data.assets : [];
      if (currentAssets.includes(assetId)) return;
      if (currentCoins < price) {
        throw new Error('Insufficient coins');
      }
      tx.update(citizenRef, {
        coins: currentCoins - price,
        assets: [...currentAssets, assetId],
        lastActiveAt: serverTimestamp(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `citizens/${uid}`);
  }
}

export async function saveCitizenWorldState(
  uid: string,
  worldPosition: CitizenWorldPosition,
  xpGain = 0
): Promise<void> {
  const citizenRef = doc(db, 'citizens', uid);
  const clampedPos: CitizenWorldPosition = {
    x: Number(Math.max(-120, Math.min(120, worldPosition.x)).toFixed(2)),
    y: Number(Math.max(-10, Math.min(80, worldPosition.y)).toFixed(2)),
    z: Number(Math.max(-120, Math.min(120, worldPosition.z)).toFixed(2)),
    yaw: Number(worldPosition.yaw.toFixed(3)),
  };

  try {
    if (xpGain > 0) {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(citizenRef);
        if (!snap.exists()) return;
        const data = snap.data() as CitizenProfile;
        const currXp = data.xp ?? 0;
        const currLvl = data.level ?? 1;
        const safeGain = Math.min(25, Math.max(1, Math.round(xpGain)));
        const nextXp = currXp + safeGain;
        const nextLvl = Math.min(currLvl + 1, Math.max(currLvl, Math.floor(nextXp / 100) + 1));
        tx.update(citizenRef, {
          worldPosition: clampedPos,
          xp: nextXp,
          level: nextLvl,
          isOnline: true,
          lastActiveAt: serverTimestamp(),
        });
      });
    } else {
      await updateDoc(citizenRef, {
        worldPosition: clampedPos,
        isOnline: true,
        lastActiveAt: serverTimestamp(),
      });
    }
  } catch {
    // Non-fatal background world sync guard when signing out or offline
  }
}

export async function upsertWorldPresence(
  citizen: CitizenProfile,
  state: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    speed: number;
    isOnline: boolean;
    isInWorld: boolean;
  }
): Promise<void> {
  try {
    await setDoc(doc(db, 'world_presence', citizen.uid), {
      uid: citizen.uid,
      displayName: truncateStr(citizen.displayName || 'Citizen', 100),
      citizenshipCode: truncateStr(citizen.citizenshipCode || 'NW-0001', 32),
      professionEn: truncateStr(citizen.professionEn || CITIZEN_PROFESSIONS[0].en, 80),
      professionAr: truncateStr(citizen.professionAr || CITIZEN_PROFESSIONS[0].ar, 80),
      avatarColor: truncateStr(citizen.avatarColor || AVATAR_COLOR_PALETTE[0], 24),
      x: Number(Math.max(-120, Math.min(120, state.x)).toFixed(2)),
      y: Number(Math.max(-10, Math.min(80, state.y)).toFixed(2)),
      z: Number(Math.max(-120, Math.min(120, state.z)).toFixed(2)),
      yaw: Number(state.yaw.toFixed(3)),
      speed: Number(Math.max(0, Math.min(20, state.speed)).toFixed(2)),
      isOnline: state.isOnline,
      isInWorld: state.isInWorld,
      lastSeenAt: serverTimestamp(),
    });
  } catch {
    // Ignore transient heartbeat write failures when tab closes
  }
}

export async function markCitizenOffline(
  uid: string,
  citizen?: CitizenProfile | null
): Promise<void> {
  try {
    const pos = citizen?.worldPosition || getDefaultSpawnPosition();
    await Promise.allSettled([
      setDoc(doc(db, 'world_presence', uid), {
        uid,
        displayName: truncateStr(citizen?.displayName || 'Citizen', 100),
        citizenshipCode: truncateStr(citizen?.citizenshipCode || 'NW-0001', 32),
        professionEn: truncateStr(citizen?.professionEn || CITIZEN_PROFESSIONS[0].en, 80),
        professionAr: truncateStr(citizen?.professionAr || CITIZEN_PROFESSIONS[0].ar, 80),
        avatarColor: truncateStr(citizen?.avatarColor || AVATAR_COLOR_PALETTE[0], 24),
        x: pos.x,
        y: pos.y,
        z: pos.z,
        yaw: pos.yaw,
        speed: 0,
        isOnline: false,
        isInWorld: false,
        lastSeenAt: serverTimestamp(),
      }),
      updateDoc(doc(db, 'citizens', uid), {
        isOnline: false,
        lastActiveAt: serverTimestamp(),
      }),
    ]);
  } catch {
    // Ignore during unload
  }
}

export async function castCitizenVote(
  decisionId: string,
  optionId: string,
  uid: string
): Promise<void> {
  const voteRef = doc(db, 'decisions', decisionId, 'votes', uid);
  const citizenRef = doc(db, 'citizens', uid);
  try {
    await runTransaction(db, async (tx) => {
      const citizenSnap = await tx.get(citizenRef);
      const data = citizenSnap.exists() ? (citizenSnap.data() as CitizenProfile) : null;
      const prevVotes = data?.votesCount ?? 0;
      const prevPart = data?.participationsCount ?? 0;
      const prevCoins = data?.coins ?? 500;
      const prevXp = data?.xp ?? 0;
      const prevLevel = data?.level ?? 1;
      const nextXp = prevXp + 30;
      const nextLevel = Math.min(prevLevel + 1, Math.max(prevLevel, Math.floor(nextXp / 100) + 1));

      tx.set(voteRef, {
        userId: uid,
        decisionId,
        optionId,
        createdAt: serverTimestamp(),
      });
      tx.update(citizenRef, {
        votesCount: prevVotes + 1,
        participationsCount: prevPart + 1,
        coins: prevCoins + 25,
        xp: nextXp,
        level: nextLevel,
        lastVotedDecisionId: decisionId,
        lastActiveAt: serverTimestamp(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `decisions/${decisionId}/votes/${uid}`);
  }
}

async function clearCollectionForCiv(collectionName: string, civId: string) {
  const q = query(collection(db, collectionName), where('civId', '==', civId));
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

/**
 * Seeds or resets the Day 1 civilization anchored strictly to the real count of
 * registered citizen accounts in Firestore (never artificial virtual population).
 * When upgrading from simVersion < CURRENT_SIM_VERSION without forceReset, preserves
 * existing buildings/decisions while syncing real citizen registry & population counts.
 */
export async function seedOrResetTo100Citizens(
  founderUid: string,
  forceReset = false
): Promise<boolean> {
  const civRef = doc(db, 'civilizations', DEFAULT_CIV_ID);
  const counterRef = doc(db, 'counters', 'world_registry');
  try {
    const existing = await getDoc(civRef);
    const existingVersion = existing.exists()
      ? (existing.data().simVersion as number | undefined) || 1
      : 0;

    if (!forceReset && existing.exists() && existingVersion >= CURRENT_SIM_VERSION) {
      return false;
    }

    const citizensSnap = await getDocs(collection(db, 'citizens'));
    const realCitizenCount = citizensSnap.size;
    let maxSeq = realCitizenCount;
    citizensSnap.docs.forEach((d) => {
      const n = (d.data() as CitizenProfile).citizenshipNumber;
      if (typeof n === 'number' && n > maxSeq) maxSeq = n;
    });

    // Non-destructive upgrade from v2 -> v3: sync registry counter and real population without wiping world
    if (!forceReset && existing.exists() && existingVersion < CURRENT_SIM_VERSION) {
      const batch = writeBatch(db);
      batch.set(
        counterRef,
        {
          id: 'world_registry',
          totalRegistered: realCitizenCount,
          nextCitizenSeq: maxSeq,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      batch.update(civRef, {
        population: realCitizenCount,
        simVersion: CURRENT_SIM_VERSION,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      return true;
    }

    // Clear stale seed collections when force-resetting
    if (existing.exists() || forceReset) {
      await Promise.all([
        clearCollectionForCiv('buildings', DEFAULT_CIV_ID),
        clearCollectionForCiv('decisions', DEFAULT_CIV_ID),
        clearCollectionForCiv('chronicles', DEFAULT_CIV_ID),
        clearCollectionForCiv('events', DEFAULT_CIV_ID),
        clearCollectionForCiv('news', DEFAULT_CIV_ID),
      ]);
    }

    const batch = writeBatch(db);

    batch.set(counterRef, {
      id: 'world_registry',
      totalRegistered: realCitizenCount,
      nextCitizenSeq: maxSeq,
      updatedAt: serverTimestamp(),
    });

    batch.set(civRef, {
      id: DEFAULT_CIV_ID,
      nameEn: 'Aurelia Commonwealth',
      nameAr: 'كومنولث أوريليا',
      islandNameEn: 'Aurelia Island',
      islandNameAr: 'جزيرة أوريليا',
      eraEn: 'Age of Citizens',
      eraAr: 'عصر المواطنين الأوائل',
      dayNumber: 1,
      level: 1,
      population: realCitizenCount,
      food: 72,
      water: 78,
      energy: 65,
      treasury: 12000,
      health: 80,
      education: 60,
      happiness: 82,
      simVersion: CURRENT_SIM_VERSION,
      createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const starterBuildings: Array<Omit<Building, 'createdBy' | 'createdAt' | 'updatedAt'>> = [
      {
        id: 'bld_pioneer_farm',
        civId: DEFAULT_CIV_ID,
        nameEn: 'Emerald Valley Farm',
        nameAr: 'مزرعة الوادي الأخضر',
        descriptionEn:
          'Founding irrigated crop fields supplying fresh grains and vegetables to island citizens.',
        descriptionAr:
          'الحقول الزراعية التأسيسية التي تزود مواطني الجزيرة بالمحاصيل والغذاء اليومي.',
        category: 'agriculture',
        status: 'completed',
        progress: 100,
        level: 1,
        xPercent: 62,
        yPercent: 72,
        dailyOutput: { food: 12 },
        dailyUpkeep: { water: 2 },
      },
      {
        id: 'bld_river_cistern',
        civId: DEFAULT_CIV_ID,
        nameEn: 'River Cistern & Aqueduct',
        nameAr: 'خزان المياه العذبة وقناة النهر',
        descriptionEn:
          'Stone intake channels filtering pure mountain river water into the main settlement cistern.',
        descriptionAr:
          'قنوات حجرية لتنقية وتخزين مياه النهر العذبة وتوزيعها على المواطنين والمزارع.',
        category: 'infrastructure',
        status: 'completed',
        progress: 100,
        level: 1,
        xPercent: 49,
        yPercent: 43,
        dailyOutput: { water: 13 },
        dailyUpkeep: { treasury: 150 },
      },
      {
        id: 'bld_timber_factory',
        civId: DEFAULT_CIV_ID,
        nameEn: 'Coastal Timber & Stone Works',
        nameAr: 'مصنع الأخشاب والحجارة الساحلي',
        descriptionEn:
          'Artisan mill and stone-cutting workshop generating building materials and early commonwealth revenue.',
        descriptionAr:
          'ورشة ومصنع لإنتاج مواد البناء والأخشاب وتحقيق عائد اقتصادي يومي للجزيرة.',
        category: 'factory',
        status: 'completed',
        progress: 100,
        level: 1,
        xPercent: 68,
        yPercent: 41,
        dailyOutput: { treasury: 850, energy: 3 },
        dailyUpkeep: { energy: 2, happiness: 1 },
      },
      {
        id: 'bld_solar_station',
        civId: DEFAULT_CIV_ID,
        nameEn: 'Sunridge Energy Station',
        nameAr: 'محطة الطاقة الشمسية',
        descriptionEn:
          'Clean solar array under construction on the sunlit ridge to power future workshops and homes.',
        descriptionAr:
          'محطة طاقة نظيفة قيد الإنشاء لتأمين الكهرباء المستدامة لتوسع الأحياء والمصانع.',
        category: 'energy',
        status: 'constructing',
        progress: 55,
        level: 1,
        xPercent: 37,
        yPercent: 25,
        dailyOutput: { energy: 14 },
        dailyUpkeep: { treasury: 200 },
      },
      {
        id: 'bld_pioneer_clinic',
        civId: DEFAULT_CIV_ID,
        nameEn: 'Pioneer Health & Learning Hall',
        nameAr: 'دار الصحة والمعرفة',
        descriptionEn:
          'Planned civic sanctuary combining a botanical medical clinic with a library for the growing community.',
        descriptionAr:
          'مشروع مجتمعي يجمع عيادة طبية ومكتبة تعليمية لرفع الصحة والتعليم على الجزيرة.',
        category: 'health',
        status: 'planned',
        progress: 20,
        level: 1,
        xPercent: 78,
        yPercent: 63,
        dailyOutput: { health: 6, education: 5 },
        dailyUpkeep: { treasury: 250 },
      },
    ];

    for (const b of starterBuildings) {
      const { id, ...rest } = b;
      batch.set(doc(db, 'buildings', id), {
        ...rest,
        createdBy: founderUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const endsAtDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    batch.set(doc(db, 'decisions', 'dec_day01_charter'), {
      civId: DEFAULT_CIV_ID,
      titleEn: 'Day 1 Charter: First Island Expansion',
      titleAr: 'ميثاق اليوم الأول: أولوية التوسع الأولى',
      descriptionEn:
        'Registered citizens of Aurelia Island shape the world together. Vote on how to invest our starting treasury and craft our next landmark.',
      descriptionAr:
        'يشارك المواطنون المسجلون في بناء جزيرة أوريليا معاً. صوّت لتحديد الأولوية الاستراتيجية الأولى لاستثمار الموارد قبل انتقال المحاكاة لليوم الثاني.',
      category: 'infrastructure',
      status: 'active',
      endsAt: Timestamp.fromDate(endsAtDate),
      options: [
        {
          id: 'opt_farms',
          labelEn: 'Expand Valley Terraces',
          labelAr: 'توسيع المدرجات الزراعية',
          summaryEn: 'Boost food and water reserves across the central valley.',
          summaryAr: 'تعزيز الأمن الغذائي ومخزون المياه عبر الوادي الأخضر.',
          effects: { food: 12, water: 6, happiness: 3, treasury: -1800 },
          spawnBuilding: {
            nameEn: 'Valley Terraced Greenhouses',
            nameAr: 'المدرجات الزراعية والبيوت المحمية',
            descriptionEn:
              'Irrigated stone terraces and glasshouses constructed by collective decree to expand island food production.',
            descriptionAr:
              'مدرجات زراعية وبيوت محمية أُنشئت بقرار جماعي لمضاعفة إنتاج الغذاء وتأمين الموارد.',
            category: 'agriculture',
            status: 'completed',
            progress: 100,
            xPercent: 54,
            yPercent: 68,
            dailyOutput: { food: 10, water: 2 },
            dailyUpkeep: { treasury: 150 },
          },
        },
        {
          id: 'opt_industry',
          labelEn: 'Upgrade Coastal Works & Harbor',
          labelAr: 'تطوير المصنع والمرفأ الساحلي',
          summaryEn: 'Increase treasury income and industrial output.',
          summaryAr: 'زيادة الإنتاج الصناعي وإيرادات الخزينة لتسريع المشاريع.',
          effects: { treasury: 2500, energy: 6, happiness: 2 },
          spawnBuilding: {
            nameEn: 'Eastern Crescent Foundry & Pier',
            nameAr: 'مسبك الخليج الشرقي والرصيف البحري',
            descriptionEn:
              'Coastal stone foundry and trade pier built after the public vote to boost commonwealth revenue.',
            descriptionAr:
              'مصنع ومرفأ تجاري على الساحل الشرقي أُنشئ بقرار المواطنين لرفع عائدات الخزينة.',
            category: 'factory',
            status: 'completed',
            progress: 100,
            xPercent: 75,
            yPercent: 48,
            dailyOutput: { treasury: 1100, energy: 4 },
            dailyUpkeep: { happiness: 1 },
          },
        },
        {
          id: 'opt_civic',
          labelEn: 'Fund Health & Education Hall',
          labelAr: 'تجهيز دار الصحة والمعرفة',
          summaryEn: 'Elevate public wellness, literacy, and citizen morale.',
          summaryAr: 'رفع مؤشرات الصحة والتعليم وسعادة السكان منذ البداية.',
          effects: { health: 8, education: 10, happiness: 6, treasury: -1500 },
          spawnBuilding: {
            nameEn: 'Aurelia Academy & Observatory',
            nameAr: 'أكاديمية أوريليا والمرصد',
            descriptionEn:
              'Scholar hall and copper-domed observatory funded by public vote to advance science and health.',
            descriptionAr:
              'مجمع تعليمي وبحثي بقبة نحاسية أُنشئ بتصويت الجمهور لرفع التعليم والصحة.',
            category: 'science',
            status: 'completed',
            progress: 100,
            xPercent: 65,
            yPercent: 56,
            dailyOutput: { education: 7, health: 4 },
            dailyUpkeep: { treasury: 200 },
          },
        },
      ],
      createdBy: founderUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'chronicles', 'chr_day01_landing'), {
      civId: DEFAULT_CIV_ID,
      dayNumber: 1,
      titleEn: 'Founding Charter of Aurelia Island',
      titleAr: 'الميثاق التأسيسي لجزيرة أوريليا',
      outcomeEn:
        'Aurelia Island opened its gates as a shared citizen-driven civilization powered by real accounts, active stewardship, and daily votes.',
      outcomeAr:
        'افتتحت جزيرة أوريليا أبوابها كحضارة افتراضية حقيقية ينمو سكانها مع انضمام كل مواطن فعلي ويُبنى مستقبلها بالتصويت الجماعي.',
      winningOptionEn: 'Founding Charter Ratified',
      winningOptionAr: 'اعتماد الميثاق التأسيسي الأول',
      totalVotes: realCitizenCount,
      winningPercentage: 100,
      imageUrl: '/src/assets/images/chronicle_harbor_1794839888319.jpg',
      effects: { food: 72, water: 78, happiness: 82 },
      executedAt: serverTimestamp(),
      createdBy: founderUid,
    });

    batch.set(doc(db, 'events', 'evt_day01_landing'), {
      civId: DEFAULT_CIV_ID,
      dayNumber: 1,
      titleEn: 'Clear Coastal Dawn',
      titleAr: 'فجر ساحلي صافٍ وبداية التأسيس',
      descriptionEn:
        'Calm tides and fertile valley soil welcome every registered citizen arriving on Aurelia Island.',
      descriptionAr:
        'أمواج هادئة وتربة خصبة تستقبل كل مواطن مسجل يبدأ رحلته على أرض جزيرة أوريليا.',
      severity: 'positive',
      effects: { happiness: 3, food: 2 },
      breakdown: {
        dayNumber: 1,
        populationDelta: 0,
        foodConsumed: 2,
        waterConsumed: 2,
        productionTotals: { food: 12, water: 13, treasury: 850 },
        upkeepTotals: { water: 2, energy: 2, treasury: 150 },
        decisionEffects: {},
        eventEffects: { happiness: 3, food: 2 },
        eventTitleEn: 'Clear Coastal Dawn',
        eventTitleAr: 'فجر ساحلي صافٍ وبداية التأسيس',
      },
      triggeredAt: serverTimestamp(),
      createdBy: founderUid,
    });

    batch.set(doc(db, 'news', 'news_day01_charter'), {
      civId: DEFAULT_CIV_ID,
      titleEn: 'Aurelia Opens as a Real Citizen-Driven 3D Civilization',
      titleAr: 'انطلاق جزيرة أوريليا كحضارة حقيقية يقودها المواطنون',
      bodyEn:
        'Every citizen who joins receives a unique citizenship number, persistent progress, and a 3D avatar to explore the island alongside other online citizens.',
      bodyAr:
        'يحصل كل مواطن يسجل دخوله على رقم مواطنة فريد وملف دائم وشخصية ثلاثية الأبعاد للتجول في الجزيرة والمشاركة في بناء الحضارة.',
      category: 'announcement',
      createdBy: founderUid,
      publishedAt: serverTimestamp(),
    });

    await batch.commit();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seed_world_registry');
  }
}

export const seedOrResetWorld = seedOrResetTo100Citizens;

export async function updateCivilizationMetrics(
  civId: string,
  updates: Partial<
    Pick<
      Civilization,
      | 'nameEn'
      | 'nameAr'
      | 'islandNameEn'
      | 'islandNameAr'
      | 'eraEn'
      | 'eraAr'
      | 'dayNumber'
      | 'level'
      | 'population'
      | 'food'
      | 'water'
      | 'energy'
      | 'treasury'
      | 'health'
      | 'education'
      | 'happiness'
    >
  >
): Promise<void> {
  const path = `civilizations/${civId}`;
  try {
    const cleanUpdates: Record<string, unknown> = { ...updates, updatedAt: serverTimestamp() };
    if (updates.food !== undefined) cleanUpdates.food = clampPct(updates.food);
    if (updates.water !== undefined) cleanUpdates.water = clampPct(updates.water);
    if (updates.energy !== undefined) cleanUpdates.energy = clampPct(updates.energy);
    if (updates.health !== undefined) cleanUpdates.health = clampPct(updates.health);
    if (updates.education !== undefined) cleanUpdates.education = clampPct(updates.education);
    if (updates.happiness !== undefined) cleanUpdates.happiness = clampPct(updates.happiness);
    if (updates.population !== undefined)
      cleanUpdates.population = Math.max(0, Math.round(updates.population));
    await updateDoc(doc(db, 'civilizations', civId), cleanUpdates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createDecision(payload: {
  civId: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  category: DecisionCategory;
  durationHours: number;
  options: DecisionOption[];
  adminUid: string;
}): Promise<void> {
  const id = `dec_${Date.now()}`;
  const path = `decisions/${id}`;
  const endsAtDate = new Date(Date.now() + Math.max(1, payload.durationHours) * 3600 * 1000);
  try {
    await setDoc(doc(db, 'decisions', id), {
      civId: payload.civId,
      titleEn: truncateStr(payload.titleEn, 160),
      titleAr: truncateStr(payload.titleAr, 160),
      descriptionEn: truncateStr(payload.descriptionEn, 1200),
      descriptionAr: truncateStr(payload.descriptionAr, 1200),
      category: payload.category,
      status: 'active',
      options: payload.options.slice(0, 6),
      endsAt: Timestamp.fromDate(endsAtDate),
      createdBy: payload.adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

const LANDMARK_CANDIDATE_SPOTS: Array<{ x: number; y: number }> = [
  { x: 54, y: 68 },
  { x: 75, y: 48 },
  { x: 65, y: 56 },
  { x: 42, y: 62 },
  { x: 35, y: 52 },
  { x: 58, y: 36 },
  { x: 72, y: 72 },
  { x: 29, y: 44 },
  { x: 44, y: 74 },
  { x: 69, y: 31 },
];

function findOpenIslandSpot(buildings: Building[], preferred?: { x: number; y: number }) {
  const candidates = preferred ? [preferred, ...LANDMARK_CANDIDATE_SPOTS] : LANDMARK_CANDIDATE_SPOTS;
  for (const pt of candidates) {
    const tooClose = buildings.some(
      (b) => Math.hypot(b.xPercent - pt.x, b.yPercent - pt.y) < 8
    );
    if (!tooClose) return pt;
  }
  return {
    x: Math.max(24, Math.min(80, 38 + ((buildings.length * 13) % 40))),
    y: Math.max(26, Math.min(76, 36 + ((buildings.length * 17) % 38))),
  };
}

function resolveDecisionBuildingBlueprint(
  decision: Decision,
  winningOption: DecisionOption,
  buildings: Building[]
): DecisionBuildingBlueprint | null {
  if (winningOption.spawnBuilding) {
    const open = findOpenIslandSpot(buildings, {
      x: winningOption.spawnBuilding.xPercent,
      y: winningOption.spawnBuilding.yPercent,
    });
    return {
      ...winningOption.spawnBuilding,
      xPercent: open.x,
      yPercent: open.y,
    };
  }

  // Fallback blueprint for Day 1 charter options or decision categories that expand the island
  if (winningOption.id === 'opt_farms') {
    const spot = findOpenIslandSpot(buildings, { x: 54, y: 68 });
    return {
      nameEn: 'Valley Terraced Greenhouses',
      nameAr: 'المدرجات الزراعية والبيوت المحمية',
      descriptionEn: 'Irrigated crop terraces constructed from collective vote.',
      descriptionAr: 'مدرجات زراعية أُنشئت تنفيذاً لقرار الجمهور.',
      category: 'agriculture',
      status: 'completed',
      progress: 100,
      xPercent: spot.x,
      yPercent: spot.y,
      dailyOutput: { food: 10, water: 2 },
      dailyUpkeep: { treasury: 150 },
    };
  }
  if (winningOption.id === 'opt_industry') {
    const spot = findOpenIslandSpot(buildings, { x: 75, y: 48 });
    return {
      nameEn: 'Eastern Crescent Foundry & Pier',
      nameAr: 'مسبك الخليج الشرقي والرصيف البحري',
      descriptionEn: 'Coastal foundry and harbor built from collective vote.',
      descriptionAr: 'مصنع ومرفأ ساحلي أُنشئ تنفيذاً لقرار الجمهور.',
      category: 'factory',
      status: 'completed',
      progress: 100,
      xPercent: spot.x,
      yPercent: spot.y,
      dailyOutput: { treasury: 1100, energy: 4 },
      dailyUpkeep: { happiness: 1 },
    };
  }
  if (winningOption.id === 'opt_civic') {
    const spot = findOpenIslandSpot(buildings, { x: 65, y: 56 });
    return {
      nameEn: 'Aurelia Academy & Observatory',
      nameAr: 'أكاديمية أوريليا والمرصد',
      descriptionEn: 'Public learning hall and observatory founded by citizen vote.',
      descriptionAr: 'أكاديمية ومرصد علمي أُنشئ بتصويت المواطنين.',
      category: 'science',
      status: 'completed',
      progress: 100,
      xPercent: spot.x,
      yPercent: spot.y,
      dailyOutput: { education: 7, health: 4 },
      dailyUpkeep: { treasury: 200 },
    };
  }

  const eff = winningOption.effects || {};
  let category: BuildingCategory = 'civic';
  let dailyOutput: ResourceEffects = { happiness: 3 };
  if ((eff.food || 0) > 0) {
    category = 'agriculture';
    dailyOutput = { food: 7 };
  } else if ((eff.water || 0) > 0 || decision.category === 'infrastructure') {
    category = 'infrastructure';
    dailyOutput = { water: 6 };
  } else if ((eff.energy || 0) > 0) {
    category = 'energy';
    dailyOutput = { energy: 8 };
  } else if ((eff.treasury || 0) > 0 || decision.category === 'economy') {
    category = 'factory';
    dailyOutput = { treasury: 700 };
  } else if ((eff.health || 0) > 0) {
    category = 'health';
    dailyOutput = { health: 5 };
  } else if ((eff.education || 0) > 0 || decision.category === 'science') {
    category = 'science';
    dailyOutput = { education: 6 };
  }

  const spot = findOpenIslandSpot(buildings);
  return {
    nameEn: truncateStr(winningOption.labelEn, 100),
    nameAr: truncateStr(winningOption.labelAr, 100),
    descriptionEn: truncateStr(winningOption.summaryEn || decision.titleEn, 600),
    descriptionAr: truncateStr(winningOption.summaryAr || decision.titleAr, 600),
    category,
    status: 'completed',
    progress: 100,
    xPercent: spot.x,
    yPercent: spot.y,
    dailyOutput,
    dailyUpkeep: { treasury: 120 },
  };
}

/**
 * Closes/approves the daily decision, runs the full daily simulation cycle
 * (consumption, building/farm/factory production, population growth, random event),
 * spawns any decision-linked 3D structure on the island, advances construction projects,
 * and logs both Chronicle and IslandEvent records.
 */
export async function approveDecisionAndApply(params: {
  decision: Decision;
  winningOption: DecisionOption;
  totalVotes: number;
  winningPercentage: number;
  civ: Civilization;
  buildings: Building[];
  adminUid: string;
  imageUrl?: string;
}): Promise<void> {
  const { decision, winningOption, totalVotes, winningPercentage, civ, buildings, adminUid } =
    params;

  const sim = runDailySimulationTick({ civ, buildings, winningOption });
  const spawnedBlueprint = resolveDecisionBuildingBlueprint(decision, winningOption, buildings);

  const fallbackImage =
    decision.category === 'ecology'
      ? '/src/assets/images/chronicle_aqueduct_1794839889120.jpg'
      : decision.category === 'science'
        ? '/src/assets/images/chronicle_academy_1794839890229.jpg'
        : '/src/assets/images/chronicle_harbor_1794839888319.jpg';

  const chronicleId = `chr_${Date.now()}`;
  const eventId = `evt_${Date.now()}`;
  const newBuildingId = `bld_dec_${Date.now()}`;

  try {
    const counterSnap = await getDoc(doc(db, 'counters', 'world_registry'));
    const realPop = counterSnap.exists()
      ? Number(counterSnap.data().totalRegistered || 0)
      : sim.nextPopulation;

    const batch = writeBatch(db);

    batch.update(doc(db, 'decisions', decision.id), {
      status: 'approved',
      winningOptionId: winningOption.id,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.update(doc(db, 'civilizations', civ.id), {
      dayNumber: sim.nextDayNumber,
      level: sim.nextLevel,
      population: realPop,
      food: sim.nextFood,
      water: sim.nextWater,
      energy: sim.nextEnergy,
      treasury: sim.nextTreasury,
      health: sim.nextHealth,
      education: sim.nextEducation,
      happiness: sim.nextHappiness,
      simVersion: CURRENT_SIM_VERSION,
      lastSimulationSummary: sim.breakdown,
      updatedAt: serverTimestamp(),
    });

    for (const bUpdate of sim.buildingUpdates) {
      batch.update(doc(db, 'buildings', bUpdate.id), {
        progress: bUpdate.progress,
        status: bUpdate.status,
        updatedAt: serverTimestamp(),
      });
    }

    if (spawnedBlueprint) {
      const bStatus: BuildingStatus = spawnedBlueprint.status || 'completed';
      const bProgress = bStatus === 'completed' ? 100 : clampPct(spawnedBlueprint.progress ?? 75);
      batch.set(doc(db, 'buildings', newBuildingId), {
        civId: civ.id,
        nameEn: truncateStr(spawnedBlueprint.nameEn, 100),
        nameAr: truncateStr(spawnedBlueprint.nameAr, 100),
        descriptionEn: truncateStr(spawnedBlueprint.descriptionEn, 600),
        descriptionAr: truncateStr(spawnedBlueprint.descriptionAr, 600),
        category: spawnedBlueprint.category,
        status: bStatus,
        progress: bProgress,
        level: 1,
        xPercent: clampPct(spawnedBlueprint.xPercent),
        yPercent: clampPct(spawnedBlueprint.yPercent),
        dailyOutput: spawnedBlueprint.dailyOutput || {},
        dailyUpkeep: spawnedBlueprint.dailyUpkeep || {},
        createdBy: adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    batch.set(doc(db, 'chronicles', chronicleId), {
      civId: civ.id,
      decisionId: decision.id,
      dayNumber: sim.nextDayNumber,
      titleEn: truncateStr(decision.titleEn, 160),
      titleAr: truncateStr(decision.titleAr, 160),
      outcomeEn: truncateStr(winningOption.summaryEn || decision.descriptionEn, 1000),
      outcomeAr: truncateStr(winningOption.summaryAr || decision.descriptionAr, 1000),
      winningOptionEn: truncateStr(winningOption.labelEn, 160),
      winningOptionAr: truncateStr(winningOption.labelAr, 160),
      totalVotes,
      winningPercentage: clampPct(winningPercentage),
      imageUrl: params.imageUrl || fallbackImage,
      effects: winningOption.effects || {},
      executedAt: serverTimestamp(),
      createdBy: adminUid,
    });

    batch.set(doc(db, 'events', eventId), {
      civId: civ.id,
      dayNumber: sim.nextDayNumber,
      titleEn: sim.eventTemplate.titleEn,
      titleAr: sim.eventTemplate.titleAr,
      descriptionEn: sim.eventTemplate.descriptionEn,
      descriptionAr: sim.eventTemplate.descriptionAr,
      severity: sim.eventTemplate.severity,
      effects: sim.eventTemplate.effects,
      breakdown: sim.breakdown,
      triggeredAt: serverTimestamp(),
      createdBy: adminUid,
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `decisions/${decision.id}`);
  }
}

export async function closeOrRejectDecision(
  decisionId: string,
  status: 'closed' | 'rejected'
): Promise<void> {
  try {
    await updateDoc(doc(db, 'decisions', decisionId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `decisions/${decisionId}`);
  }
}

export async function saveBuilding(
  buildingId: string | null,
  data: {
    civId: string;
    nameEn: string;
    nameAr: string;
    descriptionEn: string;
    descriptionAr: string;
    category: BuildingCategory;
    status: BuildingStatus;
    progress: number;
    level: number;
    xPercent: number;
    yPercent: number;
    dailyOutput?: ResourceEffects;
    dailyUpkeep?: ResourceEffects;
  },
  adminUid: string
): Promise<void> {
  const id = buildingId || `bld_${Date.now()}`;
  const path = `buildings/${id}`;
  try {
    if (!buildingId) {
      await setDoc(doc(db, 'buildings', id), {
        civId: data.civId,
        nameEn: truncateStr(data.nameEn, 100),
        nameAr: truncateStr(data.nameAr, 100),
        descriptionEn: truncateStr(data.descriptionEn, 600),
        descriptionAr: truncateStr(data.descriptionAr, 600),
        category: data.category,
        status: data.status,
        progress: clampPct(data.progress),
        level: Math.max(1, Math.min(20, Math.round(data.level))),
        xPercent: clampPct(data.xPercent),
        yPercent: clampPct(data.yPercent),
        dailyOutput: data.dailyOutput || {},
        dailyUpkeep: data.dailyUpkeep || {},
        createdBy: adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'buildings', id), {
        nameEn: truncateStr(data.nameEn, 100),
        nameAr: truncateStr(data.nameAr, 100),
        descriptionEn: truncateStr(data.descriptionEn, 600),
        descriptionAr: truncateStr(data.descriptionAr, 600),
        category: data.category,
        status: data.status,
        progress: clampPct(data.progress),
        level: Math.max(1, Math.min(20, Math.round(data.level))),
        xPercent: clampPct(data.xPercent),
        yPercent: clampPct(data.yPercent),
        dailyOutput: data.dailyOutput || {},
        dailyUpkeep: data.dailyUpkeep || {},
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteBuilding(buildingId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'buildings', buildingId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `buildings/${buildingId}`);
  }
}

export async function publishNews(
  data: {
    civId: string;
    titleEn: string;
    titleAr: string;
    bodyEn: string;
    bodyAr: string;
    category: NewsCategory;
  },
  adminUid: string
): Promise<void> {
  const id = `news_${Date.now()}`;
  try {
    await setDoc(doc(db, 'news', id), {
      civId: data.civId,
      titleEn: truncateStr(data.titleEn, 160),
      titleAr: truncateStr(data.titleAr, 160),
      bodyEn: truncateStr(data.bodyEn, 2000),
      bodyAr: truncateStr(data.bodyAr, 2000),
      category: data.category,
      createdBy: adminUid,
      publishedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `news/${id}`);
  }
}

export async function deleteNews(newsId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'news', newsId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `news/${newsId}`);
  }
}

export async function setCitizenStatus(
  targetUid: string,
  status: 'active' | 'suspended'
): Promise<void> {
  try {
    await updateDoc(doc(db, 'citizens', targetUid), {
      status,
      lastActiveAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `citizens/${targetUid}`);
  }
}

export async function toggleCitizenAdmin(
  targetUid: string,
  makeAdmin: boolean,
  adminUid: string
): Promise<void> {
  try {
    const batch = writeBatch(db);
    if (makeAdmin) {
      batch.set(doc(db, 'admins', targetUid), {
        uid: targetUid,
        grantedBy: adminUid,
        grantedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'citizens', targetUid), {
        role: 'admin',
        lastActiveAt: serverTimestamp(),
      });
    } else {
      batch.delete(doc(db, 'admins', targetUid));
      batch.update(doc(db, 'citizens', targetUid), {
        role: 'citizen',
        lastActiveAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `admins/${targetUid}`);
  }
}
