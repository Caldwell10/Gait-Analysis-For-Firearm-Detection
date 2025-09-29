'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import Button from '../../../src/components/ui/Button';
import { api, ApiError, VideoMetadata, VideoUpdateRequest, getAuthToken } from '../../../src/lib/api';
import { useSession } from '../../../src/lib/session';

export default function VideoDetailPage() {
  const [video, setVideo] = useState<VideoMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<VideoUpdateRequest>({});
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const { user } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const videoId = searchParams.get('id');

  const fetchVideo = async () => {
    if (!videoId) {
      setError('No video ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await api.getVideo(videoId);
      setVideo(data);
      setFormData({
        original_filename: data.original_filename,
        description: data.description || '',
        tags: data.tags || '',
        subject_id: data.subject_id || '',
      });
    } catch (err) {
      console.error('Failed to fetch video:', err);
      setError(err instanceof ApiError ? err.message : 'Failed to load video');
    } finally {
      setLoading(false);
    }
  };

  const loadVideoUrl = async () => {
    if (!videoId || !video) return;

    try {
      setVideoLoading(true);
      setVideoError(null);

      // Fetch video with proper authentication
      const headers: HeadersInit = {
        'Accept': 'video/*',
      };

      // Add Authorization header if token exists
      const token = getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/videos/${videoId}/stream`,
        {
          credentials: 'include',
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to load video: ${response.status}`);
      }

      // Create blob URL from the response
      const blob = await response.blob();
      console.log('Blob created:', {
        size: blob.size,
        type: blob.type,
        url: response.url
      });

      const url = URL.createObjectURL(blob);
      console.log('Blob URL created:', url);
      setVideoUrl(url);
      setVideoLoading(false);
    } catch (err) {
      console.error('Failed to load video stream:', err);
      setVideoError('Failed to load video. Please check your connection and try again.');
      setVideoLoading(false);
    }
  };

  useEffect(() => {
    if (user && videoId) {
      fetchVideo();
    }
  }, [user, videoId]);

  useEffect(() => {
    if (video && !videoUrl) {
      loadVideoUrl();
    }
  }, [video, videoUrl]);

  // Cleanup blob URL when component unmounts or video changes
  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  const handleSave = async () => {
    if (!video) return;

    try {
      setSaving(true);
      const updatedVideo = await api.updateVideo(video.id, formData);
      setVideo(updatedVideo);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update video:', err);
      alert(err instanceof ApiError ? err.message : 'Failed to update video');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (hardDelete = false) => {
    if (!video) return;

    const message = hardDelete
      ? 'Are you sure you want to permanently delete this video? This action cannot be undone.'
      : 'Are you sure you want to delete this video?';

    if (!confirm(message)) return;

    try {
      await api.deleteVideo(video.id, hardDelete);
      router.push('/videos/list');
    } catch (err) {
      console.error('Failed to delete video:', err);
      alert(err instanceof ApiError ? err.message : 'Failed to delete video');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'processing': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'failed': 'bg-red-100 text-red-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Button
                variant="secondary"
                onClick={() => router.push('/videos/list')}
                className="mr-4"
              >
                ← Back to Videos
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">
                Video Details
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              {video && !video.is_deleted && (
                <>
                  {isEditing ? (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setIsEditing(false);
                          setFormData({
                            original_filename: video.original_filename,
                            description: video.description || '',
                            tags: video.tags || '',
                            subject_id: video.subject_id || '',
                          });
                        }}
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSave}
                        loading={saving}
                        disabled={saving}
                      >
                        Save Changes
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => setIsEditing(true)}
                    >
                      Edit
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-600 mb-4">{error}</div>
            <Button onClick={fetchVideo}>
              Try Again
            </Button>
          </div>
        ) : !video ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900">Video not found</h3>
            <p className="mt-1 text-sm text-gray-500">
              The video you're looking for doesn't exist or you don't have permission to view it.
            </p>
            <div className="mt-6">
              <Button onClick={() => router.push('/videos/list')}>
                Back to Videos
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Video Player Card */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Video Playback
                </h3>
                <div className="w-full">
                  {videoError ? (
                    <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Video Unavailable</h3>
                        <p className="mt-1 text-sm text-gray-500">{videoError}</p>
                        <button
                          onClick={() => {
                            setVideoError(null);
                            setVideoUrl(null);
                            loadVideoUrl();
                          }}
                          className="mt-3 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Try Again
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      {videoLoading && (
                        <div className="absolute inset-0 bg-gray-900 rounded-lg flex items-center justify-center">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                            <p className="mt-2 text-sm text-white">Loading video...</p>
                          </div>
                        </div>
                      )}
                      <video
                        ref={videoRef}
                        controls
                        className="w-full h-auto max-h-96 bg-gray-900 rounded-lg"
                        preload="metadata"
                        style={{ maxWidth: '100%' }}
                        src={videoUrl || undefined}
                        onLoadStart={() => setVideoLoading(true)}
                        onCanPlay={() => setVideoLoading(false)}
                        onError={(e) => {
                          setVideoLoading(false);
                          const videoElement = e.target as HTMLVideoElement;
                          const error = videoElement.error;
                          let errorMessage = 'Failed to load video. Please check your connection and try again.';

                          if (error) {
                            switch (error.code) {
                              case MediaError.MEDIA_ERR_ABORTED:
                                errorMessage = 'Video playback was aborted.';
                                break;
                              case MediaError.MEDIA_ERR_NETWORK:
                                errorMessage = 'Network error occurred while loading video.';
                                break;
                              case MediaError.MEDIA_ERR_DECODE:
                                errorMessage = 'Video format not supported or corrupted.';
                                break;
                              case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                                errorMessage = 'Video format not supported by browser.';
                                break;
                              default:
                                errorMessage = `Video error: ${error.message || 'Unknown error'}`;
                            }
                          }

                          setVideoError(errorMessage);
                          console.error('Video playback error:', {
                            event: e,
                            error: error,
                            errorCode: error?.code,
                            errorMessage: error?.message,
                            videoSrc: videoElement.src
                          });
                        }}
                        onLoadedMetadata={() => {
                          setVideoLoading(false);
                          console.log('Video metadata loaded successfully');
                        }}
                      >
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  )}
                  <div className="mt-2 flex justify-between items-center">
                    <div className="text-xs text-gray-500">
                      Using streaming endpoint with range support for efficient playback
                    </div>
                    {!videoError && (
                      <div className="text-xs text-gray-500">
                        File: {video.original_filename} ({video.file_size})
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Video Info Card */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h2 className="text-lg font-medium text-gray-900">
                      {isEditing ? (
                        <input
                          type="text"
                          value={formData.original_filename || ''}
                          onChange={(e) => setFormData({ ...formData, original_filename: e.target.value })}
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          placeholder="Filename"
                        />
                      ) : (
                        video.original_filename
                      )}
                      {video.is_deleted && (
                        <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Deleted
                        </span>
                      )}
                    </h2>
                    <p className="text-sm text-gray-500">Video ID: {video.id}</p>
                  </div>
                  <div className="ml-4">
                    <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(video.analysis_status)}`}>
                      {video.analysis_status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">File Size</label>
                    <p className="mt-1 text-sm text-gray-900">{video.file_size}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Duration</label>
                    <p className="mt-1 text-sm text-gray-900">{video.duration || 'Unknown'}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Uploaded</label>
                    <p className="mt-1 text-sm text-gray-900">{formatDate(video.created_at)}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Updated</label>
                    <p className="mt-1 text-sm text-gray-900">{formatDate(video.updated_at)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Metadata Card */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Video Metadata
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    {isEditing ? (
                      <textarea
                        value={formData.description || ''}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="Enter a description for this video..."
                      />
                    ) : (
                      <p className="mt-1 text-sm text-gray-900">
                        {video.description || 'No description provided'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Tags
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.tags || ''}
                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="Enter tags separated by commas..."
                      />
                    ) : (
                      <p className="mt-1 text-sm text-gray-900">
                        {video.tags || 'No tags'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Subject ID
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.subject_id || ''}
                        onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="Enter subject identifier..."
                      />
                    ) : (
                      <p className="mt-1 text-sm text-gray-900">
                        {video.subject_id || 'No subject ID'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Technical Metadata Card */}
            {video.video_metadata && Object.keys(video.video_metadata).length > 0 && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Technical Metadata
                  </h3>
                  <div className="bg-gray-50 rounded-md p-4">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                      {JSON.stringify(video.video_metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Actions Card */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Actions
                </h3>
                <div className="space-y-3">
                  {!video.is_deleted && (
                    <button
                      onClick={async () => {
                        try {
                          const headers: HeadersInit = {};
                          const token = getAuthToken();
                          if (token) {
                            headers['Authorization'] = `Bearer ${token}`;
                          }

                          const response = await fetch(
                            `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/videos/${video.id}/download`,
                            {
                              credentials: 'include',
                              headers,
                            }
                          );

                          if (response.ok) {
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = video.original_filename;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            window.URL.revokeObjectURL(url);
                          } else {
                            alert('Failed to download video');
                          }
                        } catch (error) {
                          alert('Download failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
                        }
                      }}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-4-4m4 4l4-4m6-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-4" />
                      </svg>
                      Download Video
                    </button>
                  )}

                  {!video.is_deleted ? (
                    <Button
                      variant="secondary"
                      onClick={() => handleDelete(false)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete Video
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-500">
                        This video has been soft deleted. You can permanently delete it if needed.
                      </p>
                      <Button
                        variant="secondary"
                        onClick={() => handleDelete(true)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Permanently Delete Video
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}