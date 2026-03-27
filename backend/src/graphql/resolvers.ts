import db from '../db';

function toISO(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

export const resolvers = {
  TimeEntry: {
    start_time: (e: any) => toISO(e.start_time),
    end_time: (e: any) => toISO(e.end_time),
    created_at: (e: any) => toISO(e.created_at),
    updated_at: (e: any) => toISO(e.updated_at),
  },
  Invoice: {
    issue_date: (e: any) => toISO(e.issue_date),
    due_date: (e: any) => toISO(e.due_date),
    created_at: (e: any) => toISO(e.created_at),
    updated_at: (e: any) => toISO(e.updated_at),
  },
  Client: {
    created_at: (e: any) => toISO(e.created_at),
    updated_at: (e: any) => toISO(e.updated_at),
  },
  Project: {
    created_at: (e: any) => toISO(e.created_at),
    updated_at: (e: any) => toISO(e.updated_at),
  },
  Credit: {
    created_at: (e: any) => toISO(e.created_at),
  },
  Query: {
    clients: () => db('clients').orderBy('name'),

    client: (_: any, { id }: { id: number }) =>
      db('clients').where('id', id).first(),

    projects: (_: any, { client_id, is_active }: { client_id?: number; is_active?: boolean }) => {
      let query = db('projects')
        .join('clients', 'projects.client_id', 'clients.id')
        .select('projects.*', 'clients.name as client_name');
      if (client_id) query = query.where('projects.client_id', client_id);
      if (is_active !== undefined) query = query.where('projects.is_active', is_active);
      return query.orderBy('projects.name');
    },

    project: (_: any, { id }: { id: number }) =>
      db('projects')
        .join('clients', 'projects.client_id', 'clients.id')
        .select('projects.*', 'clients.name as client_name')
        .where('projects.id', id)
        .first(),

    timeEntries: (_: any, { project_id, client_id, unbilled, billed }: any) => {
      let query = db('time_entries')
        .join('projects', 'time_entries.project_id', 'projects.id')
        .join('clients', 'projects.client_id', 'clients.id')
        .select(
          'time_entries.*',
          'projects.name as project_name',
          'projects.default_rate',
          'clients.name as client_name',
          'clients.id as client_id'
        );
      if (project_id) query = query.where('time_entries.project_id', project_id);
      if (unbilled) query = query.whereNull('time_entries.invoice_id').where('time_entries.is_billable', true);
      if (billed) query = query.whereNotNull('time_entries.invoice_id');
      if (client_id) query = query.where('clients.id', client_id);
      return query.orderBy('time_entries.start_time', 'desc');
    },

    timeEntry: (_: any, { id }: { id: number }) =>
      db('time_entries')
        .join('projects', 'time_entries.project_id', 'projects.id')
        .select('time_entries.*', 'projects.name as project_name', 'projects.default_rate')
        .where('time_entries.id', id)
        .first(),

    invoices: (_: any, { client_id, status }: { client_id?: number; status?: string }) => {
      let query = db('invoices')
        .join('clients', 'invoices.client_id', 'clients.id')
        .select('invoices.*', 'clients.name as client_name');
      if (client_id) query = query.where('invoices.client_id', client_id);
      if (status) query = query.where('invoices.status', status);
      return query.orderBy('invoices.created_at', 'desc');
    },

    invoice: async (_: any, { id }: { id: number }) => {
      const invoice = await db('invoices')
        .join('clients', 'invoices.client_id', 'clients.id')
        .select('invoices.*', 'clients.name as client_name', 'clients.email as client_email', 'clients.address as client_address')
        .where('invoices.id', id)
        .first();
      if (!invoice) return null;
      const line_items = await db('invoice_line_items').where('invoice_id', id).orderBy('id');
      const credits = await db('credits')
        .join('clients', 'credits.client_id', 'clients.id')
        .select('credits.*', 'clients.name as client_name')
        .where('applied_invoice_id', id);
      return { ...invoice, line_items, credits };
    },

    credits: (_: any, { client_id, available }: { client_id?: number; available?: boolean }) => {
      let query = db('credits')
        .join('clients', 'credits.client_id', 'clients.id')
        .select('credits.*', 'clients.name as client_name');
      if (client_id) query = query.where('credits.client_id', client_id);
      if (available) query = query.where('credits.remaining_amount', '>', 0);
      return query.orderBy('credits.created_at', 'desc');
    },

    dashboard: async () => {
      const [totalClients] = await db('clients').count('id as count');
      const [totalProjects] = await db('projects').where('is_active', true).count('id as count');
      const runningTimers = await db('time_entries')
        .whereNull('end_time')
        .join('projects', 'time_entries.project_id', 'projects.id')
        .select('time_entries.*', 'projects.name as project_name');
      const unbilledEntries = await db('time_entries')
        .whereNull('invoice_id')
        .where('is_billable', true)
        .whereNotNull('end_time')
        .join('projects', 'time_entries.project_id', 'projects.id')
        .select(
          db.raw('SUM(time_entries.duration_minutes) as total_minutes'),
          db.raw('SUM(time_entries.duration_minutes / 60.0 * COALESCE(time_entries.rate_override, projects.default_rate)) as total_amount')
        );
      const recentInvoices = await db('invoices')
        .join('clients', 'invoices.client_id', 'clients.id')
        .select('invoices.*', 'clients.name as client_name')
        .orderBy('invoices.created_at', 'desc')
        .limit(5);
      const outstandingAmount = await db('invoices')
        .whereIn('status', ['sent', 'overdue'])
        .sum('total as total');
      const availableCredits = await db('credits')
        .where('remaining_amount', '>', 0)
        .sum('remaining_amount as total');
      return {
        total_clients: Number(totalClients.count),
        active_projects: Number(totalProjects.count),
        running_timers: runningTimers,
        unbilled_hours: parseFloat(((unbilledEntries[0]?.total_minutes || 0) / 60).toFixed(2)),
        unbilled_amount: parseFloat(parseFloat(unbilledEntries[0]?.total_amount || '0').toFixed(2)),
        recent_invoices: recentInvoices,
        outstanding_amount: parseFloat(outstandingAmount[0]?.total || '0'),
        available_credits: parseFloat(availableCredits[0]?.total || '0'),
      };
    },
  },

  Mutation: {
    createClient: async (_: any, { input }: any) => {
      const [client] = await db('clients').insert(input).returning('*');
      return client;
    },

    updateClient: async (_: any, { id, input }: any) => {
      const [client] = await db('clients')
        .where('id', id)
        .update({ ...input, updated_at: db.fn.now() })
        .returning('*');
      if (!client) throw new Error('Client not found');
      return client;
    },

    deleteClient: async (_: any, { id }: { id: number }) => {
      await db('clients').where('id', id).del();
      return true;
    },

    createProject: async (_: any, { input }: any) => {
      const [project] = await db('projects').insert(input).returning('*');
      return project;
    },

    updateProject: async (_: any, { id, input }: any) => {
      const [project] = await db('projects')
        .where('id', id)
        .update({ ...input, updated_at: db.fn.now() })
        .returning('*');
      if (!project) throw new Error('Project not found');
      return project;
    },

    deleteProject: async (_: any, { id }: { id: number }) => {
      await db('projects').where('id', id).del();
      return true;
    },

    createTimeEntry: async (_: any, { input }: any) => {
      let duration = input.duration_minutes;
      if (!duration && input.start_time && input.end_time) {
        duration = Math.round((new Date(input.end_time).getTime() - new Date(input.start_time).getTime()) / 60000);
      }
      const [entry] = await db('time_entries')
        .insert({
          ...input,
          start_time: input.start_time || new Date(),
          duration_minutes: duration,
          is_billable: input.is_billable ?? true,
        })
        .returning('*');
      return entry;
    },

    updateTimeEntry: async (_: any, { id, input }: any) => {
      let duration = input.duration_minutes;
      if (!duration && input.start_time && input.end_time) {
        duration = Math.round((new Date(input.end_time).getTime() - new Date(input.start_time).getTime()) / 60000);
      }
      const updateData: any = { ...input, updated_at: db.fn.now() };
      if (duration !== undefined) updateData.duration_minutes = duration;
      const [entry] = await db('time_entries')
        .where('id', id)
        .update(updateData)
        .returning('*');
      if (!entry) throw new Error('Time entry not found');
      return entry;
    },

    deleteTimeEntry: async (_: any, { id }: { id: number }) => {
      await db('time_entries').where('id', id).del();
      return true;
    },

    stopTimeEntry: async (_: any, { id }: { id: number }) => {
      const entry = await db('time_entries').where('id', id).first();
      if (!entry) throw new Error('Time entry not found');
      if (entry.end_time) throw new Error('Timer already stopped');
      const end_time = new Date();
      const duration_minutes = Math.round((end_time.getTime() - new Date(entry.start_time).getTime()) / 60000);
      const [updated] = await db('time_entries')
        .where('id', id)
        .update({ end_time, duration_minutes, updated_at: db.fn.now() })
        .returning('*');
      return updated;
    },

    restartTimeEntry: async (_: any, { id }: { id: number }) => {
      const entry = await db('time_entries').where('id', id).first();
      if (!entry) throw new Error('Time entry not found');
      if (!entry.end_time) throw new Error('Timer is already running');
      const runningTimer = await db('time_entries').whereNull('end_time').first();
      if (runningTimer) throw new Error('Another timer is already running. Stop it first.');
      const [updated] = await db('time_entries')
        .where('id', id)
        .update({ end_time: null, duration_minutes: null, updated_at: db.fn.now() })
        .returning('*');
      return updated;
    },

    unbillTimeEntry: async (_: any, { id }: { id: number }) => {
      const entry = await db('time_entries').where('id', id).first();
      if (!entry) throw new Error('Time entry not found');
      if (!entry.invoice_id) throw new Error('Time entry is not billed');
      const invoice = await db('invoices').where('id', entry.invoice_id).first();
      if (invoice && invoice.status !== 'draft' && invoice.status !== 'cancelled') {
        throw new Error('Cannot unbill: invoice must be draft or cancelled');
      }
      await db('invoice_line_items')
        .where({ invoice_id: entry.invoice_id, time_entry_id: entry.id })
        .del();
      const [updated] = await db('time_entries')
        .where('id', id)
        .update({ invoice_id: null, updated_at: db.fn.now() })
        .returning('*');
      if (invoice) {
        const lineItems = await db('invoice_line_items').where('invoice_id', invoice.id);
        const subtotal = lineItems.reduce((sum: number, li: any) => sum + Number(li.amount), 0);
        const tax_amount = subtotal * (Number(invoice.tax_rate) / 100);
        const total = Math.max(0, subtotal + tax_amount - Number(invoice.credits_applied));
        await db('invoices').where('id', invoice.id).update({
          subtotal: parseFloat(subtotal.toFixed(2)),
          tax_amount: parseFloat(tax_amount.toFixed(2)),
          total: parseFloat(total.toFixed(2)),
          updated_at: db.fn.now(),
        });
      }
      return updated;
    },

    creditTimeEntry: async (_: any, { id }: { id: number }) => {
      const entry = await db('time_entries')
        .join('projects', 'time_entries.project_id', 'projects.id')
        .join('clients', 'projects.client_id', 'clients.id')
        .select('time_entries.*', 'projects.default_rate', 'projects.name as project_name', 'clients.id as client_id')
        .where('time_entries.id', id)
        .first();
      if (!entry) throw new Error('Time entry not found');
      if (!entry.invoice_id) throw new Error('Time entry is not billed');
      const rate = entry.rate_override ?? entry.default_rate;
      const hours = (entry.duration_minutes || 0) / 60;
      const amount = parseFloat((hours * Number(rate)).toFixed(2));
      const [credit] = await db('credits')
        .insert({
          client_id: entry.client_id,
          amount,
          remaining_amount: amount,
          description: `Credit for: ${entry.project_name} - ${entry.description || 'Time entry'}`,
          source_invoice_id: entry.invoice_id,
        })
        .returning('*');
      return credit;
    },

    createInvoice: async (_: any, { input }: any) => {
      const { client_id, issue_date, due_date, tax_rate, notes, time_entry_ids, credit_ids, credit_time_entry_ids } = input;

      const last = await db('invoices').orderBy('id', 'desc').first();
      const invoice_number = last
        ? `INV-${String(parseInt(last.invoice_number.replace('INV-', ''), 10) + 1).padStart(4, '0')}`
        : 'INV-0001';

      const [invoice] = await db('invoices')
        .insert({
          client_id,
          invoice_number,
          issue_date: issue_date || new Date(),
          due_date: due_date || new Date(Date.now() + 30 * 86400000),
          tax_rate: tax_rate || 0,
          notes,
        })
        .returning('*');

      let subtotal = 0;

      if (time_entry_ids?.length) {
        const entries = await db('time_entries')
          .join('projects', 'time_entries.project_id', 'projects.id')
          .select('time_entries.*', 'projects.default_rate', 'projects.name as project_name')
          .whereIn('time_entries.id', time_entry_ids);
        for (const entry of entries) {
          const rate = entry.rate_override ?? entry.default_rate;
          const hours = (entry.duration_minutes || 0) / 60;
          const amount = hours * rate;
          await db('invoice_line_items').insert({
            invoice_id: invoice.id,
            description: `${entry.project_name}: ${entry.description || 'Time entry'}`,
            quantity: parseFloat(hours.toFixed(2)),
            rate,
            amount: parseFloat(amount.toFixed(2)),
            time_entry_id: entry.id,
          });
          await db('time_entries').where('id', entry.id).update({ invoice_id: invoice.id });
          subtotal += amount;
        }
      }

      let credits_applied = 0;

      if (credit_time_entry_ids?.length) {
        const creditEntries = await db('time_entries')
          .join('projects', 'time_entries.project_id', 'projects.id')
          .select('time_entries.*', 'projects.default_rate', 'projects.name as project_name')
          .whereIn('time_entries.id', credit_time_entry_ids);
        for (const entry of creditEntries) {
          const rate = entry.rate_override ?? entry.default_rate;
          const hours = (entry.duration_minutes || 0) / 60;
          const amount = parseFloat((hours * rate).toFixed(2));
          await db('credits').insert({
            client_id,
            amount,
            remaining_amount: 0,
            description: `Credit for: ${entry.project_name} - ${entry.description || 'Time entry'}`,
            source_invoice_id: entry.invoice_id,
            applied_invoice_id: invoice.id,
          });
          credits_applied += amount;
        }
      }

      if (credit_ids?.length) {
        const creditsToApply = await db('credits').whereIn('id', credit_ids).where('remaining_amount', '>', 0).orderBy('created_at');
        const totalBeforeCredits = subtotal + subtotal * ((tax_rate || 0) / 100);
        for (const credit of creditsToApply) {
          if (credits_applied >= totalBeforeCredits) break;
          const toApply = Math.min(Number(credit.remaining_amount), totalBeforeCredits - credits_applied);
          await db('credits').where('id', credit.id).update({
            remaining_amount: Number(credit.remaining_amount) - toApply,
            applied_invoice_id: invoice.id,
          });
          credits_applied += toApply;
        }
      }

      const tax_amount = subtotal * ((tax_rate || 0) / 100);
      const total = subtotal + tax_amount - credits_applied;

      const [updated] = await db('invoices')
        .where('id', invoice.id)
        .update({
          subtotal: parseFloat(subtotal.toFixed(2)),
          tax_amount: parseFloat(tax_amount.toFixed(2)),
          credits_applied: parseFloat(credits_applied.toFixed(2)),
          total: parseFloat(total.toFixed(2)),
        })
        .returning('*');
      return updated;
    },

    updateInvoiceStatus: async (_: any, { id, status }: { id: number; status: string }) => {
      const [invoice] = await db('invoices')
        .where('id', id)
        .update({ status, updated_at: db.fn.now() })
        .returning('*');
      if (!invoice) throw new Error('Invoice not found');
      return invoice;
    },

    deleteInvoice: async (_: any, { id }: { id: number }) => {
      await db('time_entries').where('invoice_id', id).update({ invoice_id: null });
      const credits = await db('credits').where('applied_invoice_id', id);
      for (const credit of credits) {
        await db('credits').where('id', credit.id).update({
          remaining_amount: credit.amount,
          applied_invoice_id: null,
        });
      }
      await db('invoice_line_items').where('invoice_id', id).del();
      await db('invoices').where('id', id).del();
      return true;
    },

    createCredit: async (_: any, { input }: any) => {
      const [credit] = await db('credits')
        .insert({ ...input, remaining_amount: input.amount })
        .returning('*');
      return credit;
    },

    deleteCredit: async (_: any, { id }: { id: number }) => {
      await db('credits').where('id', id).del();
      return true;
    },
  },
};
