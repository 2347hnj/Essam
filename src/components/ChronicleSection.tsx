import { BookOpen, Calendar, Landmark } from 'lucide-react';
import { useState } from 'react';
import { formatEffectList, TRANSLATIONS } from '../i18n/translations';
import { ChronicleEntry, Lang } from '../types/world';

interface ChronicleSectionProps {
  lang: Lang;
  chronicles: ChronicleEntry[];
}

function formatChronicleDate(executedAt: ChronicleEntry['executedAt'], lang: Lang): string {
  let d = new Date();
  if (executedAt instanceof Date) {
    d = executedAt;
  } else if (executedAt && typeof executedAt.toDate === 'function') {
    d = executedAt.toDate();
  } else if (
    executedAt &&
    typeof (executedAt as { seconds?: number }).seconds === 'number'
  ) {
    d = new Date((executedAt as { seconds: number }).seconds * 1000);
  }
  return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function ChronicleCard({ entry, lang }: { entry: ChronicleEntry; lang: Lang }) {
  const t = TRANSLATIONS[lang];
  const [imgFailed, setImgFailed] = useState(false);
  const effects = formatEffectList(entry.effects || {}, lang);

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-emerald-900/50 bg-[#0b1b24] transition-colors hover:border-amber-500/40">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#07131a]">
        {entry.imageUrl && !imgFailed ? (
          <img
            src={entry.imageUrl}
            alt={lang === 'ar' ? entry.titleAr : entry.titleEn}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#0a222b] via-[#0e3032] to-[#08151d] p-4">
            <Landmark className="h-9 w-9 text-amber-400/70" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b1b24] via-transparent to-transparent" />
      </div>

      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          {/* Unboxed clean metadata with middot separator */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="font-semibold text-amber-300 tabular-nums">
              {t.dayLabel} {entry.dayNumber}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              {formatChronicleDate(entry.executedAt, lang)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-data tabular-nums">
              {entry.totalVotes.toLocaleString('en-US')} ({entry.winningPercentage}%)
            </span>
          </div>

          <h3 className="mt-2 text-lg font-semibold text-white">
            {lang === 'ar' ? entry.titleAr : entry.titleEn}
          </h3>

          <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-300">
            {lang === 'ar' ? entry.outcomeAr : entry.outcomeEn}
          </p>
        </div>

        <div className="mt-4 border-t border-emerald-900/40 pt-3">
          <div className="text-xs text-slate-400">
            <span>{t.winningChoice}: </span>
            <span className="font-medium text-amber-200">
              {lang === 'ar' ? entry.winningOptionAr : entry.winningOptionEn}
            </span>
          </div>

          {effects.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-emerald-300">
              {effects.map((ef, idx) => (
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
        </div>
      </div>
    </article>
  );
}

export function ChronicleSection({ lang, chronicles }: ChronicleSectionProps) {
  const t = TRANSLATIONS[lang];

  return (
    <section id="chronicle" className="space-y-5">
      <div>
        <div className="flex items-center gap-2.5">
          <BookOpen className="h-5 w-5 text-amber-400" aria-hidden="true" />
          <h2 className="text-xl sm:text-2xl font-bold text-white">{t.chronicleTitle}</h2>
        </div>
        <p className="mt-1 text-sm text-slate-400">{t.chronicleSubtitle}</p>
      </div>

      {chronicles.length === 0 ? (
        <div className="rounded-2xl border border-emerald-900/50 bg-[#0b1b24] p-8 text-center text-sm text-slate-400">
          {t.noChronicles}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {chronicles.map((entry) => (
            <ChronicleCard key={entry.id} entry={entry} lang={lang} />
          ))}
        </div>
      )}
    </section>
  );
}
