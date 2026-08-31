import { useState } from 'react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { InputField } from '../components/auth/InputField';
import { PasswordField } from '../components/auth/PasswordField';
import { UserIcon, MailIcon, GoogleIcon, CheckCircleIcon } from '../components/common/Icons';
import '../components/auth/AuthForm.css';

export const SignUpPage = ({ onNavigate }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  const validateField = (name, value) => {
    let errorMsg = '';
    if (name === 'fullName') {
      if (!value.trim()) {
        errorMsg = 'Full name is required';
      }
    } else if (name === 'email') {
      if (!value.trim()) {
        errorMsg = 'Email address is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
        errorMsg = 'Please enter a valid email address';
      }
    } else if (name === 'password') {
      if (!value) {
        errorMsg = 'Password is required';
      } else if (value.length < 8) {
        errorMsg = 'Password must be at least 8 characters';
      }
    } else if (name === 'confirmPassword') {
      if (!value) {
        errorMsg = 'Please confirm your password';
      } else if (value !== formData.password) {
        errorMsg = 'Passwords do not match';
      }
    } else if (name === 'agreeTerms') {
      if (!value) {
        errorMsg = 'You must agree to the Terms and Conditions';
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
    const { name, value, type, checked } = e.target;
    const fieldValue = type === 'checkbox' ? checked : value;
    const errorMsg = validateField(name, fieldValue);
    if (errorMsg) {
      setErrors(prev => ({ ...prev, [name]: errorMsg }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    const nameError = validateField('fullName', formData.fullName);
    if (nameError) newErrors.fullName = nameError;

    const emailError = validateField('email', formData.email);
    if (emailError) newErrors.email = emailError;

    const passwordError = validateField('password', formData.password);
    if (passwordError) newErrors.password = passwordError;

    const confirmError = validateField('confirmPassword', formData.confirmPassword);
    if (confirmError) newErrors.confirmPassword = confirmError;

    const termsError = validateField('agreeTerms', formData.agreeTerms);
    if (termsError) newErrors.agreeTerms = termsError;

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      setIsSubmitting(true);
      // Simulated frontend-only signup action
      setTimeout(() => {
        setIsSubmitting(false);
        setSignUpSuccess(true);
      }, 700);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Get started with TraceMind AI document intelligence."
      onNavigate={onNavigate}
    >
      {signUpSuccess ? (
        <div className="auth-success-banner">
          <CheckCircleIcon size={20} />
          <span>Account created successfully! Redirecting to sign in...</span>
          <button
            type="button"
            className="btn-auth-submit"
            style={{ marginTop: '1rem' }}
            onClick={() => onNavigate('/login')}
          >
            Go to Sign In
          </button>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {/* Full Name */}
          <InputField
            id="fullName"
            label="Full Name"
            type="text"
            placeholder="Jane Doe"
            value={formData.fullName}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.fullName}
            icon={UserIcon}
            required
            autoComplete="name"
          />

          {/* Email */}
          <InputField
            id="email"
            label="Email Address"
            type="email"
            placeholder="jane@company.com"
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
            placeholder="At least 8 characters"
            value={formData.password}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.password}
            required
            autoComplete="new-password"
          />

          {/* Confirm Password */}
          <PasswordField
            id="confirmPassword"
            label="Confirm Password"
            placeholder="Re-enter your password"
            value={formData.confirmPassword}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.confirmPassword}
            required
            autoComplete="new-password"
          />

          {/* Terms and Conditions Checkbox */}
          <div className="auth-field-group">
            <label className="auth-checkbox-label">
              <input
                type="checkbox"
                name="agreeTerms"
                checked={formData.agreeTerms}
                onChange={handleChange}
                onBlur={handleBlur}
                className="auth-checkbox"
              />
              <span>
                I agree to the <a href="#" onClick={(e) => { e.preventDefault(); alert("Terms of Service preview."); }} className="auth-link">Terms of Service</a> and <a href="#" onClick={(e) => { e.preventDefault(); alert("Privacy Policy preview."); }} className="auth-link">Privacy Policy</a>
              </span>
            </label>
            {errors.agreeTerms && (
              <p className="auth-field-error">
                <span>{errors.agreeTerms}</span>
              </p>
            )}
          </div>

          {/* Primary Create Account Button */}
          <button
            type="submit"
            className="btn-auth-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating Account...' : 'Create Account'}
          </button>

          {/* Divider */}
          <div className="auth-divider">
            <span className="divider-text">or</span>
          </div>

          {/* Google Sign Up Button */}
          <button
            type="button"
            className="btn-google-auth"
            onClick={() => alert("Google OAuth will be configured with backend authentication.")}
          >
            <GoogleIcon size={18} />
            <span>Sign up with Google</span>
          </button>

          {/* Switch Prompt */}
          <p className="auth-switch-prompt">
            Already have an account?
            <button
              type="button"
              className="auth-switch-btn"
              onClick={() => onNavigate('/login')}
            >
              Sign in
            </button>
          </p>
        </form>
      )}
    </AuthLayout>
  );
};
