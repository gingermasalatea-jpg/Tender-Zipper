export type UserRole = 'buyer' | 'vendor';
export type TenderType = 'ONE_TIME_JOB' | 'RECURRING_CONTRACT' | 'SUPPLY' | 'PROJECT';
export type TenderStatus = 'open' | 'closed' | 'awarded' | 'completed' | 'cancelled';
export type QuoteStatus = 'draft' | 'submitted' | 'withdrawn' | 'shortlisted' | 'awarded' | 'rejected';
export type DocStatus = 'pending' | 'verified' | 'rejected';

export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'boolean' | 'date' | 'items';

export interface ItemColumn {
  key: string;
  label: string;
  type?: 'text' | 'number';
  placeholder?: string;
}

export interface FormField {
  key: string;
  label: string;
  type: FieldType;
  unit?: string;
  options?: string[];
  required?: boolean;
  help?: string;
  columns?: ItemColumn[];
}

export interface FormSchema {
  fields: FormField[];
}

export interface QuoteLineTemplate {
  key: string;
  label: string;
  unit?: string;
  qty?: number;
  qty_from?: string;
}

export interface QuoteSchema {
  gst_default?: number;
  period_label?: string;
  allow_custom_items?: boolean;
  items_from?: string;
  line_items: QuoteLineTemplate[];
  extra_fields?: FormField[];
}

export interface LineItem {
  key: string;
  label: string;
  unit: string;
  qty: number;
  rate: number;
  amount?: number;
}

export type FormValues = Record<string, unknown>;

export interface Profile {
  id: string;
  phone: string | null;
  email: string | null;
  full_name: string | null;
  active_role: UserRole | null;
  is_admin: boolean;
  language: string;
}

export interface Category {
  id: number;
  parent_id: number | null;
  level: 1 | 2 | 3;
  name: string;
  slug: string;
  icon: string | null;
  tender_type: TenderType | null;
  sort: number;
  is_active: boolean;
}

export interface City {
  id: number;
  name: string;
  state: string;
  code: string;
  slug: string;
  is_active: boolean;
}

export interface Vendor {
  id: string;
  owner_id: string;
  type: 'individual' | 'agency';
  business_name: string;
  gstin: string | null;
  about: string | null;
  years_experience: number | null;
  team_size: number | null;
  city_id: number | null;
  verification_level: number;
  is_suspended: boolean;
}

export interface Tender {
  id: string;
  code: string;
  buyer_id: string;
  category_id: number;
  tender_type: TenderType;
  title: string;
  description: string | null;
  form_data: FormValues;
  budget_min: number | null;
  budget_max: number | null;
  budget_visible: boolean;
  city_id: number;
  pincode: string | null;
  area_label: string | null;
  address: string | null;
  status: TenderStatus;
  quote_deadline: string;
  start_date: string | null;
  site_visit_allowed: boolean;
  max_quotes: number;
  quote_count: number;
  is_flagged: boolean;
  flag_reason: string | null;
  created_at: string;
}

export interface BuyerQuote {
  id: string;
  status: QuoteStatus;
  line_items: LineItem[];
  extra: FormValues;
  gst_percent: number;
  subtotal: number;
  gst_amount: number;
  total: number;
  timeline_days: number | null;
  warranty_months: number | null;
  payment_terms: string | null;
  notes: string | null;
  submitted_at: string;
  vendor: {
    id: string;
    business_name: string;
    type: string;
    years_experience: number | null;
    team_size: number | null;
    verified: boolean;
    gstin: string | null;
    completed_jobs: number;
    phone: string | null;
    email: string | null;
    contact_name: string | null;
  };
}

export interface FeedTender {
  id: string;
  code: string;
  title: string;
  category_id: number;
  category_name: string;
  tender_type: TenderType;
  city_name: string;
  area_label: string | null;
  pincode: string | null;
  budget_min: number | null;
  budget_max: number | null;
  quote_deadline: string;
  start_date: string | null;
  quote_count: number;
  max_quotes: number;
  site_visit_allowed: boolean;
  created_at: string;
  my_quote_status: QuoteStatus | null;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export const TENDER_TYPE_LABEL: Record<TenderType, string> = {
  ONE_TIME_JOB: 'One-time job',
  RECURRING_CONTRACT: 'Recurring contract',
  SUPPLY: 'Supply',
  PROJECT: 'Project',
};

export const DOC_TYPES: { value: string; label: string }[] = [
  { value: 'gst', label: 'GST certificate' },
  { value: 'pan', label: 'PAN card' },
  { value: 'aadhaar', label: 'Aadhaar (masked)' },
  { value: 'udyam', label: 'Udyam / MSME certificate' },
  { value: 'psara_licence', label: 'PSARA licence (security)' },
  { value: 'labour_licence', label: 'Labour licence' },
  { value: 'pf_esi', label: 'PF / ESI registration' },
  { value: 'electrical_licence', label: 'Electrical contractor licence' },
  { value: 'other', label: 'Other' },
];
