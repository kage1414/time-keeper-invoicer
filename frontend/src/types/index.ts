export interface Client {
  id: number;
  name: string;
  email: string;
  address: string;
  phone: string;
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
  start_time: string;
  end_time: string | null;
  duration_minutes: number;
  is_billable: boolean;
  invoice_id: number | null;
  rate_override: number | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: number;
  client_id: number;
  client_name: string;
  client_email?: string;
  client_address?: string;
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

export interface Dashboard {
  total_clients: number;
  active_projects: number;
  running_timers: TimeEntry[];
  unbilled_hours: number;
  unbilled_amount: number;
  recent_invoices: Invoice[];
  outstanding_amount: number;
  available_credits: number;
}
