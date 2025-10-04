'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Button from '../../../src/components/ui/Button';
import { api, ApiError, VideoMetadata, VideoUpdateRequest, getAuthToken } from '../../../src/lib/api';
import { useSession } from '../../../src/lib/session';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Queued',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-400/90 text-amber-950',
  processing: 'bg-sky-400/90 text-sky-950',
  completed: 'bg-emerald-400/90 text-emerald-950',
  failed: 'bg-rose-400/90 text-rose-100',
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function VideoDetailPage(): JSX.Element {
  const [video, setVideo] = useState<VideoMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<VideoUpdateRequest>({});
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const { user } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const videoId = searchParams.get('id');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!user || !videoId) return;
    loadVideo();
  }, [user, videoId]);

  useEffect(() => {
    if (!video || videoUrl) return;
    streamVideo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video]);

  useEffect(() => () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

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

  async function streamVideo() {
    if (!videoId || !video) return;

    try {
      setVideoLoading(true);
      setVideoError(null);

      const headers: HeadersInit = { Accept: 'video/*' };
      const token = getAuthToken();
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/api/videos/${videoId}/stream`, {
        credentials: 'include',
        headers,
      });
      if (!response.ok) throw new Error(`Stream failed: ${response.status}`);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
    } catch (err) {
      setVideoError('Unable to load playback right now. Try refreshing the stream.');
    } finally {
      setVideoLoading(false);
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

                <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/40">
                  {videoError ? (
                    <div className="flex aspect-video flex-col items-center justify-center gap-4 text-sm text-slate-200">
                      {videoError}
                      <Button variant="secondary" size="sm" onClick={() => streamVideo()}>
                        Retry stream
                      </Button>
                    </div>
                  ) : videoLoading ? (
                    <div className="flex aspect-video items-center justify-center">
                      <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-violet-400" />
                    </div>
                  ) : videoUrl ? (
                    <video
                      ref={videoRef}
                      className="aspect-video w-full"
                      src={videoUrl}
                      controls
                      controlsList="nodownload"
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center text-sm text-slate-300">
                      Video stream unavailable.
                    </div>
                  )}
                </div>

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
                    <p className="mt-2 text-sm text-slate-300">
                      {video.analysis_results.threat_detected
                        ? 'Threat detected in this recording.'
                        : 'No threat patterns detected.'}
                    </p>
                    <div className="mt-5 space-y-3 text-sm text-slate-200">
                      {threatMetrics?.map(metric => (
                        <div key={metric.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <span className="text-slate-300">{metric.label}</span>
                          <span className="font-semibold text-white">{metric.value}</span>
                        </div>
                      ))}
                    </div>
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
