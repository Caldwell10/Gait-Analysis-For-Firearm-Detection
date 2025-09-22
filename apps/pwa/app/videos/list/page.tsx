'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '../../../src/components/ui/Button';
import { api, ApiError, VideoListResponse, VideoMetadata } from '../../../src/lib/api';
import { useSession } from '../../../src/lib/session';

export default function VideoListPage() {
  const [videos, setVideos] = useState<VideoListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleted, setShowDeleted] = useState(false);
  const { user } = useSession();
  const router = useRouter();

  const fetchVideos = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        page,
        per_page: 20,
      };

      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }

      if (statusFilter) {
        params.status = statusFilter;
      }

      if (showDeleted) {
        params.include_deleted = true;
      }

      const data = await api.getVideos(params);
      setVideos(data);
      setCurrentPage(page);
    } catch (err) {
      console.error('Failed to fetch videos:', err);
      setError(err instanceof ApiError ? err.message : 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchVideos();
    }
  }, [user, searchTerm, statusFilter, showDeleted]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchVideos(1);
  };

  const handlePageChange = (page: number) => {
    fetchVideos(page);
  };

  const handleDeleteVideo = async (videoId: string, hardDelete = false) => {
    if (!confirm(hardDelete ? 'Are you sure you want to permanently delete this video?' : 'Are you sure you want to delete this video?')) {
      return;
    }

    try {
      await api.deleteVideo(videoId, hardDelete);
      fetchVideos(currentPage);
    } catch (err) {
      console.error('Failed to delete video:', err);
      alert('Failed to delete video');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
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
                onClick={() => router.push('/dashboard')}
                className="mr-4"
              >
                ← Back
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">
                Video Management
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => router.push('/videos')}
                size="sm"
              >
                Upload Video
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-4 py-5 sm:p-6">
            <form onSubmit={handleSearch} className="space-y-4 sm:space-y-0 sm:flex sm:items-end sm:space-x-4">
              <div className="flex-1">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700">
                  Search videos
                </label>
                <input
                  type="text"
                  id="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by filename, description, or tags..."
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  id="status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  id="show-deleted"
                  type="checkbox"
                  checked={showDeleted}
                  onChange={(e) => setShowDeleted(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="show-deleted" className="ml-2 block text-sm text-gray-900">
                  Show deleted
                </label>
              </div>

              <Button type="submit">
                Search
              </Button>
            </form>
          </div>
        </div>

        {/* Results */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <div className="text-red-600 mb-4">{error}</div>
                <Button onClick={() => fetchVideos(currentPage)}>
                  Try Again
                </Button>
              </div>
            ) : !videos || videos.videos.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 110 2h-1v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6H3a1 1 0 110-2h4z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No videos found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchTerm || statusFilter || showDeleted
                    ? 'Try adjusting your search criteria.'
                    : 'Get started by uploading your first thermal video.'}
                </p>
                <div className="mt-6">
                  <Button onClick={() => router.push('/videos')}>
                    Upload Video
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Results summary */}
                <div className="flex justify-between items-center mb-4">
                  <div className="text-sm text-gray-700">
                    Showing {((videos.page - 1) * videos.per_page) + 1} to {Math.min(videos.page * videos.per_page, videos.total)} of {videos.total} videos
                  </div>
                </div>

                {/* Videos table */}
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          File
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Size
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Uploaded
                        </th>
                        <th className="relative px-6 py-3">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {videos.videos.map((video) => (
                        <tr key={video.id} className={`hover:bg-gray-50 ${video.is_deleted ? 'opacity-60' : ''}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {video.original_filename}
                                  {video.is_deleted && (
                                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                      Deleted
                                    </span>
                                  )}
                                </div>
                                {video.tags && (
                                  <div className="text-sm text-gray-500">
                                    Tags: {video.tags}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(video.analysis_status)}`}>
                              {video.analysis_status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {video.file_size}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                            {video.description || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(video.created_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => router.push(`/videos/detail?id=${video.id}`)}
                            >
                              View
                            </Button>
                            {!video.is_deleted && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleDeleteVideo(video.id, false)}
                                className="text-red-600 hover:text-red-800"
                              >
                                Delete
                              </Button>
                            )}
                            {video.is_deleted && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleDeleteVideo(video.id, true)}
                                className="text-red-600 hover:text-red-800"
                              >
                                Permanent Delete
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {videos.total > videos.per_page && (
                  <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
                    <div className="flex flex-1 justify-between sm:hidden">
                      <Button
                        variant="secondary"
                        onClick={() => handlePageChange(videos.page - 1)}
                        disabled={videos.page === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handlePageChange(videos.page + 1)}
                        disabled={!videos.has_next}
                      >
                        Next
                      </Button>
                    </div>
                    <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          Page <span className="font-medium">{videos.page}</span> of{' '}
                          <span className="font-medium">{Math.ceil(videos.total / videos.per_page)}</span>
                        </p>
                      </div>
                      <div>
                        <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                          <Button
                            variant="secondary"
                            onClick={() => handlePageChange(videos.page - 1)}
                            disabled={videos.page === 1}
                            className="rounded-l-md"
                          >
                            Previous
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => handlePageChange(videos.page + 1)}
                            disabled={!videos.has_next}
                            className="rounded-r-md"
                          >
                            Next
                          </Button>
                        </nav>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}