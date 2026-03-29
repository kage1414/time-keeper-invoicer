# TimeForge

## Project Overview
Full-stack invoicing and time-tracking application.

## Tech Stack
- **Backend**: Node.js, Express, TypeScript, Apollo Server (GraphQL), Knex (query builder/migrations), PostgreSQL
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, TanStack React Query, React Router, react-hot-toast
- **Package Manager**: Yarn
- **Deployment**: Docker Compose (production + dev with hot reload)

## Project Structure
```
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express server entry point (port 4000)
│   │   ├── db/
│   │   │   ├── index.ts          # Knex database connection
│   │   │   ├── knexfile.ts       # Knex configuration
│   │   │   └── migrations/       # Database migrations
│   │   └── graphql/
│   │       ├── schema.ts         # GraphQL type definitions
│   │       └── resolvers.ts      # GraphQL resolvers (queries + mutations)
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── main.tsx              # React entry point
│   │   ├── App.tsx               # Router + nav layout
│   │   ├── api/client.ts         # GraphQL client (gql helper)
│   │   ├── types/index.ts        # TypeScript interfaces
│   │   └── pages/
│   │       ├── DashboardPage.tsx
│   │       ├── ClientsPage.tsx
│   │       ├── ProjectsPage.tsx
│   │       ├── TimeEntriesPage.tsx
│   │       ├── InvoicesPage.tsx
│   │       ├── InvoiceDetailPage.tsx
│   │       ├── CreateInvoicePage.tsx
│   │       ├── CreditsPage.tsx
│   │       └── SettingsPage.tsx
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
├── docker-compose.yml            # Production deployment
└── docker-compose.dev.yml        # Dev with hot reloading
```

## Database Schema
- **clients**: id, name, email, address1, address2, city, state, phone
- **projects**: id, client_id, name, description, default_rate, is_active
- **time_entries**: id, project_id, description, start_time, end_time, duration_minutes, is_billable, invoice_id, rate_override
- **invoices**: id, client_id, invoice_number, status (draft/sent/paid/overdue/cancelled), issue_date, due_date, subtotal, tax_rate, tax_amount, credits_applied, total, notes
- **invoice_line_items**: id, invoice_id, description, quantity, rate, amount, time_entry_id
- **credits**: id, client_id, amount, remaining_amount, description, source_invoice_id, applied_invoice_id
- **user_settings**: id (single row, id=1), first_name, last_name, email, address1, address2, city, state, phone, venmo, cashapp, paypal, zelle

## Key Commands
```bash
# Backend
cd backend && yarn install
yarn dev           # Dev server with hot reload (tsx watch)
yarn build         # TypeScript compile
yarn migrate       # Run database migrations
yarn seed          # Seed database

# Frontend
cd frontend && yarn install
yarn dev           # Vite dev server
yarn build         # Production build

# Docker
docker-compose up --build              # Production
docker-compose -f docker-compose.dev.yml up --build  # Dev with hot reload
```

## GraphQL API
Single endpoint at `/graphql` (Apollo Server).

### Queries
- `clients`, `client(id)` - Client CRUD
- `projects(client_id, is_active)`, `project(id)` - Project CRUD
- `timeEntries(project_id, client_id, unbilled, billed)`, `timeEntry(id)` - Time entry queries
- `invoices(client_id, status)`, `invoice(id)` - Invoice queries (invoice includes line_items and credits)
- `credits(client_id, available)` - Credit queries
- `userSettings` - Single-row user profile (personal details + payment methods)
- `dashboard` - Summary stats (running timers, unbilled hours/amount, recent invoices, outstanding amount)

### Mutations
- `createClient`, `updateClient`, `deleteClient`
- `createProject`, `updateProject`, `deleteProject`
- `createTimeEntry`, `updateTimeEntry`, `deleteTimeEntry`, `stopTimeEntry`, `restartTimeEntry`, `unbillTimeEntry`, `creditTimeEntry`
- `createInvoice(input)` - Creates invoice; accepts `time_entry_ids` (to bill), `credit_time_entry_ids` (to create credits applied to invoice)
- `updateInvoiceStatus`, `deleteInvoice`
- `createCredit`, `deleteCredit`
- `updateUserSettings(input)` - Update user profile and payment methods

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (default: postgresql://postgres:postgres@db:5432/invoicer)
- `PORT` - Backend port (default: 4000)
