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
  totp_required: boolean;
}

export interface TotpSetupResponse {
  secret: string;
  otpauth_url: string;
}

export interface TotpVerifyData {
  code: string;
}

export interface TotpVerifyResponse {
  verified: boolean;
}

export interface UserData {
  email: string;
  totp_enabled: boolean;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  token: string;
  password: string;
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

  async totpSetup(): Promise<TotpSetupResponse> {
    return apiRequest('/auth/totp/setup', {
      method: 'POST',
    });
  },

  async totpVerify(data: TotpVerifyData): Promise<TotpVerifyResponse> {
    return apiRequest('/auth/totp/verify', {
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
};

export { ApiError };