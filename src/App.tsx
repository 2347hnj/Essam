import { onAuthStateChanged, User } from 'firebase/auth';
import { Globe2, Play, Radio, Shield, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChronicleSection } from './components/ChronicleSection';
import { CitizenProfileModal } from './components/CitizenProfileModal';
import { CivilizationMetrics } from './components/CivilizationMetrics';
import { DailyDecisionPanel } from './components/DailyDecisionPanel';
import { FounderConsole } from './components/FounderConsole';
import { IslandMap } from './components/IslandMap';
import { NewsSection } from './components/NewsSection';
import { SimulationEventsSection } from './components/SimulationEventsSection';
import { TopNav } from './components/TopNav';
import { TRANSLATIONS } from './i18n/translations';
import {
  auth,
  FOUNDER_EMAIL,
  signInWithGoogle,
  signOutUser,
  testFirestoreConnection,
} from './lib/firebase';
import {
  approveDecisionAndApply,
  castCitizenVote,
  closeOrRejectDecision,
  createDecision,
  DEFAULT_CIV_ID,
  deleteBuilding,
  deleteNews,
  getDefaultSpawnPosition,
  markCitizenOffline,
  publishNews,
  purchaseCitizenAsset,
  saveBuilding,
  saveCitizenWorldState,
  seedOrResetTo100Citizens,
  setCitizenStatus,
  subscribeToAdminBadge,
  subscribeToBuildings,
  subscribeToChronicles,
  subscribeToCitizens,
  subscribeToCivilization,
  subscribeToDecisions,
  subscribeToDecisionVotes,
  subscribeToEvents,
  subscribeToMyCitizenProfile,
  subscribeToNews,
  subscribeToOnlinePresence,
  subscribeToWorldRegistry,
  syncCitizenOnLogin,
  toggleCitizenAdmin,
  toMillis,
  updateCitizenProfileDetails,
  updateCivilizationMetrics,
  upsertWorldPresence,
} from './lib/worldService';
import {
  Building,
  ChronicleEntry,
  CitizenProfile,
  CitizenWorldPosition,
  Civilization,
  Decision,
  DecisionOption,
  IslandEvent,
  Lang,
  NewsBulletin,
  Vote,
  WorldPresence,
  WorldRegistryCounter,
} from './types/world';

class WorldErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#071118] p-6 text-center text-slate-200">
          <div className="max-w-md rounded-2xl border border-rose-800/50 bg-[#0b1b24] p-6">
            <h1 className="text-lg font-bold text-rose-300">NEW WORLD</h1>
            <p className="mt-2 text-xs text-slate-300 break-words">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-[#071118] cursor-pointer"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function getEndsAtMillis(endsAt: Decision['endsAt']): number {
  if (endsAt instanceof Date) return endsAt.getTime();
  if (endsAt && typeof endsAt.toDate === 'function') return endsAt.toDate().getTime();
  if (endsAt && typeof (endsAt as { seconds?: number }).seconds === 'number') {
    return (endsAt as { seconds: number }).seconds * 1000;
  }
  return Date.now() + 86400000;
}

const PRESENCE_TTL_MS = 95_000;

export default function App() {
  const [lang, setLang] = useState<Lang>('ar');
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [myCitizen, setMyCitizen] = useState<CitizenProfile | null>(null);
  const [isListedAdmin, setIsListedAdmin] = useState(false);

  const [civ, setCiv] = useState<Civilization | null>(null);
  const [civLoaded, setCivLoaded] = useState(false);
  const [registryCounter, setRegistryCounter] = useState<WorldRegistryCounter | null>(null);
  const [onlinePresenceList, setOnlinePresenceList] = useState<WorldPresence[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [activeVotes, setActiveVotes] = useState<Vote[]>([]);
  const [chronicles, setChronicles] = useState<ChronicleEntry[]>([]);
  const [events, setEvents] = useState<IslandEvent[]>([]);
  const [news, setNews] = useState<NewsBulletin[]>([]);
  const [citizens, setCitizens] = useState<CitizenProfile[]>([]);

  const [profileOpen, setProfileOpen] = useState(false);
  const [founderOpen, setFounderOpen] = useState(false);
  const [worldFullscreen, setWorldFullscreen] = useState(false);
  const [pickMode, setPickMode] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{ x: number; y: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const autoSimulatedRef = useRef<Set<string>>(new Set());

  const myCitizenRef = useRef<CitizenProfile | null>(null);
  myCitizenRef.current = myCitizen;
  const worldFullscreenRef = useRef(worldFullscreen);
  worldFullscreenRef.current = worldFullscreen;

  const t = TRANSLATIONS[lang];

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3500);
  }, []);

  // Sync HTML lang and dir attributes on language switch
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  // Periodic clock tick for filtering stale presence heartbeats
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 20_000);
    return () => window.clearInterval(id);
  }, []);

  // Boot Firestore connection check & Auth listener
  useEffect(() => {
    void testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (firebaseUser) {
        try {
          const { isNewCitizen } = await syncCitizenOnLogin(firebaseUser);
          if (isNewCitizen) {
            showToast(
              document.documentElement.lang === 'ar'
                ? 'تم تسجيل هويتك كمواطن جديد في جزيرة أوريليا!'
                : 'Welcome! Your new Aurelia citizenship has been registered.'
            );
          }
          if (firebaseUser.email === FOUNDER_EMAIL && firebaseUser.emailVerified) {
            await seedOrResetTo100Citizens(firebaseUser.uid, false);
          }
        } catch (err) {
          console.error(err);
        }
      } else {
        setMyCitizen(null);
        setIsListedAdmin(false);
      }
    });
    return () => unsub();
  }, [showToast]);

  // Public world subscriptions (after authReady — non-PII citizens, registry, & live presence included)
  useEffect(() => {
    if (!authReady) return;
    const unsubCiv = subscribeToCivilization(DEFAULT_CIV_ID, (data) => {
      setCiv(data);
      setCivLoaded(true);
    });
    const unsubRegistry = subscribeToWorldRegistry(setRegistryCounter);
    const unsubPresence = subscribeToOnlinePresence(setOnlinePresenceList);
    const unsubCitizens = subscribeToCitizens(setCitizens);
    const unsubBuildings = subscribeToBuildings(DEFAULT_CIV_ID, setBuildings);
    const unsubDecisions = subscribeToDecisions(DEFAULT_CIV_ID, setDecisions);
    const unsubChronicles = subscribeToChronicles(DEFAULT_CIV_ID, setChronicles);
    const unsubEvents = subscribeToEvents(DEFAULT_CIV_ID, setEvents);
    const unsubNews = subscribeToNews(DEFAULT_CIV_ID, setNews);

    return () => {
      unsubCiv();
      unsubRegistry();
      unsubPresence();
      unsubCitizens();
      unsubBuildings();
      unsubDecisions();
      unsubChronicles();
      unsubEvents();
      unsubNews();
    };
  }, [authReady]);

  // Authenticated private/self user subscriptions
  useEffect(() => {
    if (!user) {
      return;
    }
    const unsubMe = subscribeToMyCitizenProfile(user.uid, setMyCitizen);
    const unsubAdmin = subscribeToAdminBadge(user.uid, setIsListedAdmin);
    return () => {
      unsubMe();
      unsubAdmin();
    };
  }, [user]);

  // Real-time online citizen heartbeat & clean disconnect marking
  useEffect(() => {
    if (!user || !myCitizen) return;

    const sendHeartbeat = () => {
      const curr = myCitizenRef.current;
      if (!curr) return;
      const pos = curr.worldPosition || getDefaultSpawnPosition();
      void upsertWorldPresence(curr, {
        x: pos.x,
        y: pos.y,
        z: pos.z,
        yaw: pos.yaw,
        speed: 0,
        isOnline: true,
        isInWorld: worldFullscreenRef.current,
      });
    };

    sendHeartbeat();
    const hbId = window.setInterval(sendHeartbeat, 20_000);

    const handleDisconnect = () => {
      void markCitizenOffline(user.uid, myCitizenRef.current);
    };

    window.addEventListener('pagehide', handleDisconnect);
    window.addEventListener('beforeunload', handleDisconnect);

    return () => {
      window.clearInterval(hbId);
      window.removeEventListener('pagehide', handleDisconnect);
      window.removeEventListener('beforeunload', handleDisconnect);
    };
  }, [user?.uid, Boolean(myCitizen)]);

  const activeDecision = decisions.find((d) => d.status === 'active') || null;

  // Votes subscription for active decision
  useEffect(() => {
    if (!activeDecision) {
      setActiveVotes([]);
      return;
    }
    const unsubVotes = subscribeToDecisionVotes(activeDecision.id, setActiveVotes);
    return () => unsubVotes();
  }, [activeDecision?.id]);

  const isFounder = Boolean(
    user && user.email === FOUNDER_EMAIL && user.emailVerified
  );
  const isAdmin = Boolean(
    isFounder || isListedAdmin || myCitizen?.role === 'admin' || myCitizen?.role === 'founder'
  );

  // Automatic Daily Simulation when active vote deadline closes (executed by verified Founder/Admin)
  useEffect(() => {
    if (!isAdmin || !user || !civ || !activeDecision) return;
    const checkExpired = async () => {
      const expired = Date.now() >= getEndsAtMillis(activeDecision.endsAt);
      if (!expired || autoSimulatedRef.current.has(activeDecision.id)) return;
      autoSimulatedRef.current.add(activeDecision.id);

      const counts = activeDecision.options.map((opt) => ({
        opt,
        count: activeVotes.filter((v) => v.optionId === opt.id).length,
      }));
      counts.sort((a, b) => b.count - a.count);
      const leader = counts[0];
      if (!leader) return;
      const total = activeVotes.length;
      const pct = total > 0 ? Math.round((leader.count / total) * 100) : 100;

      try {
        await approveDecisionAndApply({
          decision: activeDecision,
          winningOption: leader.opt,
          totalVotes: total,
          winningPercentage: pct,
          civ,
          buildings,
          adminUid: user.uid,
        });
        showToast(
          lang === 'ar'
            ? 'أُغلق التصويت وتمت محاكاة اليوم الجديد تلقائياً'
            : 'Vote closed and next day simulated automatically'
        );
      } catch (err) {
        console.error(err);
      }
    };

    void checkExpired();
    const timer = window.setInterval(() => void checkExpired(), 15000);
    return () => window.clearInterval(timer);
  }, [isAdmin, user, civ, activeDecision, activeVotes, buildings, lang, showToast]);

  const freshOnlineList = useMemo(() => {
    return onlinePresenceList.filter((p) => {
      if (!p.isOnline) return false;
      const seenMs = toMillis(p.lastSeenAt);
      return seenMs === 0 || nowTick - seenMs < PRESENCE_TTL_MS;
    });
  }, [onlinePresenceList, nowTick]);

  const onlineUids = useMemo(() => {
    const set = new Set(freshOnlineList.map((p) => p.uid));
    if (user) set.add(user.uid);
    return set;
  }, [freshOnlineList, user]);

  const totalRegistered =
    citizens.length > 0
      ? citizens.length
      : (registryCounter?.totalRegistered ?? civ?.population ?? 0);
  const onlineCount = onlineUids.size;

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Sign-in failed');
    }
  };

  const handleSignOut = async () => {
    if (user) {
      await markCitizenOffline(user.uid, myCitizenRef.current);
    }
    await signOutUser();
    setProfileOpen(false);
    setFounderOpen(false);
    setWorldFullscreen(false);
  };

  const handleCastVote = async (decisionId: string, optionId: string) => {
    if (!user) return;
    try {
      await castCitizenVote(decisionId, optionId, user.uid);
      showToast(t.votedConfirmation);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Vote failed');
    }
  };

  const handleApproveDecision = async (
    decision: Decision,
    winningOption: DecisionOption,
    totalVotes: number,
    winningPct: number
  ) => {
    if (!user || !civ) return;
    try {
      await approveDecisionAndApply({
        decision,
        winningOption,
        totalVotes,
        winningPercentage: winningPct,
        civ,
        buildings,
        adminUid: user.uid,
      });
      showToast(
        lang === 'ar'
          ? 'تم اعتماد القرار وتشغيل المحاكاة اليومية'
          : 'Decision approved & daily simulation executed'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Simulation failed');
    }
  };

  const handleSeedManual = async () => {
    if (!user) return;
    try {
      await seedOrResetTo100Citizens(user.uid, true);
      showToast(
        lang === 'ar'
          ? 'تمت تهيئة الجزيرة بناءً على المواطنين المسجلين (اليوم ١)'
          : 'Island initialized at Day 1 synced with registered citizens'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Initialization failed');
    }
  };

  const handleSaveWorldPosition = useCallback(
    (pos: CitizenWorldPosition, xpGain = 0) => {
      if (!user) return;
      void saveCitizenWorldState(user.uid, pos, xpGain);
    },
    [user]
  );

  const handleUpdatePresence = useCallback(
    (state: {
      x: number;
      y: number;
      z: number;
      yaw: number;
      speed: number;
      isInWorld: boolean;
    }) => {
      if (!myCitizenRef.current) return;
      void upsertWorldPresence(myCitizenRef.current, {
        ...state,
        isOnline: true,
      });
    },
    []
  );

  const handleUpdateAvatarColor = useCallback(
    (avatarColor: string) => {
      if (!user) return;
      void updateCitizenProfileDetails(user.uid, { avatarColor });
    },
    [user]
  );

  return (
    <WorldErrorBoundary>
      <div id="top" className="min-h-screen bg-[#071118] text-slate-100">
        {!worldFullscreen && (
          <TopNav
            lang={lang}
            user={user}
            citizen={myCitizen}
            isAdmin={isAdmin}
            onSignIn={handleSignIn}
            onOpenProfile={() => setProfileOpen(true)}
            onOpenFounder={() => setFounderOpen(true)}
          />
        )}

        {/* Toast Banner */}
        {toast && (
          <div
            role="status"
            className="fixed bottom-5 end-5 z-50 rounded-xl border border-amber-500/50 bg-[#0d1f2a] px-4 py-3 text-xs sm:text-sm font-medium text-amber-200 shadow-xl"
          >
            {toast}
          </div>
        )}

        <main
          className={
            worldFullscreen
              ? 'm-0 p-0'
              : 'mx-auto max-w-[1440px] space-y-8 px-4 py-6 sm:px-8 sm:py-8'
          }
        >
          {/* Hero / Civilization Workspace Header (hidden in Fullscreen 3D Play Mode) */}
          {!worldFullscreen && (
            <section className="flex flex-col gap-5 border-b border-emerald-900/40 pb-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-emerald-300">
                  <span>{t.heroKicker}</span>
                  {civ && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-amber-300">
                        {lang === 'ar' ? civ.islandNameAr : civ.islandNameEn}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{lang === 'ar' ? civ.eraAr : civ.eraEn}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-data tabular-nums">
                        {t.dayLabel} {civ.dayNumber}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-data tabular-nums">
                        {t.tierLabel} {civ.level}
                      </span>
                    </>
                  )}
                </div>

                <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white text-balance">
                  {t.heroTitle}
                </h1>

                <p className="text-sm sm:text-base leading-relaxed text-slate-300">
                  {t.heroSubtitle}
                </p>
              </div>

              {/* Workspace Controls: Enter World CTA, Live Citizen Registry & Online Stats, Language Switch */}
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setWorldFullscreen(true)}
                  className="flex min-h-[42px] items-center gap-2 rounded-xl bg-amber-500 px-5 py-2 text-sm font-bold text-[#071118] shadow-lg transition-colors hover:bg-amber-400 cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                  <span>{t.enterWorldBtn}</span>
                </button>

                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-900/50 bg-[#0b1b24] px-3.5 py-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Globe2 className="h-4 w-4 text-sky-400" aria-hidden="true" />
                    <span className="font-mono-data font-bold text-white tabular-nums">
                      {totalRegistered.toLocaleString('en-US')}
                    </span>
                    <span className="text-slate-400">{t.citizensLabel}</span>
                  </div>
                  <span aria-hidden="true" className="text-emerald-900">
                    |
                  </span>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Radio className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                    <span className="font-mono-data font-bold text-emerald-300 tabular-nums">
                      {onlineCount.toLocaleString('en-US')}
                    </span>
                    <span className="text-slate-400">{t.onlineCitizensLabel}</span>
                  </div>
                </div>

                <div
                  role="group"
                  aria-label="Language switcher"
                  className="flex items-center gap-1 rounded-lg border border-emerald-900/60 bg-[#0b1b24] p-1"
                >
                  <button
                    type="button"
                    onClick={() => setLang('ar')}
                    className={`min-h-[36px] rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      lang === 'ar'
                        ? 'bg-amber-500 text-[#071118]'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    العربية
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang('en')}
                    className={`min-h-[36px] rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      lang === 'en'
                        ? 'bg-amber-500 text-[#071118]'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Founding Charter Notice if Firestore is empty on very first boot */}
          {!worldFullscreen && civLoaded && !civ && (
            <section className="rounded-2xl border border-amber-500/40 bg-[#0d1f2a] p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2 text-amber-300">
                    <Sparkles className="h-5 w-5" aria-hidden="true" />
                    <h2 className="text-lg font-bold text-white">{t.awaitingSeedTitle}</h2>
                  </div>
                  <p className="text-sm text-slate-300">{t.awaitingSeedDesc}</p>
                </div>

                {isAdmin ? (
                  <button
                    type="button"
                    onClick={handleSeedManual}
                    className="flex min-h-[44px] items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-[#071118] hover:bg-amber-400 cursor-pointer"
                  >
                    <Shield className="h-4 w-4" aria-hidden="true" />
                    <span>{t.initializeWorldBtn}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSignIn}
                    className="min-h-[44px] rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-[#071118] hover:bg-amber-400 cursor-pointer"
                  >
                    {t.signInGoogle}
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Civilization Metrics HUD (includes Registered Citizens + Online Now + Resources) */}
          {!worldFullscreen && civ && (
            <CivilizationMetrics
              civ={civ}
              lang={lang}
              totalRegistered={totalRegistered}
              onlineCount={onlineCount}
            />
          )}

          {/* Interactive 3D Island World (keeps WebGL mounted seamlessly across preview & fullscreen play) */}
          <IslandMap
            lang={lang}
            buildings={buildings}
            civ={civ}
            citizen={myCitizen}
            totalRegistered={totalRegistered}
            onlineCitizens={freshOnlineList}
            worldFullscreen={worldFullscreen}
            onEnterWorld={() => setWorldFullscreen(true)}
            onExitWorld={() => setWorldFullscreen(false)}
            pickMode={pickMode}
            onPickCoordinate={(x, y) => {
              setPickedCoords({ x, y });
              setPickMode(false);
              setFounderOpen(true);
            }}
            onSaveWorldPosition={handleSaveWorldPosition}
            onUpdatePresence={handleUpdatePresence}
            onUpdateAvatarColor={handleUpdateAvatarColor}
          />

          {/* Large Dashboard Info Panels (hidden while walking inside Fullscreen 3D World) */}
          {!worldFullscreen && (
            <>
              <DailyDecisionPanel
                lang={lang}
                decision={activeDecision}
                votes={activeVotes}
                user={user}
                citizen={myCitizen}
                isAdmin={isAdmin}
                onCastVote={handleCastVote}
                onApproveDecision={handleApproveDecision}
                onCloseDecision={async (id) => {
                  await closeOrRejectDecision(id, 'closed');
                  showToast(lang === 'ar' ? 'تم إغلاق التصويت' : 'Decision closed');
                }}
                onSignIn={handleSignIn}
              />

              <SimulationEventsSection lang={lang} events={events} />

              <ChronicleSection lang={lang} chronicles={chronicles} />

              <NewsSection lang={lang} news={news} />
            </>
          )}
        </main>

        {/* Clean Minimal Footer */}
        {!worldFullscreen && (
          <footer className="mt-12 border-t border-emerald-900/40 bg-[#050d13] py-6">
            <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 text-xs text-slate-400 sm:px-8">
              <span className="font-display-en font-semibold tracking-wider text-amber-300">
                NEW WORLD
              </span>
              <span>{t.futureModulesNote}</span>
            </div>
          </footer>
        )}

        {/* Citizen Profile Modal */}
        <CitizenProfileModal
          open={profileOpen}
          lang={lang}
          user={user}
          citizen={myCitizen}
          citizens={citizens}
          onlineUids={onlineUids}
          isAdmin={isAdmin}
          onClose={() => setProfileOpen(false)}
          onSignOut={handleSignOut}
          onOpenFounder={() => setFounderOpen(true)}
          onUpdateProfile={async (updates) => {
            if (!user) return;
            await updateCitizenProfileDetails(user.uid, updates);
            showToast(
              lang === 'ar' ? 'تم حفظ تحديثات ملف المواطن' : 'Citizen dossier updated'
            );
          }}
          onPurchaseAsset={async (assetId, price) => {
            if (!user) return;
            try {
              await purchaseCitizenAsset(user.uid, assetId, price);
              showToast(
                lang === 'ar' ? 'تم تسجيل الملكية في ملفك بنجاح' : 'Property acquired!'
              );
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'Purchase failed');
            }
          }}
        />

        {/* Founder Governance Console */}
        {isAdmin && user && (
          <FounderConsole
            open={founderOpen}
            lang={lang}
            civ={civ}
            buildings={buildings}
            decisions={decisions}
            news={news}
            citizens={citizens}
            adminUid={user.uid}
            pickedCoords={pickedCoords}
            onStartMapPick={() => {
              setFounderOpen(false);
              setPickMode(true);
              document.getElementById('island-map')?.scrollIntoView({ behavior: 'smooth' });
            }}
            onClose={() => setFounderOpen(false)}
            onUpdateCiv={async (updates) => {
              await updateCivilizationMetrics(DEFAULT_CIV_ID, updates);
              showToast(lang === 'ar' ? 'تم تحديث موارد الحضارة' : 'Civilization updated');
            }}
            onResetTo100Citizens={handleSeedManual}
            onCreateDecision={async (payload) => {
              await createDecision({
                civId: DEFAULT_CIV_ID,
                ...payload,
                adminUid: user.uid,
              });
              showToast(lang === 'ar' ? 'تم نشر القرار الجديد' : 'New decision published');
            }}
            onSaveBuilding={async (id, data) => {
              await saveBuilding(id, { civId: DEFAULT_CIV_ID, ...data }, user.uid);
              showToast(lang === 'ar' ? 'تم حفظ المنشأة على الخريطة' : 'Structure saved');
            }}
            onDeleteBuilding={async (id) => {
              await deleteBuilding(id);
              showToast(lang === 'ar' ? 'تم حذف المنشأة' : 'Structure deleted');
            }}
            onPublishNews={async (data) => {
              await publishNews({ civId: DEFAULT_CIV_ID, ...data }, user.uid);
              showToast(lang === 'ar' ? 'تم نشر الخبر' : 'News published');
            }}
            onDeleteNews={async (id) => {
              await deleteNews(id);
              showToast(lang === 'ar' ? 'تم حذف الخبر' : 'Dispatch deleted');
            }}
            onToggleCitizenStatus={async (uid, status) => {
              await setCitizenStatus(uid, status);
              showToast(lang === 'ar' ? 'تم تحديث حالة المواطن' : 'Citizen status updated');
            }}
            onToggleCitizenAdmin={async (targetUid, makeAdmin) => {
              await toggleCitizenAdmin(targetUid, makeAdmin, user.uid);
              showToast(lang === 'ar' ? 'تم تحديث الصلاحيات' : 'Permissions updated');
            }}
          />
        )}
      </div>
    </WorldErrorBoundary>
  );
}
