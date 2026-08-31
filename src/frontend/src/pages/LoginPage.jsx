import { useState } from 'react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { InputField } from '../components/auth/InputField';
import { PasswordField } from '../components/auth/PasswordField';
import { MailIcon, GoogleIcon, CheckCircleIcon } from '../components/common/Icons';
import '../components/auth/AuthForm.css';

export const LoginPage = ({ onNavigate }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);

  const validateField = (name, value) => {
    let errorMsg = '';
    if (name === 'email') {
      if (!value.trim()) {
        errorMsg = 'Email address is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
        errorMsg = 'Please enter a valid email address';
      }
    } else if (name === 'password') {
      if (!value) {
        errorMsg = 'Password is required';
      } else if (value.length < 6) {
        errorMsg = 'Password must be at least 6 characters';
      }
    }
    return errorMsg;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const fieldValue = type === 'checkbox' ? checked : value;
    setFormData(prev => ({ ...prev, [name]: fieldValue }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    const errorMsg = validateField(name, value);
    if (errorMsg) {
      setErrors(prev => ({ ...prev, [name]: errorMsg }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    const emailError = validateField('email', formData.email);
    if (emailError) newErrors.email = emailError;

    const passwordError = validateField('password', formData.password);
    if (passwordError) newErrors.password = passwordError;

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      setIsSubmitting(true);
      // Simulated frontend-only login action
      setTimeout(() => {
        setIsSubmitting(false);
        setLoginSuccess(true);
        setTimeout(() => onNavigate('/chat'), 600);
      }, 500);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue to TraceMind."
      onNavigate={onNavigate}
    >
      {loginSuccess ? (
        <div className="auth-success-banner">
          <CheckCircleIcon size={20} />
          <span>Signed in successfully! (Frontend demo mode)</span>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {/* Email */}
          <InputField
            id="email"
            label="Email Address"
            type="email"
            placeholder="you@company.com"
            value={formData.email}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.email}
            icon={MailIcon}
            required
            autoComplete="email"
          />

          {/* Password */}
          <PasswordField
            id="password"
            label="Password"
            placeholder="Enter your password"
            value={formData.password}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.password}
            required
            autoComplete="current-password"
          />

          {/* Remember me & Forgot password */}
          <div className="auth-options-row">
            <label className="auth-checkbox-label">
              <input
                type="checkbox"
                name="rememberMe"
                checked={formData.rememberMe}
                onChange={handleChange}
                className="auth-checkbox"
              />
              <span>Remember me</span>
            </label>

            <a href="#" onClick={(e) => { e.preventDefault(); alert("Password reset functionality will be available with backend integration."); }} className="auth-link">
              Forgot password?
            </a>
          </div>

          {/* Primary Sign In Button */}
          <button
            type="submit"
            className="btn-auth-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>

          {/* Divider */}
          <div className="auth-divider">
            <span className="divider-text">or</span>
          </div>

          {/* Google Sign In Button */}
          <button
            type="button"
            className="btn-google-auth"
            onClick={() => alert("Google OAuth will be configured with backend authentication.")}
          >
            <GoogleIcon size={18} />
            <span>Continue with Google</span>
          </button>

          {/* Switch Prompt */}
          <p className="auth-switch-prompt">
            Don’t have an account?
            <button
              type="button"
              className="auth-switch-btn"
              onClick={() => onNavigate('/signup')}
            >
              Sign up
            </button>
          </p>
        </form>
      )}
    </AuthLayout>
  );
};
