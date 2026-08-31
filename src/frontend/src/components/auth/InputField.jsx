import { AlertCircleIcon } from '../common/Icons';

export const InputField = ({
  id,
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  icon: Icon,
  required = false,
  autoComplete
}) => {
  return (
    <div className={`auth-field-group ${error ? 'has-error' : ''}`}>
      <label htmlFor={id} className="auth-field-label">
        {label} {required && <span className="required-star">*</span>}
      </label>

      <div className="auth-input-container">
        {Icon && (
          <span className="auth-input-icon">
            <Icon size={18} />
          </span>
        )}

        <input
          id={id}
          name={id}
          type={type}
          className={`auth-text-input ${Icon ? 'with-icon' : ''}`}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          autoComplete={autoComplete}
        />
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
