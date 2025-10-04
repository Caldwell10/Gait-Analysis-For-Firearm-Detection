'use client';

type StatusKey = 'pending' | 'processing' | 'completed' | 'failed';

type AnalysisProgressProps = {
  status: StatusKey;
  size?: 'sm' | 'md';
  className?: string;
};

const percentByStatus: Record<StatusKey, number> = {
  pending: 25,
  processing: 65,
  completed: 100,
  failed: 100,
};

const labelByStatus: Record<StatusKey, string> = {
  pending: 'Queued for analysis',
  processing: 'Running gait model',
  completed: 'Analysis complete',
  failed: 'Processing failed',
};

export default function AnalysisProgress({ status, size = 'md', className = '' }: AnalysisProgressProps) {
  const percent = percentByStatus[status] ?? 0;
  const label = labelByStatus[status] ?? '';
  const isFailed = status === 'failed';
  const wrapperClasses = `${size === 'sm' ? 'text-xs' : 'text-sm'} space-y-2 ${className}`.trim();

  return (
    <div className={wrapperClasses}>
      <div className="flex items-center justify-between">
        <span className="heading-font text-[0.65rem] uppercase tracking-[0.35em] text-slate-400">
          {label}
        </span>
        <span className="heading-font text-[0.65rem] uppercase tracking-[0.35em] text-slate-400">
          {isFailed ? 'Error' : `${percent}%`}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full transition-all duration-500 ease-out ${
            isFailed
              ? 'bg-rose-500/90 shadow-[0_0_12px_rgba(244,63,94,0.45)]'
              : 'bg-gradient-to-r from-[#8b5cf6] via-[#6366f1] to-[#0ea5e9] shadow-[0_0_14px_rgba(99,102,241,0.35)]'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {isFailed && (
        <p className="body-font text-[0.7rem] text-rose-300">
          Review the upload or retry to continue analysis.
        </p>
      )}
    </div>
  );
}
