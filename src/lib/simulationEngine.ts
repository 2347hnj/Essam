import {
  Building,
  Civilization,
  DecisionOption,
  EventSeverity,
  ResourceEffects,
  SimulationBreakdown,
} from '../types/world';

interface RandomEventTemplate {
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  severity: EventSeverity;
  effects: ResourceEffects;
}

const RANDOM_EVENT_POOL: RandomEventTemplate[] = [
  {
    titleEn: 'Bountiful Valley Harvest',
    titleAr: 'حصاد وفير في الوادي الأخضر',
    descriptionEn:
      'Mild coastal breezes and rich river silt produced an unexpected surplus across island farms.',
    descriptionAr:
      'ساهم الطقس المعتدل وتربة النهر الخصبة في تحقيق فائض استثنائي في إنتاج المزارع.',
    severity: 'positive',
    effects: { food: 8, happiness: 4, treasury: 600 },
  },
  {
    titleEn: 'Mountain Spring Surge',
    titleAr: 'تدفق ينابيع جبلية جديدة',
    descriptionEn:
      'Snowmelt from the northern peaks replenished freshwater reservoirs and boosted hydro pressure.',
    descriptionAr:
      'أدى ذوبان الثلوج في القمم الشمالية إلى زيادة مخزون المياه العذبة ورفع كفاءة الطاقة.',
    severity: 'positive',
    effects: { water: 9, energy: 4, health: 2 },
  },
  {
    titleEn: 'Mineral & Timber Discovery',
    titleAr: 'اكتشاف عروق معدنية وغابات مستدامة',
    descriptionEn:
      'Surveyors uncovered rich limestone and timber groves near the eastern ridge, energizing local workshops.',
    descriptionAr:
      'عثر المستكشفون على محاجر حجرية عالية الجودة مما ضاعف إنتاجية المصانع المحلية.',
    severity: 'positive',
    effects: { treasury: 1800, energy: 3 },
  },
  {
    titleEn: 'Dry Monsoon Heatwave',
    titleAr: 'موجة حر وجفاف موسمية',
    descriptionEn:
      'Unseasonal heat increased evaporation across reservoirs and strained agricultural irrigation.',
    descriptionAr:
      'رفعت درجات الحرارة المرتفعة معدل التبخر في الخزانات وزادت الحاجة لترشيد المياه والغذاء.',
    severity: 'warning',
    effects: { water: -7, food: -5, happiness: -3 },
  },
  {
    titleEn: 'Coastal Gale & Rough Seas',
    titleAr: 'عاصفة ساحلية ورياح قوية',
    descriptionEn:
      'Strong maritime winds slowed coastal dock operations and required emergency grid maintenance.',
    descriptionAr:
      'أثرت الرياح البحرية القوية على حركة المرفأ وتطلبت صيانة عاجلة لشبكة الكهرباء.',
    severity: 'warning',
    effects: { energy: -6, treasury: -900, health: -2 },
  },
  {
    titleEn: 'Botanical Remedy Breakthrough',
    titleAr: 'اكتشاف أعشاب طبية نادرة',
    descriptionEn:
      'Island researchers synthesized a soothing tonic from native forest flora, improving public wellness.',
    descriptionAr:
      'نجح باحثو الجزيرة في تطوير علاج طبيعي من نباتات الغابة مما رفع مستوى الصحة العامة.',
    severity: 'positive',
    effects: { health: 7, education: 4, happiness: 3 },
  },
  {
    titleEn: 'Pioneer Civic Assembly',
    titleAr: 'مهرجان الرواد والتعاون المدني',
    descriptionEn:
      'Registered citizens gathered in the central plaza to celebrate shared milestones and coordinate new projects.',
    descriptionAr:
      'اجتمع المواطنون المسجلون في الساحة المركزية للاحتفال بالإنجازات المشتركة وتنسيق المشاريع الجديدة.',
    severity: 'neutral',
    effects: { happiness: 6, education: 4, treasury: 500 },
  },
  {
    titleEn: 'Clear Solar Equinox',
    titleAr: 'صفاء شمسي يعزز الطاقة',
    descriptionEn:
      'Extended cloudless daylight hours maximized clean energy generation across every district.',
    descriptionAr:
      'وفّرت السماء الصافية ساعات سطوع أطول رفعت كفاءة الألواح الشمسية وخفّضت التكاليف.',
    severity: 'positive',
    effects: { energy: 8, treasury: 500, happiness: 2 },
  },
];

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function addEffects(target: ResourceEffects, src?: ResourceEffects, factor = 1) {
  if (!src) return;
  const keys: Array<keyof ResourceEffects> = [
    'food',
    'water',
    'energy',
    'treasury',
    'health',
    'education',
    'happiness',
  ];
  for (const k of keys) {
    const val = src[k];
    if (typeof val === 'number' && val !== 0) {
      target[k] = (target[k] || 0) + Math.round(val * factor);
    }
  }
}

export interface SimulationTickResult {
  nextDayNumber: number;
  nextLevel: number;
  nextPopulation: number;
  nextFood: number;
  nextWater: number;
  nextEnergy: number;
  nextTreasury: number;
  nextHealth: number;
  nextEducation: number;
  nextHappiness: number;
  buildingUpdates: Array<{
    id: string;
    progress: number;
    status: 'planned' | 'constructing' | 'completed';
  }>;
  eventTemplate: RandomEventTemplate;
  breakdown: SimulationBreakdown;
}

export function runDailySimulationTick(params: {
  civ: Civilization;
  buildings: Building[];
  winningOption: DecisionOption;
}): SimulationTickResult {
  const { civ, buildings, winningOption } = params;
  const nextDayNumber = civ.dayNumber + 1;
  const realPopulation = Math.max(0, Math.round(civ.population));

  // 1. Daily citizen consumption of Food & Water (scaled cleanly without inventing virtual people)
  const effectiveHeadcount = Math.max(1, realPopulation);
  const foodConsumed = Math.min(18, Math.max(2, Math.round(2 + effectiveHeadcount * 0.12)));
  const waterConsumed = Math.min(16, Math.max(2, Math.round(2 + effectiveHeadcount * 0.1)));

  // 2. Active Building / Farm / Factory Production & Upkeep + Construction Advancement
  const productionTotals: ResourceEffects = {};
  const upkeepTotals: ResourceEffects = {};
  const buildingUpdates: Array<{
    id: string;
    progress: number;
    status: 'planned' | 'constructing' | 'completed';
  }> = [];

  let completedCount = 0;
  for (const b of buildings) {
    if (b.status === 'completed') {
      completedCount++;
      addEffects(productionTotals, b.dailyOutput, 1);
      addEffects(upkeepTotals, b.dailyUpkeep, 1);
    } else if (b.status === 'constructing') {
      const nextProgress = Math.min(100, b.progress + 20);
      const nextStatus = nextProgress >= 100 ? 'completed' : 'constructing';
      if (nextStatus === 'completed') completedCount++;
      buildingUpdates.push({ id: b.id, progress: nextProgress, status: nextStatus });
      addEffects(productionTotals, b.dailyOutput, 0.35);
      addEffects(upkeepTotals, b.dailyUpkeep, 0.5);
    }
  }

  // 3. Random Daily Event
  const eventIndex = Math.floor(Math.random() * RANDOM_EVENT_POOL.length);
  const eventTemplate = RANDOM_EVENT_POOL[eventIndex];
  const decisionEffects = winningOption.effects || {};
  const eventEffects = eventTemplate.effects || {};

  // 4. Compute Next Resource Levels
  const rawFood =
    civ.food -
    foodConsumed +
    (productionTotals.food || 0) -
    (upkeepTotals.food || 0) +
    (decisionEffects.food || 0) +
    (eventEffects.food || 0);

  const rawWater =
    civ.water -
    waterConsumed +
    (productionTotals.water || 0) -
    (upkeepTotals.water || 0) +
    (decisionEffects.water || 0) +
    (eventEffects.water || 0);

  const rawEnergy =
    civ.energy +
    (productionTotals.energy || 0) -
    (upkeepTotals.energy || 0) +
    (decisionEffects.energy || 0) +
    (eventEffects.energy || 0);

  const rawTreasury =
    civ.treasury +
    (productionTotals.treasury || 0) -
    (upkeepTotals.treasury || 0) +
    (decisionEffects.treasury || 0) +
    (eventEffects.treasury || 0);

  const rawHealth =
    civ.health +
    (productionTotals.health || 0) -
    (upkeepTotals.health || 0) +
    (decisionEffects.health || 0) +
    (eventEffects.health || 0);

  const rawEducation =
    civ.education +
    (productionTotals.education || 0) -
    (upkeepTotals.education || 0) +
    (decisionEffects.education || 0) +
    (eventEffects.education || 0);

  let rawHappiness =
    civ.happiness +
    (productionTotals.happiness || 0) -
    (upkeepTotals.happiness || 0) +
    (decisionEffects.happiness || 0) +
    (eventEffects.happiness || 0);

  const nextFood = clampPct(rawFood);
  const nextWater = clampPct(rawWater);
  const nextEnergy = clampPct(rawEnergy);
  const nextHealth = clampPct(rawHealth);
  const nextEducation = clampPct(rawEducation);

  if (nextFood < 20 || nextWater < 20) {
    rawHappiness -= 4;
  }

  const nextHappiness = clampPct(rawHappiness);
  // Population is strictly derived from actual registered citizen accounts (never virtual simulation numbers)
  const nextPopulation = realPopulation;
  const nextTreasury = Math.round(rawTreasury);

  // 5. Island Evolution Tier driven by civic maturity, completed buildings, and days
  const calculatedLevel =
    completedCount >= 8 || nextDayNumber >= 14
      ? 4
      : completedCount >= 6 || nextDayNumber >= 7
        ? 3
        : completedCount >= 4 || nextDayNumber >= 3
          ? 2
          : 1;
  const nextLevel = Math.max(civ.level, calculatedLevel);

  const breakdown: SimulationBreakdown = {
    dayNumber: nextDayNumber,
    populationDelta: 0,
    foodConsumed,
    waterConsumed,
    productionTotals,
    upkeepTotals,
    decisionEffects,
    eventEffects,
    eventTitleEn: eventTemplate.titleEn,
    eventTitleAr: eventTemplate.titleAr,
  };

  return {
    nextDayNumber,
    nextLevel,
    nextPopulation,
    nextFood,
    nextWater,
    nextEnergy,
    nextTreasury,
    nextHealth,
    nextEducation,
    nextHappiness,
    buildingUpdates,
    eventTemplate,
    breakdown,
  };
}
