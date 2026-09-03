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

/**
 * Document Storage & Repository API (Cloudflare R2 + MongoDB)
 */
export const documentsApi = {
  // Multi-file & ZIP upload with progress callback
  upload: (formData, onProgress) => {
    return new Promise((resolve, reject) => {
      const token = localStorage.getItem('tracemind_token') || sessionStorage.getItem('tracemind_token');
      const xhr = new XMLHttpRequest();
      const url = `${API_BASE_URL}/documents/upload`;

      xhr.open('POST', url);

      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        let responseData;
        try {
          responseData = JSON.parse(xhr.responseText);
        } catch {
          responseData = { message: xhr.statusText };
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(responseData);
        } else {
          const error = new Error(responseData?.message || `Upload failed with status ${xhr.status}`);
          error.status = xhr.status;
          error.data = responseData;
          reject(error);
        }
      };


      xhr.onerror = () => {
        reject(new Error('Network error during file upload to server.'));
      };

      xhr.send(formData);
    });
  },

  // Get all uploaded documents for the user
  getAll: () => request('/documents', {
    method: 'GET',
  }),

  // Get secure presigned R2 view URL
  getViewUrl: (id) => request(`/documents/${id}/view-url`, {
    method: 'GET',
  }),

  // Delete document from R2 and MongoDB
  delete: (id) => request(`/documents/${id}`, {
    method: 'DELETE',
  }),
};

/**
 * RAG Semantic Search & Grounded Generation API (Qdrant + RunPod Qwen)
 */
export const ragApi = {
  // Retrieve top relevant chunks from Qdrant Cloud
  search: ({ query, documentId, topK }) =>
    request('/rag/search', {
      method: 'POST',
      body: JSON.stringify({ query, documentId, topK }),
    }),

  // Full Grounded RAG Query with Qwen LLM
  query: ({ query, documentId, chatHistory, topK }) =>
    request('/rag/query', {
      method: 'POST',
      body: JSON.stringify({ query, documentId, chatHistory, topK }),
    }),
};

export default {
  auth: authApi,
  documents: documentsApi,
  rag: ragApi,
};


