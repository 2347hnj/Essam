import { Activity, AlertTriangle, CheckCircle2, Info, Sparkles } from 'lucide-react';
import { formatEffectList, TRANSLATIONS } from '../i18n/translations';
import { EventSeverity, IslandEvent, Lang } from '../types/world';

interface SimulationEventsSectionProps {
  lang: Lang;
  events: IslandEvent[];
}

export function SimulationEventsSection({ lang, events }: SimulationEventsSectionProps) {
  const t = TRANSLATIONS[lang];
  const latestEvent = events[0] || null;

  const getSeverityBadge = (severity: EventSeverity) => {
    if (severity === 'positive') {
      return {
        label: t.severityPositive,
        color: 'text-emerald-300',
        Icon: CheckCircle2,
      };
    }
    if (severity === 'warning') {
      return {
        label: t.severityWarning,
        color: 'text-amber-300',
        Icon: AlertTriangle,
      };
    }
    return {
      label: t.severityNeutral,
      color: 'text-sky-300',
      Icon: Info,
    };
  };

  return (
    <section id="simulation-events" className="space-y-5">
      <div>
        <div className="flex items-center gap-2.5">
          <Activity className="h-5 w-5 text-amber-400" aria-hidden="true" />
          <h2 className="text-xl sm:text-2xl font-bold text-white">{t.simulationTitle}</h2>
        </div>
        <p className="mt-1 text-sm text-slate-400">{t.simulationSubtitle}</p>
      </div>

      {!latestEvent ? (
        <div className="rounded-2xl border border-emerald-900/50 bg-[#0b1b24] p-8 text-center text-sm text-slate-400">
          {t.noEvents}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Latest Day Simulation Breakdown */}
          <div className="lg:col-span-7 rounded-2xl border border-emerald-900/50 bg-[#0b1b24] p-5 sm:p-6">
            {(() => {
              const sev = getSeverityBadge(latestEvent.severity);
              const SevIcon = sev.Icon;
              const eventEffects = formatEffectList(latestEvent.effects || {}, lang);
              const prodEffects = formatEffectList(
                latestEvent.breakdown?.productionTotals || {},
                lang
              );
              const b = latestEvent.breakdown;
              return (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-900/40 pb-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="font-semibold text-amber-300 tabular-nums">
                          {t.dayLabel} {latestEvent.dayNumber}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{t.dailyEventLabel}</span>
                      </div>
                      <h3 className="mt-1.5 text-lg sm:text-xl font-bold text-white">
                        {lang === 'ar' ? latestEvent.titleAr : latestEvent.titleEn}
                      </h3>
                    </div>
                    <div className={`flex items-center gap-1.5 text-xs font-semibold ${sev.color}`}>
                      <SevIcon className="h-4 w-4" aria-hidden="true" />
                      <span>{sev.label}</span>
                    </div>
                  </div>

                  <p className="text-sm leading-relaxed text-slate-300">
                    {lang === 'ar' ? latestEvent.descriptionAr : latestEvent.descriptionEn}
                  </p>

                  {eventEffects.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-emerald-300">
                      {eventEffects.map((ef, idx) => (
                        <span key={ef} className="inline-flex items-center gap-2">
                          {idx > 0 && (
                            <span aria-hidden="true" className="text-slate-600">
                              ·
                            </span>
                          )}
                          <span className="tabular-nums">{ef}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Daily Consumption / Production / Population Growth Telemetry */}
                  {b && (
                    <div className="grid grid-cols-1 gap-3 border-t border-emerald-900/40 pt-4 sm:grid-cols-3">
                      <div className="rounded-xl border border-emerald-900/40 bg-[#08151d] p-3.5">
                        <div className="text-xs text-slate-400">{t.consumedFoodWater}</div>
                        <div className="mt-1.5 font-mono-data text-sm font-semibold text-rose-300 tabular-nums">
                          -{b.foodConsumed}% {t.metricFood} · -{b.waterConsumed}% {t.metricWater}
                        </div>
                      </div>

                      <div className="rounded-xl border border-emerald-900/40 bg-[#08151d] p-3.5">
                        <div className="text-xs text-slate-400">{t.buildingOutputTotal}</div>
                        <div className="mt-1.5 text-xs font-semibold text-emerald-300 tabular-nums">
                          {prodEffects.length > 0 ? prodEffects.join(' · ') : '0'}
                        </div>
                      </div>

                      <div className="rounded-xl border border-emerald-900/40 bg-[#08151d] p-3.5">
                        <div className="text-xs text-slate-400">{t.populationChange}</div>
                        <div className="mt-1.5 font-mono-data text-sm font-semibold text-sky-300 tabular-nums">
                          {b.populationDelta >= 0 ? `+${b.populationDelta}` : b.populationDelta}{' '}
                          {t.metricPopulation}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Historical Random Events Feed */}
          <div className="lg:col-span-5 rounded-2xl border border-emerald-900/50 bg-[#0b1b24] p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Sparkles className="h-4 w-4 text-amber-400" aria-hidden="true" />
              <span>{t.dailyEventLabel}</span>
            </div>
            <div className="max-h-[290px] space-y-2.5 overflow-y-auto pe-1">
              {events.map((ev) => {
                const sev = getSeverityBadge(ev.severity);
                const SevIcon = sev.Icon;
                return (
                  <div
                    key={ev.id}
                    className="rounded-xl border border-emerald-900/40 bg-[#08151d] p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono-data font-semibold text-amber-300 tabular-nums">
                        {t.dayLabel} {ev.dayNumber}
                      </span>
                      <span className={`inline-flex items-center gap-1 font-medium ${sev.color}`}>
                        <SevIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        {sev.label}
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {lang === 'ar' ? ev.titleAr : ev.titleEn}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">
                      {lang === 'ar' ? ev.descriptionAr : ev.descriptionEn}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
