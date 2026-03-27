export const typeDefs = `#graphql
  type Client {
    id: Int!
    name: String!
    email: String
    address: String
    phone: String
    created_at: String!
    updated_at: String!
  }

  type Project {
    id: Int!
    client_id: Int!
    client_name: String
    name: String!
    description: String
    default_rate: Float!
    is_active: Boolean!
    created_at: String!
    updated_at: String!
  }

  type TimeEntry {
    id: Int!
    project_id: Int!
    project_name: String
    client_name: String
    client_id: Int
    default_rate: Float
    description: String
    start_time: String!
    end_time: String
    duration_minutes: Float
    is_billable: Boolean!
    invoice_id: Int
    rate_override: Float
    created_at: String!
    updated_at: String!
  }

  type LineItem {
    id: Int!
    invoice_id: Int!
    description: String!
    quantity: Float!
    rate: Float!
    amount: Float!
    time_entry_id: Int
  }

  type Credit {
    id: Int!
    client_id: Int!
    client_name: String
    amount: Float!
    remaining_amount: Float!
    description: String!
    source_invoice_id: Int
    applied_invoice_id: Int
    created_at: String!
  }

  type Invoice {
    id: Int!
    client_id: Int!
    client_name: String
    client_email: String
    client_address: String
    invoice_number: String!
    status: String!
    issue_date: String!
    due_date: String!
    subtotal: Float!
    tax_rate: Float!
    tax_amount: Float!
    credits_applied: Float!
    total: Float!
    notes: String
    line_items: [LineItem!]
    credits: [Credit!]
    created_at: String!
    updated_at: String!
  }

  type Dashboard {
    total_clients: Int!
    active_projects: Int!
    running_timers: [TimeEntry!]!
    unbilled_hours: Float!
    unbilled_amount: Float!
    recent_invoices: [Invoice!]!
    outstanding_amount: Float!
    available_credits: Float!
  }

  type Query {
    clients: [Client!]!
    client(id: Int!): Client
    projects(client_id: Int, is_active: Boolean): [Project!]!
    project(id: Int!): Project
    timeEntries(project_id: Int, client_id: Int, unbilled: Boolean, billed: Boolean): [TimeEntry!]!
    timeEntry(id: Int!): TimeEntry
    invoices(client_id: Int, status: String): [Invoice!]!
    invoice(id: Int!): Invoice
    credits(client_id: Int, available: Boolean): [Credit!]!
    dashboard: Dashboard!
  }

  input CreateClientInput {
    name: String!
    email: String
    address: String
    phone: String
  }

  input UpdateClientInput {
    name: String
    email: String
    address: String
    phone: String
  }

  input CreateProjectInput {
    client_id: Int!
    name: String!
    description: String
    default_rate: Float!
  }

  input UpdateProjectInput {
    client_id: Int
    name: String
    description: String
    default_rate: Float
    is_active: Boolean
  }

  input CreateTimeEntryInput {
    project_id: Int!
    description: String
    start_time: String
    end_time: String
    duration_minutes: Float
    is_billable: Boolean
    rate_override: Float
  }

  input UpdateTimeEntryInput {
    project_id: Int
    description: String
    start_time: String
    end_time: String
    duration_minutes: Float
    is_billable: Boolean
    rate_override: Float
  }

  input CreateInvoiceInput {
    client_id: Int!
    issue_date: String
    due_date: String
    tax_rate: Float
    notes: String
    time_entry_ids: [Int!]
    credit_ids: [Int!]
    credit_time_entry_ids: [Int!]
  }

  input CreateCreditInput {
    client_id: Int!
    amount: Float!
    description: String!
    source_invoice_id: Int
  }

  type Mutation {
    createClient(input: CreateClientInput!): Client!
    updateClient(id: Int!, input: UpdateClientInput!): Client!
    deleteClient(id: Int!): Boolean!
    createProject(input: CreateProjectInput!): Project!
    updateProject(id: Int!, input: UpdateProjectInput!): Project!
    deleteProject(id: Int!): Boolean!
    createTimeEntry(input: CreateTimeEntryInput!): TimeEntry!
    updateTimeEntry(id: Int!, input: UpdateTimeEntryInput!): TimeEntry!
    deleteTimeEntry(id: Int!): Boolean!
    stopTimeEntry(id: Int!): TimeEntry!
    restartTimeEntry(id: Int!): TimeEntry!
    unbillTimeEntry(id: Int!): TimeEntry!
    creditTimeEntry(id: Int!): Credit!
    createInvoice(input: CreateInvoiceInput!): Invoice!
    updateInvoiceStatus(id: Int!, status: String!): Invoice!
    deleteInvoice(id: Int!): Boolean!
    createCredit(input: CreateCreditInput!): Credit!
    deleteCredit(id: Int!): Boolean!
  }
`;
