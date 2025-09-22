const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const config: RequestInit = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      let errorMessage = 'Request failed';
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      
      throw new ApiError(errorMessage, response.status);
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
      return {} as T;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Network error', 0);
  }
}

export interface SignupData {
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
}


export interface UserData {
  id: string;
  email: string;
  role: string;
  last_login?: string;
  created_at: string;
  is_active: boolean;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  token: string;
  password: string;
}

export interface VideoMetadata {
  id: string;
  filename: string;
  original_filename: string;
  file_size: string;
  duration?: string;
  description?: string;
  tags?: string;
  subject_id?: string;
  analysis_status: string;
  video_metadata?: Record<string, any>;
  is_deleted: boolean;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface VideoListResponse {
  videos: VideoMetadata[];
  total: number;
  page: number;
  per_page: number;
  has_next: boolean;
}

export interface VideoUploadResponse {
  message: string;
  video_id: string;
  filename: string;
  file_size: string;
  status: string;
}

export interface VideoUpdateRequest {
  original_filename?: string;
  description?: string;
  tags?: string;
  subject_id?: string;
  analysis_status?: string;
}

export const api = {
  async signup(data: SignupData): Promise<void> {
    return apiRequest('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async login(data: LoginData): Promise<LoginResponse> {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },


  async me(): Promise<UserData> {
    return apiRequest('/auth/me');
  },

  async logout(): Promise<void> {
    return apiRequest('/auth/logout', {
      method: 'POST',
    });
  },

  async forgotPassword(data: ForgotPasswordData): Promise<void> {
    return apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async resetPassword(data: ResetPasswordData): Promise<void> {
    return apiRequest('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Video APIs
  async getVideos(params?: {
    page?: number;
    per_page?: number;
    status?: string;
    search?: string;
    include_deleted?: boolean;
  }): Promise<VideoListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.per_page) queryParams.set('per_page', params.per_page.toString());
    if (params?.status) queryParams.set('status', params.status);
    if (params?.search) queryParams.set('search', params.search);
    if (params?.include_deleted) queryParams.set('include_deleted', 'true');

    const query = queryParams.toString();
    return apiRequest(`/api/videos${query ? `?${query}` : ''}`);
  },

  async getVideo(videoId: string): Promise<VideoMetadata> {
    return apiRequest(`/api/videos/${videoId}`);
  },

  async updateVideo(videoId: string, data: VideoUpdateRequest): Promise<VideoMetadata> {
    return apiRequest(`/api/videos/${videoId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteVideo(videoId: string, hardDelete: boolean = false): Promise<{ message: string; video_id: string; files_deleted: boolean }> {
    const queryParams = hardDelete ? '?hard_delete=true' : '';
    return apiRequest(`/api/videos/${videoId}${queryParams}`, {
      method: 'DELETE',
    });
  },

  async uploadVideo(file: File): Promise<VideoUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return apiRequest('/api/videos/upload', {
      method: 'POST',
      body: formData,
      headers: {}, // Remove Content-Type to let browser set it for FormData
    });
  },
};

export { ApiError };