export const FeatureCard = ({ icon: Icon, title, description, badge }) => {
  return (
    <div className="feature-card">
      <div className="feature-card-glow" aria-hidden="true"></div>
      
      <div className="feature-card-header">
        <div className="feature-icon-wrapper">
          <Icon size={26} className="feature-icon" />
        </div>
        {badge && <span className="feature-card-badge">{badge}</span>}
      </div>

      <h3 className="feature-title">{title}</h3>
      <p className="feature-description">{description}</p>
    </div>
  );
};
