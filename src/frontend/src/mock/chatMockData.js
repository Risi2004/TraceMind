export const MOCK_COLLECTIONS = [
  { id: 'all', name: 'All Documents', count: 12 },
  { id: 'finance', name: 'Financial Reports', count: 4 },
  { id: 'legal', name: 'Legal & Compliance', count: 5 },
  { id: 'tech', name: 'Technical Specs', count: 3 }
];

export const MOCK_DOCUMENTS = [
  { id: 'doc-1', title: 'Q3 2025 Financial Performance Report', filename: 'Q3_2025_Financial_Performance.pdf', format: 'PDF', type: 'PDF', pages: 48, collection: 'finance', size: '4.2 MB', uploadDate: 'Oct 15, 2025', date: '2025-10-15', status: 'Indexed & Verified' },
  { id: 'doc-2', title: 'Enterprise Master Services Agreement v3', filename: 'Enterprise_Master_Services_Agreement_v3.docx', format: 'DOCX', type: 'DOCX', pages: 32, collection: 'legal', size: '1.8 MB', uploadDate: 'Sep 20, 2025', date: '2025-09-20', status: 'Indexed & Verified' },
  { id: 'doc-3', title: 'SOC 2 Type II Security Audit Report', filename: 'SOC2_Type_II_Security_Audit_Report.pdf', format: 'PDF', type: 'PDF', pages: 64, collection: 'security', size: '6.1 MB', uploadDate: 'Nov 04, 2025', date: '2025-11-04', status: 'Indexed & Verified' },
  { id: 'doc-4', title: 'Cloud Architecture & Design Spec', filename: 'Cloud_Architecture_Design_Spec.pdf', format: 'PDF', type: 'PDF', pages: 28, collection: 'tech', size: '3.5 MB', uploadDate: 'Aug 12, 2025', date: '2025-08-12', status: 'Indexed & Verified' },
  { id: 'doc-5', title: 'Global Vendor Risk Assessment Framework', filename: 'Global_Vendor_Risk_Assessment.pdf', format: 'PDF', type: 'PDF', pages: 18, collection: 'legal', size: '2.4 MB', uploadDate: 'Oct 01, 2025', date: '2025-10-01', status: 'Indexed & Verified' },
  { id: 'doc-6', title: 'Annual Budget & Headcount Forecast 2026', filename: 'Annual_Budget_Forecast_2026.xlsx', format: 'XLSX', type: 'XLSX', pages: 12, collection: 'finance', size: '1.2 MB', uploadDate: 'Dec 01, 2025', date: '2025-12-01', status: 'Indexed & Verified' }
];


export const MOCK_SUGGESTIONS = [
  {
    id: 'sug-1',
    category: 'Financial Analysis',
    text: 'What were the primary revenue drivers and gross margin changes in Q3 2025?',
    scope: 'finance'
  },
  {
    id: 'sug-2',
    category: 'Legal & Compliance',
    text: 'Summarize the indemnification obligations and liability caps in the Master Services Agreement.',
    scope: 'legal'
  },
  {
    id: 'sug-3',
    category: 'Security & Audit',
    text: 'List the key findings and remediation timelines from the SOC 2 Type II audit report.',
    scope: 'legal'
  },
  {
    id: 'sug-4',
    category: 'Cross-Document Comparison',
    text: 'Compare data retention policies between the Security Spec and Vendor Agreement.',
    scope: 'all'
  }
];

export const MOCK_HISTORY = [
  { id: 'chat-1', title: 'Q3 Financial Performance Analysis', date: 'Just now', scope: 'Financial Reports' },
  { id: 'chat-2', title: 'Vendor SLA & Liability Review', date: 'Yesterday', scope: 'Legal & Compliance' },
  { id: 'chat-3', title: 'SOC2 Security Remediation Plan', date: '3 days ago', scope: 'Security Audit' },
  { id: 'chat-4', title: 'Cloud Data Architecture Specs', date: 'Last week', scope: 'Technical Specs' }
];

export const MOCK_CITATIONS_DATABASE = {
  'cit-1': {
    id: 'cit-1',
    label: 'Doc 1, p. 14',
    docTitle: 'Q3_2025_Financial_Performance.pdf',
    pageNumber: 14,
    section: 'Section 3.2: Enterprise Cloud Subscriptions & ARR Growth',
    matchScore: '98.5%',
    snippet: 'Enterprise cloud subscription revenue increased by 28.4% YoY to $42.6M, driven primarily by enterprise expansion and multi-year contract renewals. Gross margin for cloud delivery expanded 210 bps to 74.2% due to improved infrastructure utilization.',
    date: '2025-10-15'
  },
  'cit-2': {
    id: 'cit-2',
    label: 'Doc 1, p. 19',
    docTitle: 'Q3_2025_Financial_Performance.pdf',
    pageNumber: 19,
    section: 'Section 4.1: Operating Expenses & R&D Investments',
    matchScore: '96.2%',
    snippet: 'Research and development expenditures rose 12.1% to $14.8M as investment in AI-driven document intelligence models accelerated. Operational efficiency offset marketing headcount costs by $2.3M.',
    date: '2025-10-15'
  },
  'cit-3': {
    id: 'cit-3',
    label: 'Doc 2, p. 8',
    docTitle: 'Enterprise_Master_Services_Agreement_v3.docx',
    pageNumber: 8,
    section: 'Clause 7.3: Limitation of Direct and Consequential Damages',
    matchScore: '97.8%',
    snippet: 'Except for gross negligence or willful misconduct, neither party shall be liable for indirect, incidental, or consequential damages. Total aggregate liability for all claims arising under this Agreement shall not exceed twelve (12) months of fees paid prior to the incident.',
    date: '2025-09-20'
  },
  'cit-4': {
    id: 'cit-4',
    label: 'Doc 3, p. 22',
    docTitle: 'SOC2_Type_II_Security_Audit_Report.pdf',
    pageNumber: 22,
    section: 'Criteria CC6.1: Logical Access Controls & MFA Enforcement',
    matchScore: '99.1%',
    snippet: 'The independent auditor verified that mandatory multi-factor authentication (MFA) and zero-trust role-based access controls (RBAC) were active across 100% of production infrastructure sample accounts without exception.',
    date: '2025-11-04'
  }
};

export const MOCK_INVESTIGATION_STEPS = [
  {
    step: 1,
    title: 'Searching Documents',
    status: 'completed',
    icon: 'search',
    query: 'revenue drivers gross margin growth breakdown Q3 2025',
    details: 'Searched 48 pages in Q3_2025_Financial_Performance.pdf using dense semantic vector embeddings.',
    found: 'Retrieved 8 candidate passages across Sections 3 and 4.'
  },
  {
    step: 2,
    title: 'Analyzing Evidence',
    status: 'completed',
    icon: 'brain',
    query: 'Cross-referencing Section 3.2 and Section 4.1 tables',
    details: 'Evaluated paragraph similarity scores: Cloud revenue growth (0.985) and R&D spending trajectory (0.962).',
    found: 'Confirmed direct metric correlation between subscription expansion and gross margin improvement.'
  },
  {
    step: 3,
    title: 'Missing Information Check',
    status: 'completed',
    icon: 'alert',
    query: 'Validating infrastructure amortization footnote',
    details: 'Detected footnote reference in Table 3.2 regarding cloud provider credits.',
    found: 'Verified credit allocation had no distortion on recurring gross margin.'
  },
  {
    step: 4,
    title: 'Follow-up Search',
    status: 'completed',
    icon: 'search',
    query: 'infrastructure hosting and amortization schedule Q3 2025',
    details: 'Targeted secondary vector query in Financial Statements Annex.',
    found: 'Retrieved exact line item breakdown on page 19.'
  },
  {
    step: 5,
    title: 'Comparing Sources',
    status: 'completed',
    icon: 'layers',
    query: 'Cross-validating YoY vs QoQ percentage variances',
    details: 'Reconciled GAAP and non-GAAP gross margin metrics across reports.',
    found: 'All metrics verified with zero mathematical discrepancy.'
  },
  {
    step: 6,
    title: 'Evidence Sufficient',
    status: 'completed',
    icon: 'shield',
    query: 'Confidence Score: 98.4%',
    details: 'Passed source verification threshold (min 90%). All claims mapped to verifiable page coordinates.',
    found: '4 direct citations verified.'
  },
  {
    step: 7,
    title: 'Generating Answer',
    status: 'completed',
    icon: 'sparkles',
    query: 'Synthesizing verified factual response',
    details: 'Grounded generation active with strict citation anchors and citation tags.',
    found: 'Response generated with 2 primary document citations.'
  }
];

export const INITIAL_CHAT_CONVERSATION = [
  {
    id: 'msg-1',
    role: 'user',
    timestamp: '10:24 AM',
    content: 'What were the primary revenue drivers and gross margin changes in Q3 2025?'
  },
  {
    id: 'msg-2',
    role: 'assistant',
    timestamp: '10:24 AM',
    scope: 'Financial Reports',
    content: `Based on the verified financial records in **Q3 2025 Financial Performance Report**, here is the synthesized breakdown:

### 1. Primary Revenue Drivers
* **Enterprise Cloud Subscriptions**: Generated **$42.6M** in revenue, marking a **28.4% year-over-year (YoY) increase** [cit-1]. Growth was primarily propelled by multi-year contract renewals and expansion within Fortune 500 accounts.
* **Operational Efficiency**: Streamlined service delivery pipelines contributed to operational savings of **$2.3M**, compensating for headcount investments in strategic departments [cit-2].

### 2. Gross Margin Expansion
* Cloud delivery gross margin reached **74.2%**, representing an expansion of **210 basis points (bps)** compared to the prior-year period [cit-1].
* The margin improvement was attributed to optimized multi-cloud infrastructure utilization and automated workload routing [cit-1].

### 3. Key Investment Offsets
* Research & Development expenditures increased by **12.1% to $14.8M**, focused on accelerating TraceMind document intelligence model training [cit-2].`,
    citations: ['cit-1', 'cit-2'],
    investigationSteps: MOCK_INVESTIGATION_STEPS
  }
];

export const MOCK_USER_PROFILE = {
  fullName: 'Alex Morgan',
  email: 'alex.morgan@tracemind.ai',
  role: 'Administrator',
  initials: 'AM',
  joinedDate: 'January 2025'
};


