const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Simple token storage (in production, use secure storage)
let currentToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  currentToken = token;
};

export const getAuthToken = () => currentToken;

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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };

  // Add Authorization header if token exists
  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }

  const config: RequestInit = {
    credentials: 'include',
    headers,
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
  access_token?: string;
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
    const response = await apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    // Store the token for subsequent requests
    if (response.access_token) {
      setAuthToken(response.access_token);
    }

    return response;
  },


  async me(): Promise<UserData> {
    return apiRequest('/auth/me');
  },

  async logout(): Promise<void> {
    const response = await apiRequest('/auth/logout', {
      method: 'POST',
    });

    // Clear the stored token
    setAuthToken(null);

    return response;
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

    // For file uploads, we need to handle headers differently
    const headers: Record<string, string> = {};

    // Add Authorization header if token exists
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    const url = `${API_BASE_URL}/api/videos/upload`;
    const config: RequestInit = {
      method: 'POST',
      credentials: 'include',
      headers, // Don't set Content-Type for FormData
      body: formData,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        let errorMessage = 'Upload failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }

        throw new ApiError(errorMessage, response.status);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Network error', 0);
    }
  },
};

export { ApiError };