import {
  Coins,
  Droplets,
  GraduationCap,
  HeartPulse,
  Radio,
  Smile,
  Users,
  Wheat,
  Zap,
} from 'lucide-react';
import { TRANSLATIONS } from '../i18n/translations';
import { Civilization, Lang } from '../types/world';

interface CivilizationMetricsProps {
  civ: Civilization;
  lang: Lang;
  totalRegistered?: number;
  onlineCount?: number;
}

export function CivilizationMetrics({
  civ,
  lang,
  totalRegistered,
  onlineCount = 0,
}: CivilizationMetricsProps) {
  const t = TRANSLATIONS[lang];
  const registeredPop =
    typeof totalRegistered === 'number' ? totalRegistered : civ.population;

  const stats = [
    {
      key: 'population',
      label: t.metricPopulation,
      value: registeredPop.toLocaleString('en-US'),
      pct: null as number | null,
      icon: Users,
      barColor: 'bg-sky-400',
      iconColor: 'text-sky-400',
    },
    {
      key: 'online',
      label: t.metricOnlineCitizens,
      value: onlineCount.toLocaleString('en-US'),
      pct: registeredPop > 0 ? Math.min(100, Math.round((onlineCount / registeredPop) * 100)) : 0,
      icon: Radio,
      barColor: 'bg-emerald-400',
      iconColor: 'text-emerald-400',
    },
    {
      key: 'treasury',
      label: t.metricTreasury,
      value: `$${civ.treasury.toLocaleString('en-US')}`,
      pct: null as number | null,
      icon: Coins,
      barColor: 'bg-amber-400',
      iconColor: 'text-amber-400',
    },
    {
      key: 'food',
      label: t.metricFood,
      value: `${civ.food}%`,
      pct: civ.food,
      icon: Wheat,
      barColor: 'bg-emerald-400',
      iconColor: 'text-emerald-400',
    },
    {
      key: 'water',
      label: t.metricWater,
      value: `${civ.water}%`,
      pct: civ.water,
      icon: Droplets,
      barColor: 'bg-cyan-400',
      iconColor: 'text-cyan-400',
    },
    {
      key: 'energy',
      label: t.metricEnergy,
      value: `${civ.energy}%`,
      pct: civ.energy,
      icon: Zap,
      barColor: 'bg-amber-300',
      iconColor: 'text-amber-300',
    },
    {
      key: 'health',
      label: t.metricHealth,
      value: `${civ.health}%`,
      pct: civ.health,
      icon: HeartPulse,
      barColor: 'bg-emerald-300',
      iconColor: 'text-emerald-300',
    },
    {
      key: 'education',
      label: t.metricEducation,
      value: `${civ.education}%`,
      pct: civ.education,
      icon: GraduationCap,
      barColor: 'bg-sky-300',
      iconColor: 'text-sky-300',
    },
    {
      key: 'happiness',
      label: t.metricHappiness,
      value: `${civ.happiness}%`,
      pct: civ.happiness,
      icon: Smile,
      barColor: 'bg-amber-400',
      iconColor: 'text-amber-400',
    },
  ];

  return (
    <section aria-label={t.metricsTitle} className="w-full">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-9">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.key}
              className="flex flex-col justify-between rounded-xl border border-emerald-900/50 bg-[#0d1f2a]/90 p-3.5 transition-colors hover:border-amber-500/40"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-300 truncate">{stat.label}</span>
                <Icon className={`h-4 w-4 shrink-0 ${stat.iconColor}`} aria-hidden="true" />
              </div>
              <div className="mt-2 font-mono-data text-lg font-semibold tracking-tight text-white tabular-nums">
                {stat.value}
              </div>
              {stat.pct !== null ? (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800/90">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${stat.barColor}`}
                    style={{ width: `${Math.max(0, Math.min(100, stat.pct))}%` }}
                  />
                </div>
              ) : (
                <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800/40" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
