export interface Consultation {
  id: number;
  title: string;
  description?: string;
  status: string;
  total_comments?: number;
  positive_pct?: number;
  negative_pct?: number;
  top_issues?: string[];
  versions?: Version[];
}

export interface Version {
  id: number;
  version_number: string;
  comment_count: number;
  label?: string;
}

export interface Comment {
  id: number;
  consultation_id?: number;
  text: string;
  section?: string;
  subsection?: string;
  stakeholder_type?: string;
  version?: string;
  sentiment?: string;
  confidence?: number;
  model_name?: string;
  issue?: string;
  issue_confidence?: number;
}

export interface PriorityComponents {
  magnitude: number;
  negativity: number;
  stakeholder_breadth: number;
  evolution: number;
}

export interface Issue {
  issue: string;
  count: number;
  negative_pct: number;
  priority_score: number;
  priority_level: string;
  evidence_sufficiency: string;
}

export interface IssueDetail extends Issue {
  positive_pct: number;
  neutral_pct: number;
  priority_explanation: string;
  components: PriorityComponents;
  lifecycle: string;
  trajectory: string;
  sections: { section: string; count: number }[];
  stakeholders: { stakeholder: string; count: number }[];
  version_counts: Record<string, number>;
}

export interface DashboardData {
  consultation: { id: number; title: string; description?: string; status: string };
  kpis: {
    total: number;
    positive: number;
    negative: number;
    neutral: number;
    positive_pct: number;
    negative_pct: number;
    neutral_pct: number;
  };
  versions: Version[];
  sentiment_by_version: {
    version: string;
    total: number;
    positive_pct: number;
    negative_pct: number;
    neutral_pct: number;
  }[];
  sections: { section: string; total: number; positive_pct: number; negative_pct: number; neutral_pct: number }[];
  stakeholders: { stakeholder: string; total: number; positive_pct: number; negative_pct: number; neutral_pct: number }[];
  top_issues: Issue[];
  evolution_preview: EvolutionItem[];
}

export interface EvolutionItem {
  issue: string;
  version_counts: Record<string, number>;
  version_negative_pct: Record<string, number>;
  total: number;
  change_pct: number;
  status: string;
}

export interface ComparisonData {
  sentiment_by_version: DashboardData['sentiment_by_version'];
  issue_evolution: EvolutionItem[];
}

export interface UploadResult {
  success: boolean;
  message: string;
  rows_total: number;
  rows_stored: number;
  rows_invalid: number;
  rows_processed?: number;
  rows_filtered?: number;
  rows_failed?: number;
  row_errors?: Array<{ row_number: number; status: string; reason: string }>;
  warnings?: string[];
  sentiments: Record<string, number>;
  issues_detected: string[];
  consultation_id?: number;
}
