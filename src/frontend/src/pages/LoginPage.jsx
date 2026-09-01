import { useState } from 'react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { InputField } from '../components/auth/InputField';
import { PasswordField } from '../components/auth/PasswordField';
import { MailIcon, GoogleIcon, CheckCircleIcon, AlertCircleIcon } from '../components/common/Icons';
import { useAuth } from '../context/useAuth';
import '../components/auth/AuthForm.css';

export const LoginPage = ({ onNavigate }) => {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
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
    setServerError('');

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    const newErrors = {};

    const emailError = validateField('email', formData.email);
    if (emailError) newErrors.email = emailError;

    const passwordError = validateField('password', formData.password);
    if (passwordError) newErrors.password = passwordError;

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      setIsSubmitting(true);
      try {
        await login(formData.email.trim(), formData.password, formData.rememberMe);
        setLoginSuccess(true);
        setTimeout(() => {
          onNavigate('/chat');
        }, 500);
      } catch (err) {
        if (err.data?.isEmailVerified === false || err.message?.toLowerCase().includes('verify your email')) {
          sessionStorage.setItem('tracemind_pending_email', formData.email.trim());
          setServerError({
            text: err.message || 'Please verify your email address to log in.',
            unverified: true,
            email: formData.email.trim(),
          });
        } else {
          setServerError({
            text: err.message || 'Invalid email or password. Please try again.',
            unverified: false,
          });
        }
      } finally {
        setIsSubmitting(false);
      }
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
          <span>Signed in successfully! Loading workspace...</span>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {/* Server Error Banner */}
          {serverError && (
            <div className="auth-error-banner" role="alert" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircleIcon size={16} />
                <span>{serverError.text || serverError}</span>
              </div>
              {serverError.unverified && (
                <button
                  type="button"
                  onClick={() => onNavigate(`/verify-otp?email=${encodeURIComponent(serverError.email)}`)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#93c5fd',
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                    marginLeft: '1.5rem',
                  }}
                >
                  Enter Verification Code &rarr;
                </button>
              )}
            </div>
          )}

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

            <button
              type="button"
              onClick={() => onNavigate('forgot-password', { email: formData.email })}
              className="auth-link-button"
            >
              Forgot password?
            </button>
          </div>

          {/* Primary Sign In Button */}
          <button
            type="submit"
            className={`btn-auth-submit ${isSubmitting ? 'is-loading' : ''}`}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="btn-spinner" aria-hidden="true" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>

          {/* Divider */}
          <div className="auth-divider">
            <span className="divider-text">or</span>
          </div>

          {/* Google Sign In Button */}
          <button
            type="button"
            className="btn-google-auth"
            onClick={() => alert("Google OAuth requires OAuth client ID configuration in environment.")}
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
