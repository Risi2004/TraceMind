import './ToggleSwitch.css';

export const ToggleSwitch = ({ id, checked, onChange, disabled = false, ariaLabel }) => {
  return (
    <label htmlFor={id} className={`toggle-switch-label ${disabled ? 'disabled' : ''}`}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="toggle-switch-input"
        aria-label={ariaLabel}
      />
      <span className="toggle-switch-slider"></span>
    </label>
  );
};
