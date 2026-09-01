import { useState, useEffect, useCallback } from 'react';
import { AuthContext } from './authContextInstance';
import { authApi } from '../services/api';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    return localStorage.getItem('tracemind_token') || sessionStorage.getItem('tracemind_token') || null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Helper to format user object with initials and display properties
  const formatUser = (userData) => {
    if (!userData) return null;

    const name = userData.name || userData.fullName || 'User';
    const names = name.trim().split(' ');
    const initials = names.length > 1
      ? (names[0][0] + names[names.length - 1][0]).toUpperCase()
      : names[0].slice(0, 2).toUpperCase();

    return {
      ...userData,
      fullName: name,
      initials,
      role: userData.role === 'admin' ? 'Administrator' : 'Member',
    };
  };

  const logout = useCallback(() => {
    localStorage.removeItem('tracemind_token');
    sessionStorage.removeItem('tracemind_token');
    setUser(null);
    setToken(null);
    setAuthError(null);
  }, []);

  // Verify and fetch user profile on initial load
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('tracemind_token') || sessionStorage.getItem('tracemind_token');
      if (storedToken) {
        try {
          const response = await authApi.getMe();
          if (response.success && response.user) {
            setUser(formatUser(response.user));
            setToken(storedToken);
          } else {
            logout();
          }
        } catch (err) {
          console.warn('[AuthContext] Stored token invalid or expired:', err.message);
          logout();
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, [logout]);

  const login = async (email, password, rememberMe = true) => {
    setAuthError(null);
    try {
      const response = await authApi.login({ email, password });
      if (response.success && response.token) {
        const formatted = formatUser(response.user);
        setUser(formatted);
        setToken(response.token);

        if (rememberMe) {
          localStorage.setItem('tracemind_token', response.token);
          sessionStorage.removeItem('tracemind_token');
        } else {
          sessionStorage.setItem('tracemind_token', response.token);
          localStorage.removeItem('tracemind_token');
        }

        return { success: true, user: formatted };
      }
      throw new Error(response.message || 'Login failed');
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const register = async ({ name, email, password }) => {
    setAuthError(null);
    try {
      const response = await authApi.register({ name, email, password });
      if (response.success) {
        return {
          success: true,
          isEmailVerified: response.isEmailVerified || false,
          email: response.email || email,
          message: response.message,
        };
      }
      throw new Error(response.message || 'Registration failed');
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const verifyOtp = async ({ email, otp, rememberMe = true }) => {
    setAuthError(null);
    try {
      const response = await authApi.verifyOtp({ email, otp });
      if (response.success && response.token) {
        const formatted = formatUser(response.user);
        setUser(formatted);
        setToken(response.token);

        if (rememberMe) {
          localStorage.setItem('tracemind_token', response.token);
          sessionStorage.removeItem('tracemind_token');
        } else {
          sessionStorage.setItem('tracemind_token', response.token);
          localStorage.removeItem('tracemind_token');
        }

        return { success: true, user: formatted };
      }
      throw new Error(response.message || 'Verification failed');
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const resendOtp = async (email) => {
    return await authApi.resendOtp({ email });
  };

  const updateProfile = async (profileData) => {
    const response = await authApi.updateProfile({
      name: profileData.fullName || profileData.name,
      email: profileData.email,
    });

    if (response.success && response.user) {
      const formatted = formatUser(response.user);
      setUser(formatted);
      return { success: true, user: formatted };
    }
    throw new Error(response.message || 'Failed to update profile');
  };

  const forgotPasswordSendOtp = async (email) => {
    return await authApi.forgotPasswordSendOtp({ email });
  };

  const forgotPasswordVerifyOtp = async ({ email, otp }) => {
    return await authApi.forgotPasswordVerifyOtp({ email, otp });
  };

  const forgotPasswordReset = async ({ email, resetToken, newPassword }) => {
    return await authApi.forgotPasswordReset({ email, resetToken, newPassword });
  };

  const changePasswordSendOtp = async () => {
    return await authApi.changePasswordSendOtp();
  };

  const changePassword = async ({ otp, currentPassword, newPassword }) => {
    const response = await authApi.changePassword({ otp, currentPassword, newPassword });
    if (response.success) {
      return { success: true, message: response.message };
    }
    throw new Error(response.message || 'Failed to update password');
  };

  const deleteAccount = async (password) => {
    const response = await authApi.deleteAccount({ password });
    if (response.success) {
      logout();
      return { success: true };
    }
    throw new Error(response.message || 'Failed to delete account');
  };

  const value = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    authError,
    login,
    register,
    verifyOtp,
    resendOtp,
    forgotPasswordSendOtp,
    forgotPasswordVerifyOtp,
    forgotPasswordReset,
    changePasswordSendOtp,
    logout,
    updateProfile,
    changePassword,
    deleteAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
