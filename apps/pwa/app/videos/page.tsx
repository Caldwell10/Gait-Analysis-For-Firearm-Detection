'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, MAX_FILE_SIZE_MB } from '../../src/lib/api';
import { useSession } from '../../src/lib/session';
import Button from '../../src/components/ui/Button';

export default function UploadVideoPage(): JSX.Element {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const router = useRouter();
  const { user } = useSession();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;

    const allowed = ['video/mp4', 'video/avi', 'video/x-msvideo', 'video/quicktime'];
    if (!allowed.includes(selected.type)) {
      setMessage('Please select a valid video file (.mp4, .avi, .mov).');
      return;
    }
    if (selected.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setMessage(`File size must be less than ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    setFile(selected);
    setMessage(null);
  };

  const resetInput = () => {
    const input = document.getElementById('file-input') as HTMLInputElement | null;
    if (input) input.value = '';
    setFile(null);
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage('Select a file to begin the upload.');
      return;
    }

    setUploading(true);
    setUploadProgress(10);
    setMessage('Preparing upload…');

    try {
      const result = await api.uploadVideo(file);
      setUploadProgress(100);
      setMessage(`Upload complete. Analysis started for video ${result.filename}`);
      resetInput();
      setTimeout(() => router.push('/dashboard'), 1200);
    } catch (error) {
      const detail =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
          ? error.message
          : 'Network error';
      setMessage(`Upload failed: ${detail}`);
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
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
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.12),_transparent_60%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.12),_transparent_55%)]" />

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-12 lg:px-8">
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
            <h1 className="mt-6 text-3xl font-semibold text-white heading-font">Upload thermal session</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300 body-font">
              Drop a thermal recording to queue gait-energy inference. Each upload automatically kicks off
              the repair pipeline and ML scoring.
            </p>
          </div>
          <Button variant="secondary" onClick={() => router.push('/videos/list')}>
            Manage library
          </Button>
        </header>

        <main className="grid flex-1 gap-8 lg:grid-cols-[2fr_1fr]">
          <section className="glass-card p-8">
            <h2 className="text-lg font-semibold text-white heading-font">Upload workspace</h2>
            <p className="mt-1 text-sm text-slate-300 body-font">
              Supported formats: MP4, AVI, MOV · Max size {MAX_FILE_SIZE_MB}MB
            </p>

            <div className="mt-8">
              <label
                htmlFor="file-input"
                className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/5 p-12 text-center transition hover:border-violet-400/60 body-font"
              >
                <input
                  id="file-input"
                  type="file"
                  accept=".mp4,.avi,.mov,video/mp4,video/avi,video/quicktime"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={uploading}
                />
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/20">
                  <svg className="h-8 w-8 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v12m0 0l-4-4m4 4 4-4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                  </svg>
                </div>
                <p className="mt-6 text-lg font-semibold text-white heading-font">Drop footage here</p>
                <p className="text-sm text-slate-300 body-font">or click to browse your files</p>
              </label>

              {file && (
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white heading-font">{file.name}</p>
                      <p className="text-xs text-slate-400 body-font">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB · {file.type || 'unknown format'}
                      </p>
                    </div>
                    <button
                      onClick={resetInput}
                      className="text-xs text-slate-400 transition hover:text-slate-200"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {uploading && (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>Uploading</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 via-sky-400 to-emerald-400 transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {message && (
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                  {message}
                </div>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button onClick={handleUpload} loading={uploading} disabled={uploading}>
                  {uploading ? 'Uploading…' : file ? 'Start analysis' : 'Select file'}
                </Button>
                <Button variant="secondary" onClick={resetInput} disabled={uploading}>
                  Reset
                </Button>
              </div>
            </div>
          </section>

          <aside className="glass-card h-fit p-6">
            <h2 className="text-lg font-semibold text-white heading-font">Checklist</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-200 body-font">
              <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                • Ensure the subject walks across the frame laterally for best GEI extraction.
              </li>
              <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                • Avoid clips shorter than 3 seconds. Ideal duration is 5–20 seconds.
              </li>
              <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                • High humidity or rain? Re-run the capture twice to increase confidence.
              </li>
              <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                • After upload, monitor the dashboard threat spotlight for anomalies.
              </li>
            </ul>
          </aside>
        </main>
      </div>
    </div>
  );
}
