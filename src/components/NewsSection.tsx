import { Newspaper } from 'lucide-react';
import { TRANSLATIONS } from '../i18n/translations';
import { Lang, NewsBulletin, NewsCategory } from '../types/world';

interface NewsSectionProps {
  lang: Lang;
  news: NewsBulletin[];
}

function formatNewsDate(publishedAt: NewsBulletin['publishedAt'], lang: Lang): string {
  let d = new Date();
  if (publishedAt instanceof Date) {
    d = publishedAt;
  } else if (publishedAt && typeof publishedAt.toDate === 'function') {
    d = publishedAt.toDate();
  } else if (
    publishedAt &&
    typeof (publishedAt as { seconds?: number }).seconds === 'number'
  ) {
    d = new Date((publishedAt as { seconds: number }).seconds * 1000);
  }
  return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function NewsSection({ lang, news }: NewsSectionProps) {
  const t = TRANSLATIONS[lang];

  const getCategoryLabel = (cat: NewsCategory) => {
    if (cat === 'milestone') return t.newsMilestone;
    if (cat === 'directive') return t.newsDirective;
    if (cat === 'ecology') return t.newsEcology;
    return t.newsAnnouncement;
  };

  return (
    <section id="news" className="space-y-5">
      <div>
        <div className="flex items-center gap-2.5">
          <Newspaper className="h-5 w-5 text-amber-400" aria-hidden="true" />
          <h2 className="text-xl sm:text-2xl font-bold text-white">{t.newsTitle}</h2>
        </div>
        <p className="mt-1 text-sm text-slate-400">{t.newsSubtitle}</p>
      </div>

      {news.length === 0 ? (
        <div className="rounded-2xl border border-emerald-900/50 bg-[#0b1b24] p-8 text-center text-sm text-slate-400">
          {t.noNews}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {news.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-emerald-900/50 bg-[#0b1b24] p-5 transition-colors hover:border-amber-500/40"
            >
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="font-semibold text-emerald-300">
                  {getCategoryLabel(item.category)}
                </span>
                <span aria-hidden="true">·</span>
                <span>{formatNewsDate(item.publishedAt, lang)}</span>
              </div>
              <h3 className="mt-2 text-lg font-semibold text-white">
                {lang === 'ar' ? item.titleAr : item.titleEn}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                {lang === 'ar' ? item.bodyAr : item.bodyEn}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
