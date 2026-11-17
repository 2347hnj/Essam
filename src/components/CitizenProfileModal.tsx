import { User } from 'firebase/auth';
import {
  Award,
  Briefcase,
  Calendar,
  Coins,
  Hash,
  Home,
  LogOut,
  Palette,
  Shield,
  Sparkles,
  Users,
  Vote,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { getCitizenRank, TRANSLATIONS } from '../i18n/translations';
import {
  AVATAR_COLOR_PALETTE,
  CITIZEN_PROFESSIONS,
  ISLAND_ASSETS_CATALOG,
  toMillis,
} from '../lib/worldService';
import { CitizenProfile, Lang } from '../types/world';

interface CitizenProfileModalProps {
  open: boolean;
  lang: Lang;
  user: User | null;
  citizen: CitizenProfile | null;
  citizens: CitizenProfile[];
  onlineUids: Set<string>;
  isAdmin: boolean;
  onClose: () => void;
  onSignOut: () => void;
  onOpenFounder: () => void;
  onUpdateProfile: (updates: {
    professionEn?: string;
    professionAr?: string;
    avatarColor?: string;
  }) => Promise<void>;
  onPurchaseAsset: (assetId: string, price: number) => Promise<void>;
}

export function CitizenProfileModal({
  open,
  lang,
  user,
  citizen,
  citizens,
  onlineUids,
  isAdmin,
  onClose,
  onSignOut,
  onOpenFounder,
  onUpdateProfile,
  onPurchaseAsset,
}: CitizenProfileModalProps) {
  const [busyAsset, setBusyAsset] = useState<string | null>(null);

  if (!open || !user) return null;
  const t = TRANSLATIONS[lang];

  const votesCount = citizen?.votesCount ?? 0;
  const participationsCount = citizen?.participationsCount ?? 0;
  const coins = citizen?.coins ?? 500;
  const xp = citizen?.xp ?? 0;
  const level = citizen?.level ?? 1;
  const xpInLevel = xp % 100;
  const ownedAssets = Array.isArray(citizen?.assets) ? citizen.assets : ['Pioneer Shelter'];
  const citizenshipCode = citizen?.citizenshipCode || 'NW-0001';
  const avatarColor = citizen?.avatarColor || AVATAR_COLOR_PALETTE[0];
  const professionEn = citizen?.professionEn || CITIZEN_PROFESSIONS[0].en;
  const professionAr = citizen?.professionAr || CITIZEN_PROFESSIONS[0].ar;
  const joinedMs = toMillis(citizen?.joinedAt);
  const joinedText = joinedMs
    ? new Date(joinedMs).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';
  const rank = getCitizenRank(votesCount, lang);

  const roleLabel =
    citizen?.role === 'founder'
      ? t.roleFounder
      : citizen?.role === 'admin' || isAdmin
        ? t.roleAdmin
        : t.roleCitizen;

  const selectedProfId =
    CITIZEN_PROFESSIONS.find((p) => p.en === professionEn || p.ar === professionAr)?.id ||
    CITIZEN_PROFESSIONS[0].id;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t.profileTitle}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-emerald-900/60 bg-[#0b1b24] p-5 sm:p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-emerald-900/40 pb-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-white">{t.profileTitle}</h2>
            <span className="rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 font-mono-data text-xs font-bold text-amber-300">
              {citizenshipCode}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Identity Header */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {citizen?.photoURL || user.photoURL ? (
              <img
                src={citizen?.photoURL || user.photoURL || ''}
                alt={citizen?.displayName || user.displayName || 'Citizen'}
                referrerPolicy="no-referrer"
                className="h-16 w-16 rounded-full border-2 object-cover"
                style={{ borderColor: avatarColor }}
              />
            ) : (
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full border-2 bg-emerald-900 text-xl font-bold text-amber-200"
                style={{ borderColor: avatarColor }}
              >
                {(user.displayName || 'C').charAt(0)}
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold text-white">
                {citizen?.displayName || user.displayName}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="font-medium text-amber-300">{roleLabel}</span>
                <span aria-hidden="true">·</span>
                <span>{rank}</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
                  {t.onlineStatus}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenFounder();
                }}
                className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 cursor-pointer"
              >
                <Shield className="h-4 w-4" aria-hidden="true" />
                <span>{t.navFounder}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onSignOut}
              className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>{t.signOut}</span>
            </button>
          </div>
        </div>

        {/* Core Citizen Dossier Fields */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 border-y border-emerald-900/40 py-4">
          <div className="rounded-xl border border-emerald-900/40 bg-[#08151d] p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Hash className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
              <span>{t.citizenshipNumberLabel}</span>
            </div>
            <div className="mt-1.5 font-mono-data text-base font-bold text-amber-300 tabular-nums">
              {citizenshipCode}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-900/40 bg-[#08151d] p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Calendar className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
              <span>{t.joinedAtLabel}</span>
            </div>
            <div className="mt-1.5 text-xs sm:text-sm font-semibold text-white">
              {joinedText}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-900/40 bg-[#08151d] p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Coins className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
              <span>{t.coinsLabel}</span>
            </div>
            <div className="mt-1.5 font-mono-data text-base font-bold text-emerald-300 tabular-nums">
              {coins.toLocaleString('en-US')}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-900/40 bg-[#08151d] p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
              <span>{t.xpLevelLabel}</span>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between font-mono-data text-sm font-bold text-white tabular-nums">
              <span>Lv.{level}</span>
              <span className="text-[11px] text-slate-400">{xp} XP</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-amber-400 transition-all"
                style={{ width: `${xpInLevel}%` }}
              />
            </div>
          </div>
        </div>

        {/* Profession & Avatar Color Customization */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-xl border border-emerald-900/40 bg-[#08151d] p-4">
          <label className="block space-y-1.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Briefcase className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
              <span>{t.professionLabel}</span>
            </span>
            <select
              value={selectedProfId}
              onChange={(e) => {
                const chosen = CITIZEN_PROFESSIONS.find((p) => p.id === e.target.value);
                if (chosen) {
                  void onUpdateProfile({ professionEn: chosen.en, professionAr: chosen.ar });
                }
              }}
              className="w-full rounded-lg border border-emerald-900/60 bg-[#071118] px-3 py-2 text-xs sm:text-sm text-white focus:border-amber-400 focus:outline-none"
            >
              {CITIZEN_PROFESSIONS.map((prof) => (
                <option key={prof.id} value={prof.id}>
                  {lang === 'ar' ? prof.ar : prof.en}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Palette className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
              <span>{t.avatarAppearanceLabel}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {AVATAR_COLOR_PALETTE.map((hex) => {
                const active = avatarColor === hex;
                return (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => void onUpdateProfile({ avatarColor: hex })}
                    style={{ backgroundColor: hex }}
                    aria-label={hex}
                    className={`h-7 w-7 rounded-full border-2 transition-transform cursor-pointer ${
                      active ? 'border-amber-300 scale-110' : 'border-slate-700 hover:scale-105'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Participation Counters */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-emerald-900/40 bg-[#08151d] p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Vote className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
              <span>{t.votesCast}</span>
            </div>
            <div className="mt-1 font-mono-data text-lg font-bold text-white tabular-nums">
              {votesCount}
            </div>
          </div>
          <div className="rounded-xl border border-emerald-900/40 bg-[#08151d] p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Users className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
              <span>{t.participations}</span>
            </div>
            <div className="mt-1 font-mono-data text-lg font-bold text-white tabular-nums">
              {participationsCount}
            </div>
          </div>
          <div className="rounded-xl border border-emerald-900/40 bg-[#08151d] p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Award className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
              <span>{t.rankLabel}</span>
            </div>
            <div className="mt-1 truncate text-xs sm:text-sm font-semibold text-amber-300">
              {rank}
            </div>
          </div>
        </div>

        {/* Citizen Properties / Assets & Marketplace */}
        <div className="mt-5 rounded-xl border border-emerald-900/40 bg-[#08151d] p-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-white">
              <Home className="h-4 w-4 text-amber-400" aria-hidden="true" />
              <span>{t.assetsMarketplaceLabel}</span>
            </h4>
            <span className="font-mono-data text-xs text-slate-400">
              {ownedAssets.length} / {ISLAND_ASSETS_CATALOG.length} {t.ownedBadge}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ISLAND_ASSETS_CATALOG.map((item) => {
              const owned = ownedAssets.includes(item.id);
              const affordable = coins >= item.price;
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
                    owned
                      ? 'border-emerald-700/60 bg-emerald-950/40'
                      : 'border-emerald-900/40 bg-[#071118]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-100">
                      {lang === 'ar' ? item.nameAr : item.nameEn}
                    </div>
                    <div className="font-mono-data text-[11px] text-amber-300">
                      {item.price === 0
                        ? t.ownedBadge
                        : `${item.price.toLocaleString('en-US')} ${t.coinsLabel}`}
                    </div>
                  </div>
                  {owned ? (
                    <span className="rounded bg-emerald-800/60 px-2 py-1 text-[11px] font-semibold text-emerald-200 shrink-0">
                      {t.ownedBadge}
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={!affordable || busyAsset === item.id}
                      onClick={async () => {
                        setBusyAsset(item.id);
                        try {
                          await onPurchaseAsset(item.id, item.price);
                        } finally {
                          setBusyAsset(null);
                        }
                      }}
                      className="rounded-md bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-[#071118] hover:bg-amber-400 disabled:opacity-40 cursor-pointer shrink-0"
                    >
                      {t.buyAssetBtn}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Registered Citizens Directory */}
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-slate-200">{t.citizensDirectory}</h4>
          <div className="mt-3 max-h-[200px] space-y-2 overflow-y-auto pe-1">
            {citizens.slice(0, 25).map((c) => {
              const isOnline = c.uid === user.uid || onlineUids.has(c.uid);
              return (
                <div
                  key={c.uid}
                  className="flex items-center justify-between gap-3 rounded-lg border border-emerald-900/30 bg-[#08151d] px-3 py-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        isOnline ? 'bg-emerald-400' : 'bg-slate-600'
                      }`}
                      title={isOnline ? t.onlineStatus : t.offlineStatus}
                    />
                    {c.photoURL ? (
                      <img
                        src={c.photoURL}
                        alt={c.displayName}
                        referrerPolicy="no-referrer"
                        className="h-7 w-7 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-900 text-xs font-semibold text-amber-200 shrink-0">
                        {c.displayName.charAt(0)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-200">
                        <span className="truncate">{c.displayName}</span>
                        {c.citizenshipCode && (
                          <span className="font-mono-data text-[10px] text-amber-300/80">
                            {c.citizenshipCode}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[11px] text-slate-400">
                        {lang === 'ar'
                          ? c.professionAr || CITIZEN_PROFESSIONS[0].ar
                          : c.professionEn || CITIZEN_PROFESSIONS[0].en}
                      </div>
                    </div>
                  </div>
                  <span className="font-mono-data text-xs text-amber-300 tabular-nums shrink-0">
                    Lv.{c.level ?? 1} · {c.votesCount} {t.votesCast}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
