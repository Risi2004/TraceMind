import { SearchIcon, BrainIcon, ShieldCheckIcon, ZapIcon } from '../common/Icons';
import { FeatureCard } from './FeatureCard';
import './Features.css';

export const Features = () => {
  const featureList = [
    {
      icon: SearchIcon,
      title: "Intelligent Search",
      description: "Semantic search engine that understands context, intent, and domain-specific terminology across thousands of document pages instantly.",
      badge: "Semantic AI"
    },
    {
      icon: BrainIcon,
      title: "AI-Powered Reasoning",
      description: "Multi-step reasoning engine capable of synthesizing complex insights, cross-referencing tables, and extracting structured data points accurately.",
      badge: "Deep Analysis"
    },
    {
      icon: ShieldCheckIcon,
      title: "Verified Sources",
      description: "Every answer is backed by direct page-level citations and traceable evidence to eliminate hallucinations and build enterprise trust.",
      badge: "Traceable"
    },
    {
      icon: ZapIcon,
      title: "Fast & Efficient",
      description: "High-throughput processing pipelines parse PDFs, DOCX, and scanned documents in milliseconds with sub-second querying response times.",
      badge: "Sub-Second"
    }
  ];

  return (
    <section className="features-section" id="features">
      <div className="container">
        {/* Section Header */}
        <div className="features-header">
          <div className="section-pill">
            <span>WHY CHOOSE TRACEMIND?</span>
          </div>
          <h2 className="features-headline">
            Engineered for Precision, Speed, and Trust
          </h2>
          <p className="features-subheading">
            Experience document intelligence built for analysts, researchers, and enterprise teams who demand verifiable answers without compromise.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="features-grid">
          {featureList.map((feat, index) => (
            <FeatureCard
              key={index}
              icon={feat.icon}
              title={feat.title}
              description={feat.description}
              badge={feat.badge}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
