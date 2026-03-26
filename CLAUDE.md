# Time Keeper Invoicer

## Project Overview
Full-stack invoicing and time-tracking application.

## Tech Stack
- **Backend**: Node.js, Express, TypeScript, Knex (query builder/migrations), PostgreSQL
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
│   │   ├── middleware/
│   │   │   └── asyncHandler.ts   # Express async error wrapper
│   │   └── routes/
│   │       ├── clients.ts        # CRUD for clients
│   │       ├── projects.ts       # CRUD for projects
│   │       ├── timeEntries.ts    # Time tracking with start/stop
│   │       ├── invoices.ts       # Invoice management with line items
│   │       ├── credits.ts        # Credit management
│   │       └── dashboard.ts      # Dashboard summary stats
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── main.tsx              # React entry point
│   │   ├── App.tsx               # Router + nav layout
│   │   ├── api/client.ts         # Fetch wrapper for API calls
│   │   ├── types/index.ts        # TypeScript interfaces
│   │   └── pages/
│   │       ├── DashboardPage.tsx
│   │       ├── ClientsPage.tsx
│   │       ├── ProjectsPage.tsx
│   │       ├── TimeEntriesPage.tsx
│   │       ├── InvoicesPage.tsx
│   │       ├── InvoiceDetailPage.tsx
│   │       ├── CreateInvoicePage.tsx
│   │       └── CreditsPage.tsx
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
├── docker-compose.yml            # Production deployment
└── docker-compose.dev.yml        # Dev with hot reloading
```

## Database Schema
- **clients**: id, name, email, address, phone
- **projects**: id, client_id, name, description, default_rate, is_active
- **time_entries**: id, project_id, description, start_time, end_time, duration_minutes, is_billable, invoice_id, rate_override
- **invoices**: id, client_id, invoice_number, status (draft/sent/paid/overdue/cancelled), issue_date, due_date, subtotal, tax_rate, tax_amount, credits_applied, total, notes
- **invoice_line_items**: id, invoice_id, description, quantity, rate, amount, time_entry_id
- **credits**: id, client_id, amount, remaining_amount, description, source_invoice_id

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

## API Routes
All routes are prefixed with `/api`:
- `/api/clients` - GET, POST, PUT /:id, DELETE /:id
- `/api/projects` - GET (?client_id=), POST, PUT /:id, DELETE /:id
- `/api/time-entries` - GET (?project_id=&unbilled=true), POST, PUT /:id, DELETE /:id, POST /:id/stop
- `/api/invoices` - GET (?client_id=&status=), POST, GET /:id, PUT /:id/status, DELETE /:id
- `/api/credits` - GET (?client_id=&available=true), POST, DELETE /:id
- `/api/dashboard` - GET (summary stats)

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (default: postgresql://postgres:postgres@db:5432/invoicer)
- `PORT` - Backend port (default: 4000)
