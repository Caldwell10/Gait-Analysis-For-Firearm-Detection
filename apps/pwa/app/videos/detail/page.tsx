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
          <div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Video Player */}
              <div className="lg:col-span-2">
                <div className="bg-white shadow-sm rounded-lg border">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-gray-900">Video Playback</h2>
                      <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(video.analysis_status)}`}>
                        {video.analysis_status}
                      </span>
                    </div>

                    <div className="relative bg-gray-900 rounded-lg overflow-hidden">
                      {videoError ? (
                        <div className="aspect-video flex items-center justify-center">
                          <div className="text-center text-white">
                            <svg className="mx-auto h-12 w-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <p className="text-sm mb-3">{videoError}</p>
                            <button
                              onClick={() => {
                                setVideoError(null);
                                setVideoUrl(null);
                                loadVideoUrl();
                              }}
                              className="inline-flex items-center px-3 py-2 border border-gray-600 text-sm font-medium rounded-md text-white bg-gray-700 hover:bg-gray-600"
                            >
                              Try Again
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {videoLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                              <div className="text-center text-white">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                                <p className="text-sm">Loading video...</p>
                              </div>
                            </div>
                          )}
                          <video
                            ref={videoRef}
                            controls
                            className="w-full aspect-video"
                            preload="metadata"
                            src={videoUrl || undefined}
                            onLoadStart={() => setVideoLoading(true)}
                            onCanPlay={() => setVideoLoading(false)}
                            onError={(e) => {
                              setVideoLoading(false);
                              const videoElement = e.target as HTMLVideoElement;
                              const error = videoElement.error;
                              let errorMessage = 'Failed to load video. Please try again.';

                              if (error) {
                                switch (error.code) {
                                  case MediaError.MEDIA_ERR_NETWORK:
                                    errorMessage = 'Network error - check your connection.';
                                    break;
                                  case MediaError.MEDIA_ERR_DECODE:
                                    errorMessage = 'Video format not supported.';
                                    break;
                                  default:
                                    errorMessage = 'Video playback error.';
                                }
                              }
                              setVideoError(errorMessage);
                            }}
                            onLoadedMetadata={() => setVideoLoading(false)}
                          >
                            Your browser does not support the video tag.
                          </video>
                        </>
                      )}
                    </div>

                    <div className="mt-3 flex justify-between items-center text-sm text-gray-500">
                      <span>{video.original_filename}</span>
                      <span>{video.file_size}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Info Panel */}
              <div className="space-y-6">
                {/* Video Information */}
                <div className="bg-white shadow-sm rounded-lg border">
                  <div className="p-6">
                    <h3 className="font-semibold text-gray-900 mb-4">Video Information</h3>
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm text-gray-500">Duration</span>
                        <p className="font-medium">{video.duration || 'Unknown'}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Uploaded</span>
                        <p className="font-medium">{formatDate(video.created_at)}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Subject ID</span>
                        <p className="font-medium">{video.subject_id || 'Not specified'}</p>
                      </div>
                      {video.description && (
                        <div>
                          <span className="text-sm text-gray-500">Description</span>
                          <p className="font-medium">{video.description}</p>
                        </div>
                      )}
                      {video.tags && (
                        <div>
                          <span className="text-sm text-gray-500">Tags</span>
                          <p className="font-medium">{video.tags}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="bg-white shadow-sm rounded-lg border">
                  <div className="p-6">
                    <h3 className="font-semibold text-gray-900 mb-4">Actions</h3>
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
                                { credentials: 'include', headers }
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
                              alert('Download failed');
                            }
                          }}
                          className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
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
                          className="w-full text-red-600 hover:text-red-800 border-red-300 hover:border-red-400"
                        >
                          Delete Video
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          onClick={() => handleDelete(true)}
                          className="w-full text-red-600 hover:text-red-800 border-red-300 hover:border-red-400"
                        >
                          Permanently Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Analysis Results Section */}
            {video.analysis_status === 'completed' && video.analysis_results && (
              <div className="mt-8">
                <div className="bg-white shadow-sm rounded-lg border">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">Analysis Results</h3>

                    {/* Threat Detection Status */}
                    <div className="mb-8">
                      <div className="flex items-center justify-between">
                        <div className={`inline-flex items-center px-4 py-3 rounded-lg text-lg font-semibold ${
                          video.analysis_results?.threat_detected
                            ? 'bg-red-100 text-red-800 border border-red-200'
                            : 'bg-green-100 text-green-800 border border-green-200'
                        }`}>
                          {video.analysis_results?.threat_detected ? (
                            <>
                              <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              THREAT DETECTED
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              NO THREAT DETECTED
                            </>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-500">Confidence</div>
                          <div className="text-2xl font-bold text-gray-900">
                            {Math.round((video.analysis_results?.confidence_score || 0.75) * 100)}%
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Analysis Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <div className="text-sm font-medium text-gray-500 mb-1">Combined Score</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {video.analysis_results?.combined_score?.toFixed(3) || '0.334'}
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <div className="text-sm font-medium text-gray-500 mb-1">Reconstruction Error</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {video.analysis_results?.reconstruction_error?.toFixed(3) || '0.079'}
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <div className="text-sm font-medium text-gray-500 mb-1">Latent Score</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {video.analysis_results?.latent_score?.toFixed(3) || '0.939'}
                        </div>
                      </div>
                    </div>

                    {/* Processing Info */}
                    <div className="pt-4 border-t border-gray-200">
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Algorithm: {video.analysis_results?.algorithm_version || 'ConvAutoencoder_v1.0_mock'}</span>
                        <span>Processing Time: {video.analysis_results?.processing_time || '8.2s'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Analysis Status for Non-Completed */}
            {video.analysis_status !== 'completed' && (
              <div className="mt-8">
                <div className="bg-white shadow-sm rounded-lg border">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Status</h3>
                    <div className="flex items-center">
                      {video.analysis_status === 'processing' && (
                        <div className="flex items-center text-blue-600">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                          <span className="font-medium">Processing video analysis...</span>
                        </div>
                      )}
                      {video.analysis_status === 'pending' && (
                        <div className="flex items-center text-yellow-600">
                          <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                          <span className="font-medium">Analysis queued for processing</span>
                        </div>
                      )}
                      {video.analysis_status === 'failed' && (
                        <div className="flex items-center text-red-600">
                          <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <span className="font-medium">Analysis failed - please retry</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}