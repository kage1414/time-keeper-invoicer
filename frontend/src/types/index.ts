export interface Client {
  id: number;
  name: string | null;
  company: string;
  email: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  client_id: number;
  client_name: string;
  name: string;
  description: string;
  default_rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  id: number;
  project_id: number;
  project_name: string;
  client_name: string;
  client_id: number;
  default_rate: number;
  description: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number;
  is_billable: boolean;
  invoice_id: number | null;
  rate_override: number | null;
  flat_amount: number | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: number;
  client_id: number;
  client_name: string;
  client_company?: string;
  client_email?: string;
  client_address1?: string;
  client_address2?: string;
  client_city?: string;
  client_state?: string;
  client_zip?: string;
  invoice_number: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  credits_applied: number;
  total: number;
  notes: string;
  payment_method?: string | null;
  line_items?: LineItem[];
  credits?: Credit[];
  created_at: string;
  updated_at: string;
}

export interface LineItem {
  id: number;
  invoice_id: number;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  time_entry_id: number | null;
}

export interface Credit {
  id: number;
  client_id: number;
  client_name?: string;
  amount: number;
  remaining_amount: number;
  description: string;
  source_invoice_id: number | null;
  applied_invoice_id: number | null;
  created_at: string;
}

export interface UserSettings {
  id: number;
  company: string;
  first_name: string;
  last_name: string;
  email: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  venmo: string;
  cashapp: string;
  paypal: string;
  zelle: string;
  default_due_days: number | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_pass: string | null;
  smtp_secure: boolean | null;
  smtp_from_email: string | null;
  smtp_from_name: string | null;
  default_email_template: string | null;
  show_earnings_on_timer: boolean;
  updated_at: string;
}

export interface User {
  id: number;
  email: string;
  name: string | null;
  role: 'user' | 'admin';
  created_at: string;
}

export interface AuthPayload {
  token: string;
  user: User;
}

export interface Invite {
  id: number;
  token: string;
  email: string | null;
  created_by: number;
  creator_name: string | null;
  used_by: number | null;
  used_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface Dashboard {
  total_clients: number;
  active_projects: number;
  running_timers: TimeEntry[];
  unbilled_hours: number;
  unbilled_amount: number;
  recent_invoices: Invoice[];
  outstanding_amount: number;
}
