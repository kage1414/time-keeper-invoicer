export const typeDefs = `#graphql
  type Client {
    id: Int!
    name: String
    company: String
    email: String
    address1: String
    address2: String
    city: String
    state: String
    zip: String
    phone: String
    is_active: Boolean!
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
    start_time: String
    end_time: String
    duration_minutes: Float
    is_billable: Boolean!
    invoice_id: Int
    rate_override: Float
    flat_amount: Float
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
    client_company: String
    client_email: String
    client_address1: String
    client_address2: String
    client_city: String
    client_state: String
    client_zip: String
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
    payment_method: String
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
  }

  type UserSettings {
    id: Int!
    company: String
    first_name: String
    last_name: String
    email: String
    address1: String
    address2: String
    city: String
    state: String
    zip: String
    phone: String
    venmo: String
    cashapp: String
    paypal: String
    zelle: String
    default_due_days: Int
    smtp_host: String
    smtp_port: Int
    smtp_user: String
    smtp_pass: String
    smtp_secure: Boolean
    smtp_from_email: String
    smtp_from_name: String
    default_email_template: String
    show_earnings_on_timer: Boolean
    updated_at: String!
  }

  input UpdateUserSettingsInput {
    company: String
    first_name: String
    last_name: String
    email: String
    address1: String
    address2: String
    city: String
    state: String
    zip: String
    phone: String
    venmo: String
    cashapp: String
    paypal: String
    zelle: String
    default_due_days: Int
    smtp_host: String
    smtp_port: Int
    smtp_user: String
    smtp_pass: String
    smtp_secure: Boolean
    smtp_from_email: String
    smtp_from_name: String
    default_email_template: String
    show_earnings_on_timer: Boolean
  }

  type User {
    id: Int!
    email: String!
    name: String
    role: String!
    created_at: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Invite {
    id: Int!
    token: String!
    email: String
    created_by: Int!
    creator_name: String
    used_by: Int
    used_at: String
    expires_at: String!
    created_at: String!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input SignupInput {
    email: String!
    password: String!
    name: String
    invite_token: String!
  }

  input CreateInviteInput {
    email: String
    expires_in_days: Int
  }

  type Query {
    me: User
    clients: [Client!]!
    client(id: Int!): Client
    projects(client_id: Int, is_active: Boolean): [Project!]!
    project(id: Int!): Project
    timeEntries(project_id: Int, client_id: Int, unbilled: Boolean, billed: Boolean): [TimeEntry!]!
    timeEntry(id: Int!): TimeEntry
    invoices(client_id: Int, status: String): [Invoice!]!
    invoice(id: Int!): Invoice
    credits(client_id: Int, available: Boolean): [Credit!]!
    users: [User!]!
    userSettings: UserSettings!
    dashboard: Dashboard!
    invites: [Invite!]!
  }

  input CreateClientInput {
    name: String
    company: String
    email: String
    address1: String
    address2: String
    city: String
    state: String
    zip: String
    phone: String
  }

  input UpdateClientInput {
    name: String
    company: String
    email: String
    address1: String
    address2: String
    city: String
    state: String
    zip: String
    phone: String
    is_active: Boolean
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
    flat_amount: Float
  }

  input UpdateTimeEntryInput {
    project_id: Int
    description: String
    start_time: String
    end_time: String
    duration_minutes: Float
    is_billable: Boolean
    rate_override: Float
    flat_amount: Float
  }

  input ImportTimeEntryInput {
    project_id: Int!
    description: String
    start_time: String!
    end_time: String!
    is_billable: Boolean
    rate_override: Float
    invoice_number: String
  }

  input CreateInvoiceInput {
    client_id: Int!
    invoice_number: String
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
    login(input: LoginInput!): AuthPayload!
    signup(input: SignupInput!): AuthPayload!
    createInvite(input: CreateInviteInput): Invite!
    deleteInvite(id: Int!): Boolean!
    updateUserRole(id: Int!, role: String!): User!
    changePassword(currentPassword: String!, newPassword: String!): Boolean!
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
    updateInvoiceStatus(id: Int!, status: String!, payment_method: String): Invoice!
    deleteInvoice(id: Int!): Boolean!
    createCredit(input: CreateCreditInput!): Credit!
    deleteCredit(id: Int!): Boolean!
    updateUserSettings(input: UpdateUserSettingsInput!): UserSettings!
    sendInvoice(id: Int!, to: String!, body: String, pdfBase64: String): Boolean!
    importTimeEntries(entries: [ImportTimeEntryInput!]!): Int!
    testSmtp(host: String!, port: Int!, user: String!, pass: String!, secure: Boolean!): Boolean!
  }
`;
