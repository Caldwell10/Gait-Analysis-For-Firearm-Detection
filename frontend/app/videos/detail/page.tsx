'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Button from '../../../src/components/ui/Button';
import AnalysisProgress from '../../../src/components/ui/AnalysisProgress';
import { api, ApiError, VideoMetadata, VideoUpdateRequest, getAuthToken } from '../../../src/lib/api';
import { useSession } from '../../../src/lib/session';

type StatusKey = 'pending' | 'processing' | 'completed' | 'failed';

const STATUS_LABEL: Record<StatusKey, string> = {
  pending: 'Queued',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
};

const STATUS_BADGE: Record<StatusKey, string> = {
  pending: 'bg-amber-400/90 text-amber-950',
  processing: 'bg-sky-400/90 text-sky-950',
  completed: 'bg-emerald-400/90 text-emerald-950',
  failed: 'bg-rose-400/90 text-rose-100',
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type MetricBarConfig = {
  label: string;
  value: number;
  max: number;
  threshold: number;
};

const MetricBar = ({ label, value, max, threshold }: MetricBarConfig) => {
  const safeValue = Number.isFinite(value) ? value : 0;
  const safeMax = max > 0 ? max : 1;
  const percent = Math.min(100, (safeValue / safeMax) * 100);
  const thresholdPercent = Math.min(100, (threshold / safeMax) * 100);
  const isAbove = Number.isFinite(value) && safeValue >= threshold;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-300 heading-font">
        <span>{label}</span>
        <span className={isAbove ? 'text-rose-300' : 'text-slate-200'}>
          {Number.isFinite(value) ? value.toFixed(3) : '—'}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-white/10">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all ${
            isAbove
              ? 'bg-rose-500/80 shadow-[0_0_12px_rgba(244,63,94,0.35)]'
              : 'bg-gradient-to-r from-[#8b5cf6] via-[#6366f1] to-[#0ea5e9] shadow-[0_0_12px_rgba(99,102,241,0.25)]'
          }`}
          style={{ width: `${percent}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/40"
          style={{ left: `${thresholdPercent}%` }}
        />
      </div>
    </div>
  );
};

function getConfidenceScore(video: VideoMetadata | null): number | null {
  if (!video?.analysis_results) return null;

  const raw =
    video.analysis_results.confidence_score ??
    video.analysis_results.threat_confidence ??
    (video.analysis_results as Record<string, unknown>)['confidence'];

  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'number') return raw;

  const numeric = parseFloat(String(raw));
  return Number.isFinite(numeric) ? numeric : null;
}

export default function VideoDetailPage(): JSX.Element {
  const [video, setVideo] = useState<VideoMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<VideoUpdateRequest>({});

  const { user } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const videoId = searchParams.get('id');

  useEffect(() => {
    if (!user || !videoId) return;
    loadVideo();
  }, [user, videoId]);

  const streamSrc = useMemo(() => {
    if (!videoId) return null;
    const cacheBust = video?.updated_at ? new Date(video.updated_at).getTime() : Date.now();
    const params = new URLSearchParams({ b: String(cacheBust) });
    const token = getAuthToken();
    if (token) {
      params.set('token', token);
    }
    return `${API_BASE_URL}/api/videos/${videoId}/stream?${params.toString()}`;
  }, [videoId, video?.updated_at]);

  const threatMetrics = useMemo(() => {
    if (!video?.analysis_results) return null;
    return [
      {
        label: 'Combined score',
        value: video.analysis_results.combined_score ?? '—',
      },
      {
        label: 'Reconstruction error',
        value: video.analysis_results.reconstruction_error ?? '—',
      },
      {
        label: 'Latent distance',
        value: video.analysis_results.latent_score ?? '—',
      },
      {
        label: 'Confidence',
        value: video.analysis_results.confidence_score
          ? `${Math.round(Number(video.analysis_results.confidence_score) * 100)}%`
          : video.analysis_results.threat_confidence
          ? `${Math.round(Number(video.analysis_results.threat_confidence) * 100)}%`
          : '—',
      },
    ];
  }, [video]);

  const metricBars = useMemo(() => {
    if (!video?.analysis_results) return [];
    const combined = Number(video.analysis_results.combined_score ?? NaN);
    const reconstruction = Number(video.analysis_results.reconstruction_error ?? NaN);
    const latent = Number(video.analysis_results.latent_score ?? NaN);
    const threshold = Number(video.analysis_results.threshold ?? 0.179);
    const values = [combined, reconstruction, latent].filter(v => Number.isFinite(v)) as number[];
    const maxValue = Math.max(threshold, ...(values.length ? values : [threshold]));

    return [
      { label: 'Combined score', value: combined, threshold, max: maxValue },
      { label: 'Reconstruction error', value: reconstruction, threshold, max: maxValue },
      { label: 'Latent distance', value: latent, threshold, max: maxValue },
    ];
  }, [video]);

  async function loadVideo() {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getVideo(videoId!);
      setVideo(data);
      setFormData({
        original_filename: data.original_filename,
        subject_id: data.subject_id || '',
        description: data.description || '',
        tags: data.tags || '',
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load video');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!video) return;
    try {
      setSaving(true);
      const updated = await api.updateVideo(video.id, formData);
      setVideo(updated);
      setIsEditing(false);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(hardDelete = false) {
    if (!video) return;
    const confirmation = hardDelete
      ? 'Permanently delete this recording? This cannot be undone.'
      : 'Move this recording to trash?';
    if (!window.confirm(confirmation)) return;

    try {
      await api.deleteVideo(video.id, hardDelete);
      router.push('/videos/list');
    } catch (err) {
      alert('Failed to delete video');
    }
  }

  function handleChange<K extends keyof VideoUpdateRequest>(key: K, value: VideoUpdateRequest[K]) {
    setFormData(prev => ({ ...prev, [key]: value }));
  }

  const handleDownloadMetrics = () => {
    if (!video?.analysis_results) return;

    const payload = {
      video_id: video.id,
      filename: video.original_filename,
      analysis: video.analysis_results,
      generated_at: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${video.original_filename.replace(/\.[^/.]+$/, '')}-analysis.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-violet-400" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.12),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.1),_transparent_60%)]" />

      <div className="mx-auto max-w-6xl px-6 py-12 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-slate-100 heading-font"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h1 className="mt-6 text-3xl font-semibold text-white heading-font">Session overview</h1>
            <p className="mt-2 text-sm text-slate-300 body-font">
              Inspect the thermal recording, review ML metrics, and adjust metadata as needed.
            </p>
          </div>
          {video && !video.is_deleted && (
            <div className="flex gap-3">
              {isEditing ? (
                <>
                  <Button variant="secondary" onClick={() => setIsEditing(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} loading={saving} disabled={saving}>
                    Save changes
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(true)}>Edit metadata</Button>
              )}
            </div>
          )}
        </header>

        <main className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <section className="glass-card p-6 body-font">
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-violet-400" />
              </div>
            ) : error ? (
              <div className="text-sm text-rose-300">{error}</div>
            ) : !video ? (
              <div className="text-sm text-slate-300">Video not found or access restricted.</div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white heading-font">Playback</h2>
                    <p className="text-xs uppercase tracking-widest text-slate-400 heading-font">
                      {video.original_filename}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[video.analysis_status] || STATUS_BADGE.pending}`}>
                    {STATUS_LABEL[video.analysis_status] ?? video.analysis_status}
                  </span>
                </div>

                <AnalysisProgress status={video.analysis_status as StatusKey} size="sm" />

                <VideoPlayer streamSrc={streamSrc} />

                <div className="glass-subtle p-5">
                  <h3 className="text-sm font-semibold text-white heading-font">Recording details</h3>
                  <dl className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs uppercase tracking-widest text-slate-400 heading-font">Uploaded</dt>
                      <dd>{new Date(video.created_at).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-widest text-slate-400 heading-font">File size</dt>
                      <dd>{video.file_size ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-widest text-slate-400 heading-font">Subject ID</dt>
                      <dd>{video.subject_id || 'Not specified'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-widest text-slate-400 heading-font">Tags</dt>
                      <dd>{video.tags || '—'}</dd>
                    </div>
                  </dl>
                </div>

                {isEditing && (
                  <div className="glass-subtle p-5">
                    <h3 className="text-sm font-semibold text-white heading-font">Edit metadata</h3>
                    <div className="mt-4 space-y-4 text-sm">
                      <label className="block">
                        <span className="text-xs uppercase tracking-widest text-slate-400 heading-font">Filename</span>
                        <input
                          className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/60 focus:ring-offset-2 focus:ring-offset-slate-950"
                          value={formData.original_filename ?? ''}
                          onChange={event => handleChange('original_filename', event.target.value)}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs uppercase tracking-widest text-slate-400 heading-font">Subject ID</span>
                        <input
                          className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/60 focus:ring-offset-2 focus:ring-offset-slate-950"
                          value={formData.subject_id ?? ''}
                          onChange={event => handleChange('subject_id', event.target.value)}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs uppercase tracking-widest text-slate-400 heading-font">Description</span>
                        <textarea
                          className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/60 focus:ring-offset-2 focus:ring-offset-slate-950"
                          value={formData.description ?? ''}
                          rows={3}
                          onChange={event => handleChange('description', event.target.value)}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs uppercase tracking-widest text-slate-400 heading-font">Tags</span>
                        <input
                          className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/60 focus:ring-offset-2 focus:ring-offset-slate-950"
                          value={formData.tags ?? ''}
                          onChange={event => handleChange('tags', event.target.value)}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            {video && (
              <div className="glass-card p-6 body-font">
                <h2 className="text-lg font-semibold text-white heading-font">Analysis summary</h2>
                {video.analysis_results ? (
                  <>
                    <div
                      className={`mt-4 rounded-2xl border px-4 py-4 heading-font text-sm ${
                        video.analysis_results.threat_detected
                          ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                          : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                      }`}
                    >
                      {video.analysis_results.threat_detected ? (
                        <>
                          <p className="text-xs uppercase tracking-[0.35em]">Immediate attention</p>
                          <p className="mt-2 text-base">Potential threat pattern detected. Notify response team and review footage now.</p>
                          <p className="mt-1 text-xs text-white/70">Confidence {Math.round((getConfidenceScore(video) ?? 0) * 100)}%</p>
                        </>
                      ) : (
                        <>
                          <p className="text-xs uppercase tracking-[0.35em]">All clear</p>
                          <p className="mt-2 text-base">No suspicious gait signatures found. Archive or continue monitoring.</p>
                        </>
                      )}
                    </div>

                    <div className="mt-5 space-y-3 text-xs text-slate-400">
                      <p className="heading-font uppercase tracking-[0.35em]">What to do next</p>
                      <ul className="space-y-2 body-font text-sm text-slate-300">
                        {video.analysis_results.threat_detected ? (
                          <>
                            <li>• Dispatch a guard to the capture zone and cross-check live feeds.</li>
                            <li>• Download the footage and metrics report for supervisor review.</li>
                            <li>• Log any ground observations in the incident tracker.</li>
                          </>
                        ) : (
                          <>
                            <li>• Mark this session as cleared or add notes for later reference.</li>
                            <li>• Keep monitoring for new uploads with elevated confidence levels.</li>
                          </>
                        )}
                      </ul>
                    </div>

                    <details className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <summary className="cursor-pointer text-sm font-semibold text-white heading-font">Technical metrics (optional)</summary>
                      <div className="mt-3 space-y-3 text-sm text-slate-200">
                        {threatMetrics?.map(metric => (
                          <div key={metric.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <span className="text-slate-300">{metric.label}</span>
                            <span className="font-semibold text-white">{metric.value}</span>
                          </div>
                        ))}
                        <div className="space-y-3">
                          {metricBars.map(bar => (
                            <MetricBar key={bar.label} {...bar} />
                          ))}
                        </div>
                        <p className="text-[0.65rem] text-slate-500 heading-font uppercase tracking-[0.35em]">
                          Threshold marker reflects detector boundary ({Number(video.analysis_results.threshold ?? 0.179).toFixed(3)})
                        </p>
                      </div>
                      <Button variant="secondary" className="mt-3" onClick={handleDownloadMetrics}>
                        Download metrics (JSON)
                      </Button>
                    </details>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-slate-300">Analysis results will appear once processing completes.</p>
                )}
              </div>
            )}

            <div className="glass-card p-6 body-font">
              <h2 className="text-lg font-semibold text-white heading-font">Actions</h2>
              <div className="mt-4 flex flex-col gap-3">
                <Button
                  variant="secondary"
                  onClick={() => video && window.open(`${API_BASE_URL}/api/videos/${video.id}/download`, '_blank')}
                  disabled={!video}
                >
                  Download original
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleDelete(false)}
                  disabled={!video}
                >
                  Delete recording
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleDelete(true)}
                  disabled={!video}
                >
                  Permanently delete
                </Button>
              </div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

function VideoPlayer({ streamSrc }: { streamSrc: string | null }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let abortController = new AbortController();
    let url: string | null = null;

    async function load() {
      if (!streamSrc) {
        setStatus('idle');
        setErrorMessage(null);
        setObjectUrl(null);
        return;
      }

      try {
        setStatus('loading');
        setErrorMessage(null);

        const response = await fetch(streamSrc, {
          method: 'GET',
          signal: abortController.signal,
          mode: 'cors',
          credentials: 'omit',
          headers: {
            Accept: 'video/mp4',
          },
        });

        if (!response.ok) {
          throw new Error(`Stream request failed (${response.status})`);
        }

        const blob = await response.blob();
        url = URL.createObjectURL(blob);
        setObjectUrl(url);
        setStatus('ready');
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        console.error('Video fetch error:', error);
        setStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : 'Could not load the video stream.'
        );
        setObjectUrl(null);
      }
    }

    load();

    return () => {
      abortController.abort();
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [streamSrc]);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black">
      {objectUrl ? (
        <video
          key={objectUrl}
          className="aspect-video w-full bg-black object-contain"
          src={objectUrl}
          controls
          playsInline
          preload="metadata"
        />
      ) : (
        <div className="flex aspect-video items-center justify-center text-sm text-slate-300">
          {status === 'loading' ? 'Loading video…' : 'Video stream unavailable.'}
        </div>
      )}

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="flex flex-col items-center gap-3 text-sm text-slate-200">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-violet-400" />
            <span>Loading video…</span>
          </div>
        </div>
      )}

      {(status === 'error' || status === 'idle') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 p-6 text-center text-sm text-rose-200">
          <p>{errorMessage ?? 'Video stream unavailable.'}</p>
          {streamSrc && (
            <Button variant="secondary" onClick={() => window.open(streamSrc, '_blank')}>
              Open raw stream
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
