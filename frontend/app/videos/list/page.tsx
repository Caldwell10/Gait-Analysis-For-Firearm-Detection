'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '../../../src/components/ui/Button';
import { api, ApiError, VideoListResponse } from '../../../src/lib/api';
import { useSession } from '../../../src/lib/session';

type StatusKey = 'pending' | 'processing' | 'completed' | 'failed';

const STATUS_BADGES: Record<StatusKey, string> = {
  pending: 'bg-amber-400/90 text-amber-950',
  processing: 'bg-sky-400/90 text-sky-950',
  completed: 'bg-emerald-400/90 text-emerald-950',
  failed: 'bg-rose-400/90 text-rose-100',
};

function statusBadge(status: string): string {
  return STATUS_BADGES[(status as StatusKey) || 'pending'] ?? STATUS_BADGES.pending;
}

export default function VideoManagementPage(): JSX.Element {
  const [videos, setVideos] = useState<VideoListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const router = useRouter();
  const { user } = useSession();

  useEffect(() => {
    if (!user) return;
    fetchVideos(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, statusFilter, showDeleted]);

  const fetchVideos = async (page: number) => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string | number | boolean> = {
        page,
        per_page: 20,
      };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (statusFilter) params.status = statusFilter;
      if (showDeleted) params.include_deleted = true;

      const data = await api.getVideos(params);
      setVideos(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load library');
    } finally {
      setLoading(false);
    }
  };

  const totalPages = useMemo(() => {
    if (!videos) return 1;
    return Math.max(1, Math.ceil(videos.total / videos.per_page));
  }, [videos]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-violet-400" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(14,165,233,0.1),_transparent_60%)]" />

      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-slate-100 heading-font"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to dashboard
            </button>
            <h1 className="mt-6 text-3xl font-semibold text-white heading-font">Video management</h1>
            <p className="mt-2 text-sm text-slate-300 body-font">
              Audit, review, and maintain your captured thermal sessions.
            </p>
          </div>
          <Button onClick={() => router.push('/videos')} variant="primary">
            + Upload session
          </Button>
        </header>

        <div className="glass-card p-6 body-font">
          <form
            className="grid gap-4 md:grid-cols-[2fr_1fr_auto]"
            onSubmit={event => {
              event.preventDefault();
              fetchVideos(1);
            }}
          >
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-300 heading-font">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Search by filename, description, or tags"
                className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/60 focus:ring-offset-2 focus:ring-offset-slate-950"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-300 heading-font">Status</label>
              <select
                value={statusFilter}
                onChange={event => setStatusFilter(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/60 focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                <option value="">All statuses</option>
                <option value="pending">Queued</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div className="flex flex-col justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => fetchVideos(1)}
              >
                Search
              </Button>
              <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  className="rounded border-white/30 bg-white/10 text-violet-400 focus:ring-violet-400"
                  checked={showDeleted}
                  onChange={event => setShowDeleted(event.target.checked)}
                />
                Show deleted
              </label>
            </div>
          </form>
        </div>

        <section className="mt-8 glass-card overflow-hidden body-font">
          <header className="flex flex-col gap-3 border-b border-white/10 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white heading-font">
                {videos ? `${videos.total} recordings` : '—'} in archive
              </p>
              <p className="text-xs text-slate-300 body-font">Results refresh automatically after each upload.</p>
            </div>
            <p className="text-xs text-slate-300">Last sync {new Date().toLocaleTimeString()}</p>
          </header>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-sm text-slate-300">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-violet-400" />
            </div>
          ) : error ? (
            <div className="px-6 py-16 text-center text-sm text-rose-300">{error}</div>
          ) : !videos || videos.videos.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-slate-300">
              {searchTerm || statusFilter || showDeleted
                ? 'No videos match your filters. Adjust your query and try again.'
                : 'No recordings yet. Upload a thermal session to populate the library.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-widest text-slate-300">
                    <th className="px-6 py-4">File</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Size</th>
                    <th className="px-6 py-4">Uploaded</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-sm">
                  {videos.videos.map(video => (
                    <tr key={video.id} className={`${video.is_deleted ? 'opacity-50' : ''} hover:bg-white/5`}>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-white">{video.original_filename}</span>
                          {video.description && (
                            <span className="text-xs text-slate-400">{video.description}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold heading-font ${statusBadge(video.analysis_status)}`}>
                          {video.analysis_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-300">{video.file_size || '—'}</td>
                      <td className="px-6 py-4 text-slate-300">
                        {new Date(video.created_at).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => router.push(`/videos/detail?id=${video.id}`)}
                          >
                            View
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(video.id, false)}
                          >
                            Delete
                          </Button>
                          {video.is_deleted && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDelete(video.id, true)}
                            >
                              Purge
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {videos && videos.total > videos.per_page && (
          <nav className="mt-8 flex items-center justify-between text-sm text-slate-300">
            <span>
              Page {videos.page} of {totalPages}
            </span>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fetchVideos(Math.max(1, (videos.page || 1) - 1))}
                disabled={(videos.page || 1) <= 1}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fetchVideos(Math.min(totalPages, (videos.page || 1) + 1))}
                disabled={(videos.page || 1) >= totalPages}
              >
                Next
              </Button>
            </div>
          </nav>
        )}
      </div>
    </div>
  );

  function handleDelete(videoId: string, hardDelete = false) {
    const confirmation = hardDelete
      ? 'Permanently remove this recording? This cannot be undone.'
      : 'Move this recording to trash?';
    if (!window.confirm(confirmation)) return;

    api
      .deleteVideo(videoId, hardDelete)
      .then(() => fetchVideos(1))
      .catch(err => {
        console.error('Failed to delete video', err);
        alert('Failed to delete video');
      });
  }
}
