const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/**
 * Universal fetch wrapper attaching JSON headers and JWT Bearer token
 */
async function request(endpoint, options = {}) {
  const token = localStorage.getItem('tracemind_token') || sessionStorage.getItem('tracemind_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data.message || `Request failed with status ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    if (!error.status) {
      error.message = 'Unable to connect to the TraceMind server. Please ensure the backend is running.';
    }
    throw error;
  }
}

export const authApi = {
  register: (userData) => request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  }),

  verifyOtp: (data) => request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  resendOtp: (data) => request('/auth/resend-otp', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  login: (credentials) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }),

  // Forgot Password APIs
  forgotPasswordSendOtp: (data) => request('/auth/forgot-password/send-otp', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  forgotPasswordVerifyOtp: (data) => request('/auth/forgot-password/verify-otp', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  forgotPasswordReset: (data) => request('/auth/forgot-password/reset', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getMe: () => request('/auth/me', {
    method: 'GET',
  }),

  updateProfile: (profileData) => request('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(profileData),
  }),

  // Logged-in Change Password APIs
  changePasswordSendOtp: () => request('/auth/change-password/send-otp', {
    method: 'POST',
  }),

  changePassword: (passwordData) => request('/auth/change-password', {
    method: 'PUT',
    body: JSON.stringify(passwordData),
  }),

  deleteAccount: (data) => request('/auth/account', {
    method: 'DELETE',
    body: JSON.stringify(data),
  }),
};

export default {
  auth: authApi,
};
