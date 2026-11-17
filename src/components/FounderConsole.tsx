import {
  Building2,
  Edit3,
  MapPin,
  Newspaper,
  Plus,
  RotateCcw,
  Shield,
  Sliders,
  Trash2,
  Users,
  Vote,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { formatEffectList, TRANSLATIONS } from '../i18n/translations';
import {
  Building,
  BuildingCategory,
  BuildingStatus,
  CitizenProfile,
  Civilization,
  Decision,
  DecisionCategory,
  DecisionOption,
  Lang,
  NewsBulletin,
  NewsCategory,
} from '../types/world';

interface FounderConsoleProps {
  open: boolean;
  lang: Lang;
  civ: Civilization | null;
  buildings: Building[];
  decisions: Decision[];
  news: NewsBulletin[];
  citizens: CitizenProfile[];
  adminUid: string;
  pickedCoords: { x: number; y: number } | null;
  onStartMapPick: () => void;
  onClose: () => void;
  onUpdateCiv: (updates: Partial<Civilization>) => Promise<void>;
  onResetTo100Citizens: () => Promise<void>;
  onCreateDecision: (payload: {
    titleEn: string;
    titleAr: string;
    descriptionEn: string;
    descriptionAr: string;
    category: DecisionCategory;
    durationHours: number;
    options: DecisionOption[];
  }) => Promise<void>;
  onSaveBuilding: (
    buildingId: string | null,
    data: {
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
      dailyOutput: Record<string, number>;
      dailyUpkeep: Record<string, number>;
    }
  ) => Promise<void>;
  onDeleteBuilding: (id: string) => Promise<void>;
  onPublishNews: (data: {
    titleEn: string;
    titleAr: string;
    bodyEn: string;
    bodyAr: string;
    category: NewsCategory;
  }) => Promise<void>;
  onDeleteNews: (id: string) => Promise<void>;
  onToggleCitizenStatus: (uid: string, nextStatus: 'active' | 'suspended') => Promise<void>;
  onToggleCitizenAdmin: (uid: string, makeAdmin: boolean) => Promise<void>;
}

type ConsoleTab = 'decisions' | 'resources' | 'buildings' | 'news' | 'users';

export function FounderConsole({
  open,
  lang,
  civ,
  buildings,
  decisions,
  news,
  citizens,
  adminUid,
  pickedCoords,
  onStartMapPick,
  onClose,
  onUpdateCiv,
  onResetTo100Citizens,
  onCreateDecision,
  onSaveBuilding,
  onDeleteBuilding,
  onPublishNews,
  onDeleteNews,
  onToggleCitizenStatus,
  onToggleCitizenAdmin,
}: FounderConsoleProps) {
  const t = TRANSLATIONS[lang];
  const [tab, setTab] = useState<ConsoleTab>('decisions');
  const [busy, setBusy] = useState(false);

  // Resources form state
  const [civForm, setCivForm] = useState({
    eraEn: civ?.eraEn || '',
    eraAr: civ?.eraAr || '',
    dayNumber: civ?.dayNumber || 1,
    level: civ?.level || 1,
    population: civ?.population || 100,
    food: civ?.food || 72,
    water: civ?.water || 78,
    energy: civ?.energy || 65,
    treasury: civ?.treasury || 12000,
    health: civ?.health || 80,
    education: civ?.education || 60,
    happiness: civ?.happiness || 82,
  });

  useEffect(() => {
    if (civ) {
      setCivForm({
        eraEn: civ.eraEn,
        eraAr: civ.eraAr,
        dayNumber: civ.dayNumber,
        level: civ.level,
        population: civ.population,
        food: civ.food,
        water: civ.water,
        energy: civ.energy,
        treasury: civ.treasury,
        health: civ.health,
        education: civ.education,
        happiness: civ.happiness,
      });
    }
  }, [civ]);

  // Decision builder state
  const [decTitleEn, setDecTitleEn] = useState('');
  const [decTitleAr, setDecTitleAr] = useState('');
  const [decDescEn, setDecDescEn] = useState('');
  const [decDescAr, setDecDescAr] = useState('');
  const [decCat, setDecCat] = useState<DecisionCategory>('infrastructure');
  const [decHours, setDecHours] = useState(24);
  const [opt1LabelEn, setOpt1LabelEn] = useState('');
  const [opt1LabelAr, setOpt1LabelAr] = useState('');
  const [opt1SummaryEn, setOpt1SummaryEn] = useState('');
  const [opt1SummaryAr, setOpt1SummaryAr] = useState('');
  const [opt1Happiness, setOpt1Happiness] = useState(5);
  const [opt1Treasury, setOpt1Treasury] = useState(-1500);
  const [opt1Energy, setOpt1Energy] = useState(6);
  const [opt1BuildCat, setOpt1BuildCat] = useState<BuildingCategory>('factory');
  const [opt2LabelEn, setOpt2LabelEn] = useState('');
  const [opt2LabelAr, setOpt2LabelAr] = useState('');
  const [opt2SummaryEn, setOpt2SummaryEn] = useState('');
  const [opt2SummaryAr, setOpt2SummaryAr] = useState('');
  const [opt2Food, setOpt2Food] = useState(10);
  const [opt2Water, setOpt2Water] = useState(8);
  const [opt2Happiness, setOpt2Happiness] = useState(4);
  const [opt2BuildCat, setOpt2BuildCat] = useState<BuildingCategory>('agriculture');

  // Building / Farm / Factory form state (supports Add & Edit)
  const [editingBldId, setEditingBldId] = useState<string | null>(null);
  const [bldNameEn, setBldNameEn] = useState('');
  const [bldNameAr, setBldNameAr] = useState('');
  const [bldDescEn, setBldDescEn] = useState('');
  const [bldDescAr, setBldDescAr] = useState('');
  const [bldCat, setBldCat] = useState<BuildingCategory>('agriculture');
  const [bldStatus, setBldStatus] = useState<BuildingStatus>('constructing');
  const [bldProgress, setBldProgress] = useState(25);
  const [bldLevel, setBldLevel] = useState(1);
  const [bldX, setBldX] = useState(50);
  const [bldY, setBldY] = useState(50);
  const [bldOutFood, setBldOutFood] = useState(8);
  const [bldOutWater, setBldOutWater] = useState(0);
  const [bldOutEnergy, setBldOutEnergy] = useState(0);
  const [bldOutTreasury, setBldOutTreasury] = useState(0);
  const [bldUpkeepTreasury, setBldUpkeepTreasury] = useState(150);

  useEffect(() => {
    if (pickedCoords) {
      setBldX(pickedCoords.x);
      setBldY(pickedCoords.y);
      setTab('buildings');
    }
  }, [pickedCoords]);

  // News form state
  const [newsTitleEn, setNewsTitleEn] = useState('');
  const [newsTitleAr, setNewsTitleAr] = useState('');
  const [newsBodyEn, setNewsBodyEn] = useState('');
  const [newsBodyAr, setNewsBodyAr] = useState('');
  const [newsCat, setNewsCat] = useState<NewsCategory>('announcement');

  if (!open) return null;

  const resetBuildingForm = () => {
    setEditingBldId(null);
    setBldNameEn('');
    setBldNameAr('');
    setBldDescEn('');
    setBldDescAr('');
    setBldCat('agriculture');
    setBldStatus('constructing');
    setBldProgress(25);
    setBldLevel(1);
    setBldOutFood(8);
    setBldOutWater(0);
    setBldOutEnergy(0);
    setBldOutTreasury(0);
    setBldUpkeepTreasury(150);
  };

  const startEditBuilding = (b: Building) => {
    setEditingBldId(b.id);
    setBldNameEn(b.nameEn);
    setBldNameAr(b.nameAr);
    setBldDescEn(b.descriptionEn);
    setBldDescAr(b.descriptionAr);
    setBldCat(b.category);
    setBldStatus(b.status);
    setBldProgress(b.progress);
    setBldLevel(b.level);
    setBldX(b.xPercent);
    setBldY(b.yPercent);
    setBldOutFood(b.dailyOutput?.food || 0);
    setBldOutWater(b.dailyOutput?.water || 0);
    setBldOutEnergy(b.dailyOutput?.energy || 0);
    setBldOutTreasury(b.dailyOutput?.treasury || 0);
    setBldUpkeepTreasury(b.dailyUpkeep?.treasury || 0);
  };

  const handleSaveCiv = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { population: _ignoredPop, ...metricUpdates } = civForm;
      await onUpdateCiv({ ...metricUpdates, population: citizens.length });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateDec = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decTitleAr || !opt1LabelAr || !opt2LabelAr) return;
    setBusy(true);
    try {
      await onCreateDecision({
        titleEn: decTitleEn || decTitleAr,
        titleAr: decTitleAr,
        descriptionEn: decDescEn || decDescAr || decTitleAr,
        descriptionAr: decDescAr || decTitleAr,
        category: decCat,
        durationHours: decHours,
        options: [
          {
            id: 'opt_a',
            labelEn: opt1LabelEn || opt1LabelAr,
            labelAr: opt1LabelAr,
            summaryEn: opt1SummaryEn || opt1SummaryAr || opt1LabelAr,
            summaryAr: opt1SummaryAr || opt1LabelAr,
            effects: {
              happiness: opt1Happiness,
              treasury: opt1Treasury,
              energy: opt1Energy,
            },
            spawnBuilding: {
              nameEn: opt1LabelEn || opt1LabelAr,
              nameAr: opt1LabelAr,
              descriptionEn: opt1SummaryEn || opt1SummaryAr || opt1LabelAr,
              descriptionAr: opt1SummaryAr || opt1LabelAr,
              category: opt1BuildCat,
              status: 'completed',
              progress: 100,
              xPercent: 45,
              yPercent: 54,
              dailyOutput:
                opt1BuildCat === 'energy'
                  ? { energy: 7 }
                  : opt1BuildCat === 'factory'
                    ? { treasury: 800 }
                    : { happiness: 4 },
            },
          },
          {
            id: 'opt_b',
            labelEn: opt2LabelEn || opt2LabelAr,
            labelAr: opt2LabelAr,
            summaryEn: opt2SummaryEn || opt2SummaryAr || opt2LabelAr,
            summaryAr: opt2SummaryAr || opt2LabelAr,
            effects: {
              food: opt2Food,
              water: opt2Water,
              happiness: opt2Happiness,
            },
            spawnBuilding: {
              nameEn: opt2LabelEn || opt2LabelAr,
              nameAr: opt2LabelAr,
              descriptionEn: opt2SummaryEn || opt2SummaryAr || opt2LabelAr,
              descriptionAr: opt2SummaryAr || opt2LabelAr,
              category: opt2BuildCat,
              status: 'completed',
              progress: 100,
              xPercent: 60,
              yPercent: 62,
              dailyOutput:
                opt2BuildCat === 'agriculture'
                  ? { food: 8 }
                  : opt2BuildCat === 'infrastructure'
                    ? { water: 8 }
                    : { health: 5 },
            },
          },
        ],
      });
      setDecTitleEn('');
      setDecTitleAr('');
      setDecDescEn('');
      setDecDescAr('');
      setOpt1LabelEn('');
      setOpt1LabelAr('');
      setOpt2LabelEn('');
      setOpt2LabelAr('');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveBld = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bldNameAr) return;
    setBusy(true);
    try {
      const dailyOutput: Record<string, number> = {};
      if (bldOutFood !== 0) dailyOutput.food = bldOutFood;
      if (bldOutWater !== 0) dailyOutput.water = bldOutWater;
      if (bldOutEnergy !== 0) dailyOutput.energy = bldOutEnergy;
      if (bldOutTreasury !== 0) dailyOutput.treasury = bldOutTreasury;

      const dailyUpkeep: Record<string, number> = {};
      if (bldUpkeepTreasury !== 0) dailyUpkeep.treasury = bldUpkeepTreasury;

      await onSaveBuilding(editingBldId, {
        nameEn: bldNameEn || bldNameAr,
        nameAr: bldNameAr,
        descriptionEn: bldDescEn || bldDescAr || bldNameAr,
        descriptionAr: bldDescAr || bldNameAr,
        category: bldCat,
        status: bldStatus,
        progress: bldProgress,
        level: bldLevel,
        xPercent: bldX,
        yPercent: bldY,
        dailyOutput,
        dailyUpkeep,
      });
      resetBuildingForm();
    } finally {
      setBusy(false);
    }
  };

  const handleAddNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsTitleAr || !newsBodyAr) return;
    setBusy(true);
    try {
      await onPublishNews({
        titleEn: newsTitleEn || newsTitleAr,
        titleAr: newsTitleAr,
        bodyEn: newsBodyEn || newsBodyAr,
        bodyAr: newsBodyAr,
        category: newsCat,
      });
      setNewsTitleEn('');
      setNewsTitleAr('');
      setNewsBodyEn('');
      setNewsBodyAr('');
    } finally {
      setBusy(false);
    }
  };

  const tabs: Array<{
    id: ConsoleTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'decisions', label: t.tabDecisions, icon: Vote },
    { id: 'resources', label: t.tabResources, icon: Sliders },
    { id: 'buildings', label: t.tabBuildings, icon: Building2 },
    { id: 'news', label: t.tabNews, icon: Newspaper },
    { id: 'users', label: t.tabUsers, icon: Users },
  ];

  const inputClass =
    'w-full rounded-lg border border-emerald-900/60 bg-[#071118] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t.founderConsoleTitle}
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-amber-500/30 bg-[#0b1b24] shadow-2xl">
        {/* Console Header */}
        <div className="flex items-center justify-between border-b border-emerald-900/50 px-5 py-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-amber-400" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-bold text-white">{t.founderConsoleTitle}</h2>
              <p className="text-xs text-slate-400">{t.founderConsoleSubtitle}</p>
            </div>
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

        {/* Navigation Tabs */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-emerald-900/40 bg-[#08151d] px-5 py-2.5">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex min-h-[38px] items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-amber-500 text-[#071118]'
                    : 'text-slate-300 hover:bg-emerald-950/60 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {tab === 'decisions' && (
            <div className="space-y-6">
              <form onSubmit={handleCreateDec} className="space-y-4">
                <h3 className="text-base font-semibold text-amber-300">{t.createDecision}</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    required
                    value={decTitleAr}
                    onChange={(e) => setDecTitleAr(e.target.value)}
                    placeholder="عنوان القرار (عربي)"
                    className={inputClass}
                  />
                  <input
                    value={decTitleEn}
                    onChange={(e) => setDecTitleEn(e.target.value)}
                    placeholder="Decision Title (English)"
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <textarea
                    rows={2}
                    value={decDescAr}
                    onChange={(e) => setDecDescAr(e.target.value)}
                    placeholder="وصف القرار وتأثيره (عربي)"
                    className={inputClass}
                  />
                  <textarea
                    rows={2}
                    value={decDescEn}
                    onChange={(e) => setDecDescEn(e.target.value)}
                    placeholder="Decision description (English)"
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <select
                    value={decCat}
                    onChange={(e) => setDecCat(e.target.value as DecisionCategory)}
                    className={inputClass}
                  >
                    <option value="infrastructure">{t.categoryInfrastructure}</option>
                    <option value="ecology">{t.categoryEcology}</option>
                    <option value="economy">{t.categoryEconomy}</option>
                    <option value="society">{t.categorySociety}</option>
                    <option value="science">{t.categoryScience}</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={decHours}
                    onChange={(e) => setDecHours(Number(e.target.value))}
                    placeholder="Hours"
                    className={inputClass}
                  />
                </div>

                {/* Option A & Option B */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2.5 rounded-xl border border-emerald-900/40 bg-[#08151d] p-4">
                    <div className="text-xs font-semibold text-emerald-300">Option A</div>
                    <input
                      required
                      value={opt1LabelAr}
                      onChange={(e) => setOpt1LabelAr(e.target.value)}
                      placeholder="اسم الخيار الأول (عربي)"
                      className={inputClass}
                    />
                    <input
                      value={opt1LabelEn}
                      onChange={(e) => setOpt1LabelEn(e.target.value)}
                      placeholder="Option 1 Label (English)"
                      className={inputClass}
                    />
                    <input
                      value={opt1SummaryAr}
                      onChange={(e) => setOpt1SummaryAr(e.target.value)}
                      placeholder="ملخص الخيار الأول (عربي)"
                      className={inputClass}
                    />
                    <input
                      value={opt1SummaryEn}
                      onChange={(e) => setOpt1SummaryEn(e.target.value)}
                      placeholder="Option 1 Summary (English)"
                      className={inputClass}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <label className="text-xs text-slate-400">
                        {t.metricHappiness} % Δ
                        <input
                          type="number"
                          value={opt1Happiness}
                          onChange={(e) => setOpt1Happiness(Number(e.target.value))}
                          className={`mt-1 ${inputClass}`}
                        />
                      </label>
                      <label className="text-xs text-slate-400">
                        {t.metricTreasury} Δ
                        <input
                          type="number"
                          value={opt1Treasury}
                          onChange={(e) => setOpt1Treasury(Number(e.target.value))}
                          className={`mt-1 ${inputClass}`}
                        />
                      </label>
                      <label className="text-xs text-slate-400">
                        {t.metricEnergy} % Δ
                        <input
                          type="number"
                          value={opt1Energy}
                          onChange={(e) => setOpt1Energy(Number(e.target.value))}
                          className={`mt-1 ${inputClass}`}
                        />
                      </label>
                    </div>
                    <label className="block text-xs text-slate-400">
                      {t.linkedStructureOptional}
                      <select
                        value={opt1BuildCat}
                        onChange={(e) => setOpt1BuildCat(e.target.value as BuildingCategory)}
                        className={`mt-1 ${inputClass}`}
                      >
                        <option value="factory">{t.categoryFactory}</option>
                        <option value="agriculture">{t.categoryAgriculture}</option>
                        <option value="infrastructure">{t.categoryInfrastructure}</option>
                        <option value="energy">{t.categoryEnergy}</option>
                        <option value="civic">{t.categoryCivic}</option>
                        <option value="science">{t.categoryScience}</option>
                        <option value="health">{t.categoryHealth}</option>
                      </select>
                    </label>
                  </div>

                  <div className="space-y-2.5 rounded-xl border border-emerald-900/40 bg-[#08151d] p-4">
                    <div className="text-xs font-semibold text-sky-300">Option B</div>
                    <input
                      required
                      value={opt2LabelAr}
                      onChange={(e) => setOpt2LabelAr(e.target.value)}
                      placeholder="اسم الخيار الثاني (عربي)"
                      className={inputClass}
                    />
                    <input
                      value={opt2LabelEn}
                      onChange={(e) => setOpt2LabelEn(e.target.value)}
                      placeholder="Option 2 Label (English)"
                      className={inputClass}
                    />
                    <input
                      value={opt2SummaryAr}
                      onChange={(e) => setOpt2SummaryAr(e.target.value)}
                      placeholder="ملخص الخيار الثاني (عربي)"
                      className={inputClass}
                    />
                    <input
                      value={opt2SummaryEn}
                      onChange={(e) => setOpt2SummaryEn(e.target.value)}
                      placeholder="Option 2 Summary (English)"
                      className={inputClass}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <label className="text-xs text-slate-400">
                        {t.metricFood} % Δ
                        <input
                          type="number"
                          value={opt2Food}
                          onChange={(e) => setOpt2Food(Number(e.target.value))}
                          className={`mt-1 ${inputClass}`}
                        />
                      </label>
                      <label className="text-xs text-slate-400">
                        {t.metricWater} % Δ
                        <input
                          type="number"
                          value={opt2Water}
                          onChange={(e) => setOpt2Water(Number(e.target.value))}
                          className={`mt-1 ${inputClass}`}
                        />
                      </label>
                      <label className="text-xs text-slate-400">
                        {t.metricHappiness} % Δ
                        <input
                          type="number"
                          value={opt2Happiness}
                          onChange={(e) => setOpt2Happiness(Number(e.target.value))}
                          className={`mt-1 ${inputClass}`}
                        />
                      </label>
                    </div>
                    <label className="block text-xs text-slate-400">
                      {t.linkedStructureOptional}
                      <select
                        value={opt2BuildCat}
                        onChange={(e) => setOpt2BuildCat(e.target.value as BuildingCategory)}
                        className={`mt-1 ${inputClass}`}
                      >
                        <option value="agriculture">{t.categoryAgriculture}</option>
                        <option value="infrastructure">{t.categoryInfrastructure}</option>
                        <option value="factory">{t.categoryFactory}</option>
                        <option value="energy">{t.categoryEnergy}</option>
                        <option value="civic">{t.categoryCivic}</option>
                        <option value="science">{t.categoryScience}</option>
                        <option value="health">{t.categoryHealth}</option>
                      </select>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="flex min-h-[42px] items-center gap-2 rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-[#071118] hover:bg-amber-400 disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>{t.createDecision}</span>
                </button>
              </form>

              <div className="border-t border-emerald-900/40 pt-4">
                <div className="space-y-2">
                  {decisions.slice(0, 6).map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-emerald-900/40 bg-[#08151d] px-4 py-2.5 text-sm"
                    >
                      <span className="truncate font-medium text-slate-200">
                        {lang === 'ar' ? d.titleAr : d.titleEn}
                      </span>
                      <span className="font-mono-data text-xs text-amber-300 shrink-0">
                        {d.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'resources' && (
            <div className="space-y-6">
              <form onSubmit={handleSaveCiv} className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-xs text-slate-400">
                    {t.dayLabel}
                    <input
                      type="number"
                      min={1}
                      value={civForm.dayNumber}
                      onChange={(e) => setCivForm({ ...civForm, dayNumber: Number(e.target.value) })}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    {t.tierLabel}
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={civForm.level}
                      onChange={(e) => setCivForm({ ...civForm, level: Number(e.target.value) })}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    Era (AR)
                    <input
                      value={civForm.eraAr}
                      onChange={(e) => setCivForm({ ...civForm, eraAr: e.target.value })}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    Era (EN)
                    <input
                      value={civForm.eraEn}
                      onChange={(e) => setCivForm({ ...civForm, eraEn: e.target.value })}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>

                  <label className="text-xs text-slate-400">
                    {t.metricPopulation}
                    <input
                      type="number"
                      readOnly
                      value={citizens.length}
                      title={t.populationSyncedNote}
                      className={`mt-1 opacity-70 cursor-not-allowed ${inputClass}`}
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    {t.metricTreasury}
                    <input
                      type="number"
                      value={civForm.treasury}
                      onChange={(e) =>
                        setCivForm({ ...civForm, treasury: Number(e.target.value) })
                      }
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    {t.metricFood} (%)
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={civForm.food}
                      onChange={(e) => setCivForm({ ...civForm, food: Number(e.target.value) })}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    {t.metricWater} (%)
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={civForm.water}
                      onChange={(e) => setCivForm({ ...civForm, water: Number(e.target.value) })}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    {t.metricEnergy} (%)
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={civForm.energy}
                      onChange={(e) => setCivForm({ ...civForm, energy: Number(e.target.value) })}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    {t.metricHealth} (%)
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={civForm.health}
                      onChange={(e) => setCivForm({ ...civForm, health: Number(e.target.value) })}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    {t.metricEducation} (%)
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={civForm.education}
                      onChange={(e) => setCivForm({ ...civForm, education: Number(e.target.value) })}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    {t.metricHappiness} (%)
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={civForm.happiness}
                      onChange={(e) => setCivForm({ ...civForm, happiness: Number(e.target.value) })}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-[42px] rounded-lg bg-amber-500 px-6 py-2 text-sm font-semibold text-[#071118] hover:bg-amber-400 disabled:opacity-50 cursor-pointer"
                  >
                    {t.saveChanges}
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await onResetTo100Citizens();
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="flex min-h-[42px] items-center gap-2 rounded-lg border border-rose-700/60 bg-rose-950/30 px-4 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-950/60 disabled:opacity-50 cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    <span>{t.resetWorldBtn}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {tab === 'buildings' && (
            <div className="space-y-6">
              <form onSubmit={handleSaveBld} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-amber-300">
                    {editingBldId ? t.updateBuilding : t.addBuilding}
                  </h3>
                  {editingBldId && (
                    <button
                      type="button"
                      onClick={resetBuildingForm}
                      className="text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      {t.cancelEdit}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    required
                    value={bldNameAr}
                    onChange={(e) => setBldNameAr(e.target.value)}
                    placeholder="اسم المشروع / المزرعة / المصنع (عربي)"
                    className={inputClass}
                  />
                  <input
                    value={bldNameEn}
                    onChange={(e) => setBldNameEn(e.target.value)}
                    placeholder="Building / Farm / Factory Name (English)"
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    value={bldDescAr}
                    onChange={(e) => setBldDescAr(e.target.value)}
                    placeholder="الوصف (عربي)"
                    className={inputClass}
                  />
                  <input
                    value={bldDescEn}
                    onChange={(e) => setBldDescEn(e.target.value)}
                    placeholder="Description (English)"
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-6 items-end">
                  <select
                    value={bldCat}
                    onChange={(e) => setBldCat(e.target.value as BuildingCategory)}
                    className={inputClass}
                  >
                    <option value="agriculture">{t.categoryAgriculture}</option>
                    <option value="factory">{t.categoryFactory}</option>
                    <option value="infrastructure">{t.categoryInfrastructure}</option>
                    <option value="energy">{t.categoryEnergy}</option>
                    <option value="civic">{t.categoryCivic}</option>
                    <option value="science">{t.categoryScience}</option>
                    <option value="health">{t.categoryHealth}</option>
                  </select>
                  <select
                    value={bldStatus}
                    onChange={(e) => setBldStatus(e.target.value as BuildingStatus)}
                    className={inputClass}
                  >
                    <option value="planned">{t.statusPlanned}</option>
                    <option value="constructing">{t.statusConstructing}</option>
                    <option value="completed">{t.statusCompleted}</option>
                  </select>
                  <label className="text-xs text-slate-400">
                    %
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={bldProgress}
                      onChange={(e) => setBldProgress(Number(e.target.value))}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    X ({bldX}%)
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={bldX}
                      onChange={(e) => setBldX(Number(e.target.value))}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    Y ({bldY}%)
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={bldY}
                      onChange={(e) => setBldY(Number(e.target.value))}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={onStartMapPick}
                    className="flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-emerald-700/70 bg-emerald-950/60 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-900/60 cursor-pointer"
                  >
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.pickOnMap}</span>
                  </button>
                </div>

                {/* Production & Upkeep Inputs */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <label className="text-xs text-slate-400">
                    +{t.metricFood} / {t.dayLabel}
                    <input
                      type="number"
                      value={bldOutFood}
                      onChange={(e) => setBldOutFood(Number(e.target.value))}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    +{t.metricWater} / {t.dayLabel}
                    <input
                      type="number"
                      value={bldOutWater}
                      onChange={(e) => setBldOutWater(Number(e.target.value))}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    +{t.metricEnergy} / {t.dayLabel}
                    <input
                      type="number"
                      value={bldOutEnergy}
                      onChange={(e) => setBldOutEnergy(Number(e.target.value))}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    +{t.metricTreasury} / {t.dayLabel}
                    <input
                      type="number"
                      value={bldOutTreasury}
                      onChange={(e) => setBldOutTreasury(Number(e.target.value))}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    -{t.metricTreasury} ({t.dailyUpkeepLabel})
                    <input
                      type="number"
                      value={bldUpkeepTreasury}
                      onChange={(e) => setBldUpkeepTreasury(Number(e.target.value))}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="flex min-h-[42px] items-center gap-2 rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-[#071118] hover:bg-amber-400 disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>{editingBldId ? t.updateBuilding : t.addBuilding}</span>
                </button>
              </form>

              {/* Existing Buildings List */}
              <div className="space-y-2 border-t border-emerald-900/40 pt-4">
                {buildings.map((b) => {
                  const outs = formatEffectList(b.dailyOutput || {}, lang);
                  return (
                    <div
                      key={b.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-900/40 bg-[#08151d] px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">
                          {lang === 'ar' ? b.nameAr : b.nameEn}
                        </div>
                        <div className="text-xs text-slate-400 font-mono-data tabular-nums">
                          {b.category} · {b.status} · {b.progress}%
                          {outs.length > 0 ? ` · ${outs.join(', ')}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEditBuilding(b)}
                          aria-label={t.editItem}
                          className="rounded-md border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800 cursor-pointer"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteBuilding(b.id)}
                          aria-label={t.deleteItem}
                          className="rounded-md border border-rose-800/60 p-1.5 text-rose-400 hover:bg-rose-950/60 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'news' && (
            <div className="space-y-6">
              <form onSubmit={handleAddNews} className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <input
                    required
                    value={newsTitleAr}
                    onChange={(e) => setNewsTitleAr(e.target.value)}
                    placeholder="عنوان الخبر (عربي)"
                    className={inputClass}
                  />
                  <input
                    value={newsTitleEn}
                    onChange={(e) => setNewsTitleEn(e.target.value)}
                    placeholder="Dispatch Title (English)"
                    className={inputClass}
                  />
                  <select
                    value={newsCat}
                    onChange={(e) => setNewsCat(e.target.value as NewsCategory)}
                    className={inputClass}
                  >
                    <option value="announcement">{t.newsAnnouncement}</option>
                    <option value="milestone">{t.newsMilestone}</option>
                    <option value="directive">{t.newsDirective}</option>
                    <option value="ecology">{t.newsEcology}</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <textarea
                    required
                    rows={3}
                    value={newsBodyAr}
                    onChange={(e) => setNewsBodyAr(e.target.value)}
                    placeholder="نص الخبر (عربي)"
                    className={inputClass}
                  />
                  <textarea
                    rows={3}
                    value={newsBodyEn}
                    onChange={(e) => setNewsBodyEn(e.target.value)}
                    placeholder="Dispatch body (English)"
                    className={inputClass}
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[42px] rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-[#071118] hover:bg-amber-400 disabled:opacity-50 cursor-pointer"
                >
                  {t.publishNews}
                </button>
              </form>

              <div className="space-y-2 border-t border-emerald-900/40 pt-4">
                {news.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-emerald-900/40 bg-[#08151d] px-4 py-2.5"
                  >
                    <span className="truncate text-sm font-medium text-white">
                      {lang === 'ar' ? n.titleAr : n.titleEn}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteNews(n.id)}
                      aria-label={t.deleteItem}
                      className="rounded-md border border-rose-800/60 p-1.5 text-rose-400 hover:bg-rose-950/60 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'users' && (
            <div className="space-y-2.5">
              {citizens.map((c) => {
                const isSelf = c.uid === adminUid;
                const isFounderAccount = c.role === 'founder';
                return (
                  <div
                    key={c.uid}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-900/40 bg-[#08151d] px-4 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {c.photoURL ? (
                        <img
                          src={c.photoURL}
                          alt={c.displayName}
                          referrerPolicy="no-referrer"
                          className="h-8 w-8 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-900 text-xs font-bold text-amber-200">
                          {c.displayName.charAt(0)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 truncate text-sm font-semibold text-white">
                          <span className="truncate">{c.displayName}</span>
                          {c.citizenshipCode && (
                            <span className="font-mono-data text-[11px] text-amber-300">
                              {c.citizenshipCode}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 font-mono-data tabular-nums">
                          {c.role} · {c.status} · Lv.{c.level ?? 1} · {c.coins ?? 500} {t.coinsLabel} · {c.votesCount} {t.votesCast}
                        </div>
                      </div>
                    </div>

                    {!isFounderAccount && !isSelf && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onToggleCitizenStatus(
                              c.uid,
                              c.status === 'active' ? 'suspended' : 'active'
                            )
                          }
                          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer"
                        >
                          {c.status === 'active' ? t.suspendUser : t.activateUser}
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleCitizenAdmin(c.uid, c.role !== 'admin')}
                          className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/15 cursor-pointer"
                        >
                          {c.role === 'admin' ? t.revokeAdmin : t.grantAdmin}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
