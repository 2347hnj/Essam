import { User } from 'firebase/auth';
import { CheckCircle2, Clock, ShieldCheck, Vote as VoteIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatEffectList, TRANSLATIONS } from '../i18n/translations';
import { CitizenProfile, Decision, DecisionOption, Lang, Vote } from '../types/world';

interface DailyDecisionPanelProps {
  lang: Lang;
  decision: Decision | null;
  votes: Vote[];
  user: User | null;
  citizen: CitizenProfile | null;
  isAdmin: boolean;
  onCastVote: (decisionId: string, optionId: string) => Promise<void>;
  onApproveDecision: (
    decision: Decision,
    winningOption: DecisionOption,
    totalVotes: number,
    winningPct: number
  ) => Promise<void>;
  onCloseDecision: (decisionId: string) => Promise<void>;
  onSignIn: () => void;
}

function getEndsAtDate(endsAt: Decision['endsAt']): Date {
  if (endsAt instanceof Date) return endsAt;
  if (endsAt && typeof endsAt.toDate === 'function') return endsAt.toDate();
  if (endsAt && typeof (endsAt as { seconds?: number }).seconds === 'number') {
    return new Date((endsAt as { seconds: number }).seconds * 1000);
  }
  return new Date();
}

export function DailyDecisionPanel({
  lang,
  decision,
  votes,
  user,
  citizen,
  isAdmin,
  onCastVote,
  onApproveDecision,
  onCloseDecision,
  onSignIn,
}: DailyDecisionPanelProps) {
  const t = TRANSLATIONS[lang];
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!decision) {
    return (
      <section
        id="daily-vote"
        className="rounded-2xl border border-emerald-900/50 bg-[#0b1b24] p-6 sm:p-8"
      >
        <div className="flex items-center gap-2.5">
          <VoteIcon className="h-5 w-5 text-amber-400" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-white">{t.dailyVoteTitle}</h2>
        </div>
        <p className="mt-3 text-sm text-slate-300">{t.noActiveDecision}</p>
      </section>
    );
  }

  const endsAtDate = getEndsAtDate(decision.endsAt);
  const diffMs = endsAtDate.getTime() - nowMs;
  const isExpired = diffMs <= 0;

  const formatCountdown = (ms: number) => {
    if (ms <= 0) return t.votingEnded;
    const totalSec = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const userVote = user ? votes.find((v) => v.userId === user.uid) : undefined;
  const totalVotes = votes.length;

  const optionStats = decision.options.map((opt) => {
    const count = votes.filter((v) => v.optionId === opt.id).length;
    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    return { opt, count, pct };
  });

  const sortedByVotes = [...optionStats].sort((a, b) => b.count - a.count);
  const leading = sortedByVotes[0];

  const handleVoteSubmit = async () => {
    if (!selectedOptionId || submitting) return;
    setSubmitting(true);
    try {
      await onCastVote(decision.id, selectedOptionId);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!leading || approving) return;
    setApproving(true);
    try {
      await onApproveDecision(decision, leading.opt, totalVotes, leading.pct);
    } finally {
      setApproving(false);
    }
  };

  const isSuspended = citizen?.status === 'suspended';

  return (
    <section
      id="daily-vote"
      className="rounded-2xl border border-emerald-900/50 bg-[#0b1b24] p-5 sm:p-8"
    >
      {/* Header Metadata & Countdown */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-900/40 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="font-medium text-amber-300">{t.dailyVoteTitle}</span>
            <span aria-hidden="true">·</span>
            <span>
              {t.totalVotes}:{' '}
              <strong className="font-mono-data text-slate-200 tabular-nums">
                {totalVotes.toLocaleString('en-US')}
              </strong>
            </span>
          </div>
          <h2 className="mt-2 text-xl sm:text-2xl font-bold text-white text-balance">
            {lang === 'ar' ? decision.titleAr : decision.titleEn}
          </h2>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-900/60 bg-[#071118] px-4 py-2.5">
          <Clock className="h-4 w-4 text-amber-400" aria-hidden="true" />
          <div className="text-xs text-slate-400">{t.endsIn}</div>
          <div className="font-mono-data text-sm font-semibold text-amber-300 tabular-nums">
            {formatCountdown(diffMs)}
          </div>
        </div>
      </div>

      <p className="mt-4 max-w-3xl text-sm sm:text-base leading-relaxed text-slate-300">
        {lang === 'ar' ? decision.descriptionAr : decision.descriptionEn}
      </p>

      {/* Voting Options Grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {optionStats.map(({ opt, count, pct }) => {
          const isUserChoice = userVote?.optionId === opt.id;
          const isSelected = selectedOptionId === opt.id;
          const canSelect = Boolean(user && !userVote && !isExpired && !isSuspended);
          const effectStrings = formatEffectList(opt.effects || {}, lang);

          return (
            <div
              key={opt.id}
              onClick={() => canSelect && setSelectedOptionId(opt.id)}
              role={canSelect ? 'button' : undefined}
              tabIndex={canSelect ? 0 : undefined}
              onKeyDown={(e) => {
                if (canSelect && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  setSelectedOptionId(opt.id);
                }
              }}
              className={`flex flex-col justify-between rounded-xl border p-5 transition-all ${
                isUserChoice
                  ? 'border-amber-400 bg-amber-950/20'
                  : isSelected
                    ? 'border-emerald-400 bg-emerald-950/30'
                    : 'border-emerald-900/50 bg-[#08151d]'
              } ${canSelect ? 'cursor-pointer hover:border-amber-400/60' : ''}`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-white">
                    {lang === 'ar' ? opt.labelAr : opt.labelEn}
                  </h3>
                  {isUserChoice && (
                    <CheckCircle2
                      className="h-5 w-5 shrink-0 text-amber-400"
                      aria-label={t.votedConfirmation}
                    />
                  )}
                </div>

                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-300">
                  {lang === 'ar' ? opt.summaryAr : opt.summaryEn}
                </p>

                {/* Resource Effects as clean unboxed inline text */}
                {effectStrings.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-emerald-300">
                    {effectStrings.map((ef, idx) => (
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

                {opt.spawnBuilding && (
                  <div className="mt-2.5 text-xs text-amber-300/90">
                    <span>{t.spawnBuildingNote}: </span>
                    <span className="font-semibold text-amber-200">
                      {lang === 'ar' ? opt.spawnBuilding.nameAr : opt.spawnBuilding.nameEn}
                    </span>
                  </div>
                )}
              </div>

              {/* Live Result Bar */}
              <div className="mt-5 pt-3 border-t border-emerald-900/40">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono-data text-slate-300 tabular-nums">
                    {count.toLocaleString('en-US')}
                  </span>
                  <span className="font-mono-data font-semibold text-amber-300 tabular-nums">
                    {pct}%
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isUserChoice ? 'bg-amber-400' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Footer */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-emerald-900/40 pt-5">
        <div>
          {!user ? (
            <button
              type="button"
              onClick={onSignIn}
              className="min-h-[44px] rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-[#071118] transition-colors hover:bg-amber-400 cursor-pointer"
            >
              {t.signInToVote}
            </button>
          ) : isSuspended ? (
            <p className="text-sm font-medium text-rose-400">{t.suspendedAccount}</p>
          ) : userVote ? (
            <div className="flex items-center gap-2 text-sm font-medium text-amber-300">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>{t.votedConfirmation}</span>
            </div>
          ) : (
            <button
              type="button"
              disabled={!selectedOptionId || submitting || isExpired}
              onClick={handleVoteSubmit}
              className="min-h-[44px] rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-semibold text-[#071118] transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
            >
              {t.castVote}
            </button>
          )}
        </div>

        {/* Founder Approval Action */}
        {isAdmin && leading && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={approving}
              onClick={handleApprove}
              className="flex min-h-[44px] items-center gap-2 rounded-lg border border-emerald-500/60 bg-emerald-900/40 px-4 py-2 text-xs sm:text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-800/60 disabled:opacity-50 cursor-pointer"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>{t.approveDecision}</span>
            </button>
            <button
              type="button"
              onClick={() => onCloseDecision(decision.id)}
              className="min-h-[44px] rounded-lg border border-slate-700 px-4 py-2 text-xs sm:text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 cursor-pointer"
            >
              {t.rejectDecision}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
