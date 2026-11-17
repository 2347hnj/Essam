import {
  Anchor,
  Compass,
  Crosshair,
  Factory,
  FlaskConical,
  Hammer,
  HeartPulse,
  Landmark,
  Maximize2,
  Sprout,
  X,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { formatEffectList, TRANSLATIONS } from '../i18n/translations';
import {
  Building,
  BuildingCategory,
  BuildingStatus,
  CitizenProfile,
  CitizenWorldPosition,
  Civilization,
  Lang,
  WorldPresence,
} from '../types/world';
import { Island3DCanvas } from './Island3DCanvas';

interface IslandMapProps {
  lang: Lang;
  buildings: Building[];
  civ: Civilization | null;
  citizen: CitizenProfile | null;
  totalRegistered: number;
  onlineCitizens: WorldPresence[];
  worldFullscreen: boolean;
  onEnterWorld: () => void;
  onExitWorld: () => void;
  pickMode?: boolean;
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

const CATEGORY_ICONS: Record<BuildingCategory, React.ComponentType<{ className?: string }>> = {
  infrastructure: Anchor,
  agriculture: Sprout,
  factory: Factory,
  energy: Zap,
  civic: Landmark,
  science: FlaskConical,
  health: HeartPulse,
};

type CategoryFilter = 'all' | 'farms' | 'factories' | 'infra' | 'civic';

export function IslandMap({
  lang,
  buildings,
  civ,
  citizen,
  totalRegistered,
  onlineCitizens,
  worldFullscreen,
  onEnterWorld,
  onExitWorld,
  pickMode = false,
  onPickCoordinate,
  onSaveWorldPosition,
  onUpdatePresence,
  onUpdateAvatarColor,
}: IslandMapProps) {
  const t = TRANSLATIONS[lang];
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    buildings[0]?.id || null
  );
  const [focusRequestTick, setFocusRequestTick] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'all' | BuildingStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  useEffect(() => {
    if (!selectedBuildingId && buildings.length > 0) {
      setSelectedBuildingId(buildings[0].id);
    }
  }, [buildings, selectedBuildingId]);

  const matchesCategory = (cat: BuildingCategory) => {
    if (categoryFilter === 'all') return true;
    if (categoryFilter === 'farms') return cat === 'agriculture';
    if (categoryFilter === 'factories') return cat === 'factory';
    if (categoryFilter === 'infra') return cat === 'infrastructure' || cat === 'energy';
    return cat === 'civic' || cat === 'science' || cat === 'health';
  };

  const filteredBuildings = buildings.filter(
    (b) =>
      (statusFilter === 'all' ? true : b.status === statusFilter) &&
      matchesCategory(b.category)
  );

  const selectedBuilding =
    buildings.find((b) => b.id === selectedBuildingId) || null;

  const getStatusLabel = (status: BuildingStatus) => {
    if (status === 'completed') return t.statusCompleted;
    if (status === 'constructing') return t.statusConstructing;
    return t.statusPlanned;
  };

  const getCategoryLabel = (cat: BuildingCategory) => {
    const map: Record<BuildingCategory, string> = {
      infrastructure: t.categoryInfrastructure,
      agriculture: t.categoryAgriculture,
      factory: t.categoryFactory,
      energy: t.categoryEnergy,
      civic: t.categoryCivic,
      science: t.categoryScience,
      health: t.categoryHealth,
    };
    return map[cat];
  };

  const selectedOutputs = selectedBuilding
    ? formatEffectList(selectedBuilding.dailyOutput || {}, lang)
    : [];
  const selectedUpkeeps = selectedBuilding
    ? formatEffectList(selectedBuilding.dailyUpkeep || {}, lang)
    : [];

  return (
    <section
      id="island-map"
      className={
        worldFullscreen
          ? ''
          : 'rounded-2xl border border-emerald-900/50 bg-[#0b1b24] p-4 sm:p-5'
      }
    >
      {!worldFullscreen && (
        <>
          {/* Map Toolbar */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <Compass className="h-5 w-5 text-amber-400" aria-hidden="true" />
              <h2 className="text-base sm:text-lg font-semibold text-white">
                {t.islandOverview}
              </h2>
              <button
                type="button"
                onClick={onEnterWorld}
                className="flex min-h-[34px] items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-[#071118] hover:bg-amber-400 cursor-pointer"
              >
                <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.enterWorldBtn}</span>
              </button>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-emerald-900/50 bg-[#071118] p-1">
              {(['all', 'completed', 'constructing', 'planned'] as const).map((tab) => {
                const label =
                  tab === 'all'
                    ? t.filterAll
                    : tab === 'completed'
                      ? t.filterCompleted
                      : tab === 'constructing'
                        ? t.filterConstructing
                        : t.filterPlanned;
                const active = statusFilter === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setStatusFilter(tab)}
                    className={`min-h-[34px] rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-emerald-800/80 text-amber-200'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Structure Category Filter Row */}
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: t.catFilterAll },
                { id: 'farms', label: t.catFilterFarms },
                { id: 'factories', label: t.catFilterFactories },
                { id: 'infra', label: t.catFilterInfra },
                { id: 'civic', label: t.catFilterCivic },
              ] as const
            ).map((c) => {
              const active = categoryFilter === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryFilter(c.id)}
                  className={`min-h-[34px] rounded-lg border px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
                      : 'border-emerald-900/40 bg-[#08151d] text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          {pickMode && (
            <div className="mb-3 rounded-lg border border-amber-500/50 bg-amber-950/40 px-4 py-2.5 text-xs sm:text-sm font-medium text-amber-200">
              {t.pickModeHint}
            </div>
          )}
        </>
      )}

      {/* Interactive 3D Viewport + Detail Inspector Split */}
      <div className={worldFullscreen ? '' : 'grid grid-cols-1 gap-4 lg:grid-cols-12 items-stretch'}>
        <div className={worldFullscreen ? '' : 'lg:col-span-8'}>
          <Island3DCanvas
            lang={lang}
            buildings={filteredBuildings}
            allBuildings={buildings}
            civ={civ}
            citizen={citizen}
            totalRegistered={totalRegistered}
            onlineCitizens={onlineCitizens}
            selectedBuildingId={selectedBuildingId}
            focusRequestTick={focusRequestTick}
            pickMode={pickMode}
            worldFullscreen={worldFullscreen}
            onEnterWorld={onEnterWorld}
            onExitWorld={onExitWorld}
            onSelectBuilding={(id) => setSelectedBuildingId(id)}
            onPickCoordinate={onPickCoordinate}
            onSaveWorldPosition={onSaveWorldPosition}
            onUpdatePresence={onUpdatePresence}
            onUpdateAvatarColor={onUpdateAvatarColor}
          />
        </div>

        {/* Building / Farm / Factory Inspector & Project List */}
        {!worldFullscreen && (
        <div className="lg:col-span-4 flex flex-col justify-between rounded-xl border border-emerald-900/50 bg-[#08151d] p-4">
          {selectedBuilding ? (
            <div className="flex flex-col gap-3.5">
              <div className="flex items-start justify-between gap-2 border-b border-emerald-900/40 pb-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span>{getCategoryLabel(selectedBuilding.category)}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {t.buildingLevel} {selectedBuilding.level}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-300 font-medium">
                      {getStatusLabel(selectedBuilding.status)}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-lg font-semibold text-white">
                    {lang === 'ar' ? selectedBuilding.nameAr : selectedBuilding.nameEn}
                  </h3>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setFocusRequestTick((c) => c + 1)}
                    aria-label={t.focusBuilding}
                    title={t.focusBuilding}
                    className="flex h-8 items-center gap-1 rounded-md border border-emerald-800/60 bg-[#0b1b24] px-2 text-[11px] font-medium text-amber-300 hover:border-amber-400/60 hover:text-amber-200 cursor-pointer"
                  >
                    <Crosshair className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t.focusBuilding}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBuildingId(null)}
                    aria-label={t.close}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-slate-300">
                {lang === 'ar'
                  ? selectedBuilding.descriptionAr
                  : selectedBuilding.descriptionEn}
              </p>

              {/* Daily Production & Upkeep */}
              <div className="space-y-2 border-t border-emerald-900/40 pt-3">
                <div>
                  <div className="text-xs font-medium text-slate-400">
                    {t.dailyProductionLabel}
                  </div>
                  {selectedOutputs.length > 0 ? (
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-emerald-300">
                      {selectedOutputs.map((item, idx) => (
                        <span key={item} className="inline-flex items-center gap-2">
                          {idx > 0 && (
                            <span aria-hidden="true" className="text-slate-600">
                              ·
                            </span>
                          )}
                          <span className="tabular-nums">{item}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-slate-500">{t.noProductionData}</div>
                  )}
                </div>

                {selectedUpkeeps.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-slate-400">
                      {t.dailyUpkeepLabel}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-amber-300">
                      {selectedUpkeeps.map((item, idx) => (
                        <span key={item} className="inline-flex items-center gap-2">
                          {idx > 0 && (
                            <span aria-hidden="true" className="text-slate-600">
                              ·
                            </span>
                          )}
                          <span className="tabular-nums">-{item.replace(/^\+/, '')}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>{t.buildingProgress}</span>
                  <span className="font-mono-data font-semibold text-amber-300 tabular-nums">
                    {selectedBuilding.progress}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-300"
                    style={{ width: `${selectedBuilding.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center py-8 text-center text-sm text-slate-400">
              {t.controlsHint}
            </div>
          )}

          {/* Compact Project Index */}
          <div className="mt-4 border-t border-emerald-900/40 pt-3">
            <div className="flex max-h-[175px] flex-col gap-1.5 overflow-y-auto pe-1">
              {filteredBuildings.map((b) => {
                const active = selectedBuilding?.id === b.id;
                const Icon = CATEGORY_ICONS[b.category] || Hammer;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setSelectedBuildingId(b.id);
                      setFocusRequestTick((c) => c + 1);
                    }}
                    className={`flex min-h-[40px] items-center justify-between gap-2 rounded-lg px-3 py-2 text-start text-xs transition-colors cursor-pointer ${
                      active
                        ? 'bg-emerald-900/50 text-amber-200 border border-amber-500/30'
                        : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate font-medium">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-amber-300/80" aria-hidden="true" />
                      <span className="truncate">
                        {lang === 'ar' ? b.nameAr : b.nameEn}
                      </span>
                    </span>
                    <span className="font-mono-data text-[11px] text-slate-400 tabular-nums shrink-0">
                      {b.progress}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        )}
      </div>
    </section>
  );
}
