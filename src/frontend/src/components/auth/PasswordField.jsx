import { useState } from 'react';
import { LockIcon, EyeIcon, EyeOffIcon, AlertCircleIcon } from '../common/Icons';

export const PasswordField = ({
  id,
  label = 'Password',
  placeholder = '••••••••',
  value,
  onChange,
  onBlur,
  error,
  required = false,
  autoComplete = 'current-password'
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  return (
    <div className={`auth-field-group ${error ? 'has-error' : ''}`}>
      <label htmlFor={id} className="auth-field-label">
        {label} {required && <span className="required-star">*</span>}
      </label>

      <div className="auth-input-container">
        <span className="auth-input-icon">
          <LockIcon size={18} />
        </span>

        <input
          id={id}
          name={id}
          type={showPassword ? 'text' : 'password'}
          className="auth-text-input with-icon with-action"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          autoComplete={autoComplete}
        />

        <button
          type="button"
          className="auth-password-toggle"
          onClick={togglePasswordVisibility}
          aria-label={showPassword ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
        </button>
      </div>

      {error && (
        <p className="auth-field-error" id={`${id}-error`} role="alert">
          <AlertCircleIcon size={14} className="error-icon" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};
