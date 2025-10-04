'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '../../src/components/ui/Button';
import { api, VideoListResponse } from '../../src/lib/api';
import { useSession } from '../../src/lib/session';
import AnalysisProgress from '../../src/components/ui/AnalysisProgress';

type VideoItem = VideoListResponse['videos'][number];

type StatusKey = 'pending' | 'processing' | 'completed' | 'failed';

const STATUS_COLORS: Record<StatusKey, string> = {
  pending: 'bg-amber-400/90 text-amber-950',
  processing: 'bg-sky-400/90 text-sky-950',
  completed: 'bg-emerald-400/90 text-emerald-950',
  failed: 'bg-rose-400/90 text-rose-950',
};

const STATUS_LABELS: Record<StatusKey, string> = {
  pending: 'Queued',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
};

function toPercent(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function parseConfidence(video: VideoItem): number | null {
  const raw =
    video.analysis_results?.confidence_score ??
    video.analysis_results?.threat_confidence ??
    video.analysis_results?.confidence;

  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'number') return raw;

  const parsed = parseFloat(String(raw));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Unknown time';

  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const thresholds: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, 'minute'],
    [24, 'hour'],
    [30, 'day'],
    [12, 'month'],
  ];

  let value = diffMinutes;
  let unit: Intl.RelativeTimeFormatUnit = 'minute';

  if (Math.abs(value) >= 60) {
    value = Math.round(value / 60);
    unit = 'hour';
  }
  if (Math.abs(value) >= 24 && unit === 'hour') {
    value = Math.round(value / 24);
    unit = 'day';
  }
  if (Math.abs(value) >= 30 && unit === 'day') {
    value = Math.round(value / 30);
    unit = 'month';
  }
  if (Math.abs(value) >= 12 && unit === 'month') {
    value = Math.round(value / 12);
    unit = 'year';
  }

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  return rtf.format(value, unit);
}

export default function DashboardPage(): JSX.Element {
  const [loadingLogout, setLoadingLogout] = useState(false);
  const [videosData, setVideosData] = useState<VideoListResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const router = useRouter();
  const { user, clearSession } = useSession();

  const fetchDashboardData = useCallback(async () => {
    try {
      setStatsLoading(true);
      const data = await api.getVideos({ page: 1, per_page: 20 });
      setVideosData(data);
    } catch (error) {
      console.error('Failed to load dashboard data', error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 6000);
    return () => clearInterval(interval);
  }, [user, fetchDashboardData]);

  const stats = useMemo(() => {
    const counts: Record<StatusKey, number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    let threats = 0;
    let confidenceAccumulator = 0;
    let confidenceSamples = 0;

    const videos = videosData?.videos ?? [];

    videos.forEach(video => {
      const status = video.analysis_status as StatusKey;
      if (status in counts) counts[status] += 1;

      if (video.analysis_results?.threat_detected) {
        threats += 1;
      }

      const confidence = parseConfidence(video);
      if (confidence !== null) {
        confidenceAccumulator += confidence;
        confidenceSamples += 1;
      }
    });

    return {
      total: videosData?.total ?? videos.length,
      counts,
      threats,
      averageConfidence:
        confidenceSamples > 0 ? confidenceAccumulator / confidenceSamples : null,
      processingActive: counts.pending + counts.processing,
    };
  }, [videosData]);

  const recentVideos = useMemo(() => {
    return (videosData?.videos ?? [])
      .slice(0, 5)
      .map(video => ({
        ...video,
        created_label: formatRelativeTime(video.created_at),
      }));
  }, [videosData]);

  const highlightedThreat = useMemo(() => {
    const threats = (videosData?.videos ?? []).filter(
      video => video.analysis_results?.threat_detected
    );

    if (threats.length === 0) return null;

    return threats.sort((a, b) => {
      const confidenceA = parseConfidence(a) ?? 0;
      const confidenceB = parseConfidence(b) ?? 0;
      return confidenceB - confidenceA;
    })[0];
  }, [videosData]);

  const statusSegments = useMemo(() => {
    const entries: Array<{ key: StatusKey; value: number; percent: number }> = [];
    const total = Object.values(stats.counts).reduce((acc, value) => acc + value, 0);

    (Object.keys(stats.counts) as StatusKey[]).forEach(key => {
      const value = stats.counts[key];
      entries.push({ key, value, percent: toPercent(value, total) });
    });

    return { entries, total };
  }, [stats.counts]);

  const handleLogout = async () => {
    try {
      setLoadingLogout(true);
      await api.logout();
    } catch (error) {
      console.error('Logout failed, clearing local session anyway', error);
    } finally {
      clearSession();
      router.push('/auth/login');
      setLoadingLogout(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(94,234,212,0.18),_transparent_65%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.15),_transparent_55%)]" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 pb-16 pt-10 lg:px-10">
        <header className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 px-8 py-8 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-slate-400 heading-font">Thermal surveillance control</p>
            <h1 className="mt-2 text-3xl font-semibold text-white heading-font lg:text-4xl">
              Welcome back, {user.email || 'Operator'}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-300 body-font">
              You are monitoring {stats.total} captured sessions. {stats.processingActive}{' '}
              {stats.processingActive === 1 ? 'record is' : 'records are'} actively being analyzed
              right now.
            </p>
          </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
              className="bg-gradient-to-r from-[#8b5cf6] via-[#6366f1] to-[#0ea5e9] text-white shadow-[0_10px_30px_rgba(99,102,241,0.25)]"
              onClick={() => router.push('/videos')}
            >
              Upload thermal video
            </Button>
              <Button
              variant="secondary"
              className="border-[var(--tg-color-border)] bg-white/5 text-slate-200 hover:bg-white/10"
              onClick={() => router.push('/videos/list')}
            >
              Manage library
            </Button>
              <Button
              variant="secondary"
              className="border-[var(--tg-color-border)] bg-transparent text-slate-300 hover:bg-white/10"
              onClick={handleLogout}
              disabled={loadingLogout}
            >
              {loadingLogout ? 'Signing out…' : 'Sign out'}
            </Button>
          </div>
        </header>

        <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 body-font">
          <StatCard
            title="Total Captures"
            value={statsLoading ? undefined : stats.total}
            footer="Across the monitored perimeter"
            background="from-emerald-400/20 via-emerald-500/10 to-emerald-300/10"
            accent="bg-emerald-400/90 text-emerald-950"
          />
          <StatCard
            title="Active Queue"
            value={statsLoading ? undefined : stats.processingActive}
            footer="Awaiting ML inference"
            background="from-sky-400/20 via-sky-500/10 to-sky-300/5"
            accent="bg-sky-400/90 text-sky-950"
          />
          <StatCard
            title="Threat Alerts"
            value={statsLoading ? undefined : stats.threats}
            footer="Flagged by the anomaly detector"
            background="from-rose-400/25 via-rose-500/15 to-rose-300/5"
            accent="bg-rose-400/90 text-rose-950"
          />
          <StatCard
            title="Avg. Confidence"
            value={
              statsLoading
                ? undefined
                : stats.averageConfidence !== null
                ? `${Math.round(stats.averageConfidence * 100)}%`
                : '—'
            }
            footer="Across latest detections"
            background="from-amber-400/20 via-amber-500/10 to-amber-300/5"
            accent="bg-amber-400/90 text-amber-950"
          />
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white heading-font">Processing landscape</h2>
                  <p className="text-sm text-slate-300 body-font">
                    Distribution of recordings by analysis status
                  </p>
                </div>
                <span className="text-sm text-slate-400">Last sync: {new Date().toLocaleTimeString()}</span>
              </div>

              <div className="mt-6 flex flex-col gap-4">
                <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                  {statusSegments.entries.map(segment => (
                    <div
                      key={segment.key}
                      className={`h-full transition-all ${STATUS_COLORS[segment.key]}`}
                      style={{ width: `${segment.percent}%` }}
                    />
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {statusSegments.entries.map(segment => (
                    <div
                      key={segment.key}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 heading-font"
                    >
                      <div>
                        <p className="text-xs uppercase tracking-widest text-slate-400">
                          {STATUS_LABELS[segment.key]}
                        </p>
                        <p className="mt-1 text-lg font-semibold text-white">{segment.value}</p>
                      </div>
                      <span className="text-sm text-slate-400">{segment.percent}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white heading-font">Recent activity</h2>
                  <p className="text-sm text-slate-300 body-font">
                    Latest uploads and their analysis state
                  </p>
                </div>
                <Button
                  variant="secondary"
                  className="border-white/20 bg-transparent text-slate-300 hover:bg-white/10"
                  onClick={() => router.push('/videos/list')}
                >
                  View all
                </Button>
              </div>

              <div className="mt-6 space-y-4">
                {recentVideos.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-6 text-center text-sm text-slate-400">
                    Upload a thermal session to kick off analysis.
                  </div>
                )}

                {recentVideos.map(video => (
                  <div
                    key={video.id}
                    className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <h3 className="text-sm font-semibold text-white heading-font">{video.original_filename}</h3>
                        <p className="text-xs text-slate-300 body-font">
                          {video.file_size} · {video.created_label}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={video.analysis_status as StatusKey} />
                        <button
                          onClick={() => router.push(`/videos/detail?id=${video.id}`)}
                          className="rounded-full border border-white/20 px-4 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10"
                        >
                          Open
                        </button>
                      </div>
                    </div>
                    <AnalysisProgress status={video.analysis_status as StatusKey} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold text-white heading-font">Threat spotlight</h2>
              <p className="text-sm text-slate-300 body-font">
                Highest confidence anomaly in the current batch
              </p>

              {highlightedThreat ? (
                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl bg-gradient-to-r from-rose-500/20 via-rose-400/15 to-transparent p-4 heading-font">
                    <p className="text-xs uppercase tracking-[0.35em] text-rose-200/80">Threat detected</p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {highlightedThreat.original_filename}
                    </p>
                    <p className="text-sm text-rose-100/80 body-font">
                      Detection confidence {Math.round((parseConfidence(highlightedThreat) ?? 0) * 100)}%
                    </p>
                  </div>
                  <div className="space-y-3 text-sm text-slate-200">
                    <p className="body-font">
                      Combined score:{' '}
                      <span className="font-semibold text-white">
                        {highlightedThreat.analysis_results?.combined_score ?? '—'}
                      </span>
                    </p>
                    <p className="body-font">
                      Reconstruction error:{' '}
                      <span className="font-semibold text-white">
                        {highlightedThreat.analysis_results?.reconstruction_error ?? '—'}
                      </span>
                    </p>
                    <p className="body-font">
                      Latent distance:{' '}
                      <span className="font-semibold text-white">
                        {highlightedThreat.analysis_results?.latent_score ?? '—'}
                      </span>
                    </p>
                  </div>
                  <Button
                    className="w-full bg-rose-500 hover:bg-rose-400 text-slate-950"
                    onClick={() => router.push(`/videos/detail?id=${highlightedThreat.id}`)}
                  >
                    Review footage
                  </Button>
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-6 text-sm text-slate-300">
                  No anomalies detected in the current set. Great job keeping the perimeter secure.
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold text-white heading-font">Operational tips</h2>
              <ul className="mt-4 space-y-3 text-sm text-slate-200 body-font">
                <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  • Keep thermal captures between 5–20 seconds for optimal GEI reconstruction.
                </li>
                <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  • Re-run uploads with corrupted metadata using the automated repair to avoid blind spots.
                </li>
                <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  • Schedule manual reviews for high-confidence anomalies flagged twice within 24 hours.
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  footer,
  background,
  accent,
}: {
  title: string;
  value: number | string | undefined;
  footer: string;
  background: string;
  accent: string;
}): JSX.Element {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${background} p-6`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400 heading-font">{title}</p>
          <p className="mt-3 text-3xl font-semibold text-white heading-font">
            {value === undefined ? '…' : value}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${accent}`}>Live</span>
      </div>
      <p className="mt-6 text-xs text-slate-300 body-font">{footer}</p>
      <div className="absolute right-0 top-0 h-24 w-24 translate-x-12 -translate-y-8 rounded-full bg-white/10" />
    </div>
  );
}

function StatusBadge({ status }: { status: StatusKey }): JSX.Element {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold heading-font ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
