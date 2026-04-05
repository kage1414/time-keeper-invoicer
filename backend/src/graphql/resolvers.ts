import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { GraphQLError } from 'graphql';
import db from '../db';
import { JWT_SECRET, Context } from '../index';

function toISO(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function requireAuth(context: Context) {
  if (!context.user) throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
  return context.user;
}

function requireAdmin(context: Context) {
  const user = requireAuth(context);
  if (user.role !== 'admin') throw new GraphQLError('Not authorized', { extensions: { code: 'FORBIDDEN' } });
  return user;
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
  User: {
    created_at: (e: any) => toISO(e.created_at),
  },
  Invite: {
    created_at: (e: any) => toISO(e.created_at),
    expires_at: (e: any) => toISO(e.expires_at),
    used_at: (e: any) => toISO(e.used_at),
  },
  UserSettings: {
    updated_at: (e: any) => toISO(e.updated_at),
  },
  Query: {
    me: (_: any, __: any, context: Context) => {
      if (!context.user) return null;
      return db('users').where('id', context.user.id).select('id', 'email', 'name', 'role', 'created_at').first();
    },

    clients: (_: any, __: any, context: Context) => {
      const user = requireAuth(context);
      return db('clients').where('user_id', user.id).orderBy('name');
    },

    client: (_: any, { id }: { id: number }, context: Context) => {
      const user = requireAuth(context);
      return db('clients').where({ id, user_id: user.id }).first();
    },

    projects: (_: any, { client_id, is_active }: { client_id?: number; is_active?: boolean }, context: Context) => {
      const user = requireAuth(context);
      let query = db('projects')
        .join('clients', 'projects.client_id', 'clients.id')
        .select('projects.*', db.raw('COALESCE(clients.name, clients.company) as client_name'))
        .where('projects.user_id', user.id);
      if (client_id) query = query.where('projects.client_id', client_id);
      if (is_active !== undefined) query = query.where('projects.is_active', is_active);
      return query.orderBy('projects.name');
    },

    project: (_: any, { id }: { id: number }, context: Context) => {
      const user = requireAuth(context);
      return db('projects')
        .join('clients', 'projects.client_id', 'clients.id')
        .select('projects.*', db.raw('COALESCE(clients.name, clients.company) as client_name'))
        .where('projects.id', id)
        .where('projects.user_id', user.id)
        .first();
    },

    timeEntries: (_: any, { project_id, client_id, unbilled, billed }: any, context: Context) => {
      const user = requireAuth(context);
      let query = db('time_entries')
        .join('projects', 'time_entries.project_id', 'projects.id')
        .join('clients', 'projects.client_id', 'clients.id')
        .select(
          'time_entries.*',
          'projects.name as project_name',
          'projects.default_rate',
          db.raw('COALESCE(clients.name, clients.company) as client_name'),
          'clients.id as client_id'
        )
        .where('time_entries.user_id', user.id);
      if (project_id) query = query.where('time_entries.project_id', project_id);
      if (unbilled) query = query.whereNull('time_entries.invoice_id').where('time_entries.is_billable', true);
      if (billed) query = query.whereNotNull('time_entries.invoice_id');
      if (client_id) query = query.where('clients.id', client_id);
      return query.orderBy('time_entries.start_time', 'desc');
    },

    timeEntry: (_: any, { id }: { id: number }, context: Context) => {
      const user = requireAuth(context);
      return db('time_entries')
        .join('projects', 'time_entries.project_id', 'projects.id')
        .select('time_entries.*', 'projects.name as project_name', 'projects.default_rate')
        .where('time_entries.id', id)
        .where('time_entries.user_id', user.id)
        .first();
    },

    invoices: (_: any, { client_id, status }: { client_id?: number; status?: string }, context: Context) => {
      const user = requireAuth(context);
      let query = db('invoices')
        .join('clients', 'invoices.client_id', 'clients.id')
        .select('invoices.*', db.raw('COALESCE(clients.name, clients.company) as client_name'))
        .where('invoices.user_id', user.id);
      if (client_id) query = query.where('invoices.client_id', client_id);
      if (status) query = query.where('invoices.status', status);
      return query.orderBy('invoices.created_at', 'desc');
    },

    invoice: async (_: any, { id }: { id: number }, context: Context) => {
      const user = requireAuth(context);
      const invoice = await db('invoices')
        .join('clients', 'invoices.client_id', 'clients.id')
        .select('invoices.*', db.raw('COALESCE(clients.name, clients.company) as client_name'), 'clients.company as client_company', 'clients.email as client_email', 'clients.address1 as client_address1', 'clients.address2 as client_address2', 'clients.city as client_city', 'clients.state as client_state', 'clients.zip as client_zip')
        .where('invoices.id', id)
        .where('invoices.user_id', user.id)
        .first();
      if (!invoice) return null;
      const line_items = await db('invoice_line_items').where('invoice_id', id).orderBy('id');
      const credits = await db('credits')
        .join('clients', 'credits.client_id', 'clients.id')
        .select('credits.*', db.raw('COALESCE(clients.name, clients.company) as client_name'))
        .where('applied_invoice_id', id);
      return { ...invoice, line_items, credits };
    },

    credits: (_: any, { client_id, available }: { client_id?: number; available?: boolean }, context: Context) => {
      const user = requireAuth(context);
      let query = db('credits')
        .join('clients', 'credits.client_id', 'clients.id')
        .select('credits.*', db.raw('COALESCE(clients.name, clients.company) as client_name'))
        .where('credits.user_id', user.id);
      if (client_id) query = query.where('credits.client_id', client_id);
      if (available) query = query.where('credits.remaining_amount', '>', 0);
      return query.orderBy('credits.created_at', 'desc');
    },

    users: (_: any, __: any, context: Context) => {
      requireAdmin(context);
      return db('users').select('id', 'email', 'name', 'role', 'created_at').orderBy('created_at');
    },

    userSettings: async (_: any, __: any, context: Context) => {
      const user = requireAuth(context);
      let settings = await db('user_settings').where('user_id', user.id).first();
      if (!settings) {
        const [created] = await db('user_settings').insert({ user_id: user.id }).returning('*');
        settings = created;
      }
      return settings;
    },

    dashboard: async (_: any, __: any, context: Context) => {
      const user = requireAuth(context);
      const [totalClients] = await db('clients').where('user_id', user.id).count('id as count');
      const [totalProjects] = await db('projects').where('user_id', user.id).where('is_active', true).count('id as count');
      const runningTimers = await db('time_entries')
        .where('time_entries.user_id', user.id)
        .whereNull('end_time')
        .join('projects', 'time_entries.project_id', 'projects.id')
        .select('time_entries.*', 'projects.name as project_name');
      const unbilledEntries = await db('time_entries')
        .where('time_entries.user_id', user.id)
        .whereNull('invoice_id')
        .where('is_billable', true)
        .whereNotNull('end_time')
        .join('projects', 'time_entries.project_id', 'projects.id')
        .select(
          db.raw('SUM(time_entries.duration_minutes) as total_minutes'),
          db.raw('SUM(time_entries.duration_minutes / 60.0 * COALESCE(time_entries.rate_override, projects.default_rate)) as total_amount')
        );
      const recentInvoices = await db('invoices')
        .where('invoices.user_id', user.id)
        .join('clients', 'invoices.client_id', 'clients.id')
        .select('invoices.*', db.raw('COALESCE(clients.name, clients.company) as client_name'))
        .orderBy('invoices.created_at', 'desc')
        .limit(5);
      const outstandingAmount = await db('invoices')
        .where('user_id', user.id)
        .whereIn('status', ['sent', 'overdue'])
        .sum('total as total');
      return {
        total_clients: Number(totalClients.count),
        active_projects: Number(totalProjects.count),
        running_timers: runningTimers,
        unbilled_hours: parseFloat(((unbilledEntries[0]?.total_minutes || 0) / 60).toFixed(2)),
        unbilled_amount: parseFloat(parseFloat(unbilledEntries[0]?.total_amount || '0').toFixed(2)),
        recent_invoices: recentInvoices,
        outstanding_amount: parseFloat(outstandingAmount[0]?.total || '0'),
      };
    },

    invites: async (_: any, __: any, context: Context) => {
      requireAdmin(context);
      return db('invites')
        .leftJoin('users', 'invites.created_by', 'users.id')
        .select('invites.*', 'users.name as creator_name')
        .orderBy('invites.created_at', 'desc');
    },
  },

  Mutation: {
    login: async (_: any, { input }: { input: { email: string; password: string } }) => {
      const user = await db('users').where('email', input.email).first();
      if (!user || !(await bcrypt.compare(input.password, user.password_hash))) {
        throw new GraphQLError('Invalid email or password');
      }
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
      return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role, created_at: user.created_at } };
    },

    signup: async (_: any, { input }: { input: { email: string; password: string; name?: string; invite_token: string } }) => {
      const invite = await db('invites').where('token', input.invite_token).first();
      if (!invite) throw new GraphQLError('Invalid invite token');
      if (invite.used_by) throw new GraphQLError('Invite token has already been used');
      if (new Date(invite.expires_at) < new Date()) throw new GraphQLError('Invite token has expired');
      if (invite.email && invite.email.toLowerCase() !== input.email.toLowerCase()) {
        throw new GraphQLError('This invite was sent to a different email address');
      }

      const existing = await db('users').where('email', input.email).first();
      if (existing) throw new GraphQLError('An account with this email already exists');

      if (input.password.length < 8) throw new GraphQLError('Password must be at least 8 characters');

      const password_hash = await bcrypt.hash(input.password, 10);
      const [user] = await db('users')
        .insert({ email: input.email, password_hash, name: input.name || null, role: 'user' })
        .returning('*');

      await db('invites').where('id', invite.id).update({ used_by: user.id, used_at: new Date() });

      // Create user_settings row for new user
      await db('user_settings').insert({ user_id: user.id });

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
      return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role, created_at: user.created_at } };
    },

    createInvite: async (_: any, { input }: { input?: { email?: string; expires_in_days?: number } }, context: Context) => {
      requireAdmin(context);
      const token = crypto.randomUUID();
      const days = input?.expires_in_days || 7;
      const expires_at = new Date(Date.now() + days * 86400000);
      const [invite] = await db('invites')
        .insert({ token, email: input?.email || null, created_by: context.user!.id, expires_at })
        .returning('*');
      return invite;
    },

    deleteInvite: async (_: any, { id }: { id: number }, context: Context) => {
      requireAdmin(context);
      await db('invites').where('id', id).del();
      return true;
    },

    updateUserRole: async (_: any, { id, role }: { id: number; role: string }, context: Context) => {
      requireAdmin(context);
      if (role !== 'user' && role !== 'admin') throw new GraphQLError('Role must be "user" or "admin"');
      if (id === context.user!.id) throw new GraphQLError('Cannot change your own role');
      const [user] = await db('users')
        .where('id', id)
        .update({ role })
        .returning('*');
      if (!user) throw new GraphQLError('User not found');
      return user;
    },

    changePassword: async (_: any, { currentPassword, newPassword }: { currentPassword: string; newPassword: string }, context: Context) => {
      const authUser = requireAuth(context);
      const user = await db('users').where('id', authUser.id).first();
      if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
        throw new GraphQLError('Current password is incorrect');
      }
      if (newPassword.length < 8) throw new GraphQLError('New password must be at least 8 characters');
      const password_hash = await bcrypt.hash(newPassword, 10);
      await db('users').where('id', authUser.id).update({ password_hash });
      return true;
    },

    createClient: async (_: any, { input }: any, context: Context) => {
      const user = requireAuth(context);
      if (!input.name && !input.company) throw new Error('A client must have at least a name or company');
      const [client] = await db('clients').insert({ ...input, user_id: user.id }).returning('*');
      return client;
    },

    updateClient: async (_: any, { id, input }: any, context: Context) => {
      const user = requireAuth(context);
      const [client] = await db('clients')
        .where({ id, user_id: user.id })
        .update({ ...input, updated_at: db.fn.now() })
        .returning('*');
      if (!client) throw new Error('Client not found');
      return client;
    },

    deleteClient: async (_: any, { id }: { id: number }, context: Context) => {
      const user = requireAuth(context);
      await db('clients').where({ id, user_id: user.id }).del();
      return true;
    },

    createProject: async (_: any, { input }: any, context: Context) => {
      const user = requireAuth(context);
      const [project] = await db('projects').insert({ ...input, user_id: user.id }).returning('*');
      return project;
    },

    updateProject: async (_: any, { id, input }: any, context: Context) => {
      const user = requireAuth(context);
      const [project] = await db('projects')
        .where({ id, user_id: user.id })
        .update({ ...input, updated_at: db.fn.now() })
        .returning('*');
      if (!project) throw new Error('Project not found');
      return project;
    },

    deleteProject: async (_: any, { id }: { id: number }, context: Context) => {
      const user = requireAuth(context);
      await db('projects').where({ id, user_id: user.id }).del();
      return true;
    },

    createTimeEntry: async (_: any, { input }: any, context: Context) => {
      const user = requireAuth(context);
      let duration = input.duration_minutes;
      if (!duration && input.start_time && input.end_time) {
        duration = Math.round((new Date(input.end_time).getTime() - new Date(input.start_time).getTime()) / 60000);
      }
      const [entry] = await db('time_entries')
        .insert({
          ...input,
          user_id: user.id,
          start_time: input.start_time || new Date(),
          duration_minutes: duration,
          is_billable: input.is_billable ?? true,
        })
        .returning('*');
      return entry;
    },

    updateTimeEntry: async (_: any, { id, input }: any, context: Context) => {
      const user = requireAuth(context);
      let duration = input.duration_minutes;
      if (!duration && input.start_time && input.end_time) {
        duration = Math.round((new Date(input.end_time).getTime() - new Date(input.start_time).getTime()) / 60000);
      }
      const updateData: any = { ...input, updated_at: db.fn.now() };
      if (duration !== undefined) updateData.duration_minutes = duration;
      const [entry] = await db('time_entries')
        .where({ id, user_id: user.id })
        .update(updateData)
        .returning('*');
      if (!entry) throw new Error('Time entry not found');
      return entry;
    },

    deleteTimeEntry: async (_: any, { id }: { id: number }, context: Context) => {
      const user = requireAuth(context);
      await db('time_entries').where({ id, user_id: user.id }).del();
      return true;
    },

    stopTimeEntry: async (_: any, { id }: { id: number }, context: Context) => {
      const user = requireAuth(context);
      const entry = await db('time_entries').where({ id, user_id: user.id }).first();
      if (!entry) throw new Error('Time entry not found');
      if (entry.end_time) throw new Error('Timer already stopped');
      const end_time = new Date();
      const duration_minutes = Math.round((end_time.getTime() - new Date(entry.start_time).getTime()) / 60000);
      const [updated] = await db('time_entries')
        .where({ id, user_id: user.id })
        .update({ end_time, duration_minutes, updated_at: db.fn.now() })
        .returning('*');
      return updated;
    },

    restartTimeEntry: async (_: any, { id }: { id: number }, context: Context) => {
      const user = requireAuth(context);
      const entry = await db('time_entries').where({ id, user_id: user.id }).first();
      if (!entry) throw new Error('Time entry not found');
      if (!entry.end_time) throw new Error('Timer is already running');
      const runningTimer = await db('time_entries').where('user_id', user.id).whereNull('end_time').first();
      if (runningTimer) throw new Error('Another timer is already running. Stop it first.');
      const [updated] = await db('time_entries')
        .where({ id, user_id: user.id })
        .update({ end_time: null, duration_minutes: null, updated_at: db.fn.now() })
        .returning('*');
      return updated;
    },

    unbillTimeEntry: async (_: any, { id }: { id: number }, context: Context) => {
      const user = requireAuth(context);
      const entry = await db('time_entries').where({ id, user_id: user.id }).first();
      if (!entry) throw new Error('Time entry not found');
      if (!entry.invoice_id) throw new Error('Time entry is not billed');
      const invoice = await db('invoices').where({ id: entry.invoice_id, user_id: user.id }).first();
      if (invoice && invoice.status !== 'draft' && invoice.status !== 'cancelled') {
        throw new Error('Cannot unbill: invoice must be draft or cancelled');
      }
      await db('invoice_line_items')
        .where({ invoice_id: entry.invoice_id, time_entry_id: entry.id })
        .del();
      const [updated] = await db('time_entries')
        .where({ id, user_id: user.id })
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

    creditTimeEntry: async (_: any, { id }: { id: number }, context: Context) => {
      const user = requireAuth(context);
      const entry = await db('time_entries')
        .join('projects', 'time_entries.project_id', 'projects.id')
        .join('clients', 'projects.client_id', 'clients.id')
        .select('time_entries.*', 'projects.default_rate', 'projects.name as project_name', 'clients.id as client_id')
        .where('time_entries.id', id)
        .where('time_entries.user_id', user.id)
        .first();
      if (!entry) throw new Error('Time entry not found');
      const rate = entry.rate_override ?? entry.default_rate;
      const hours = (entry.duration_minutes || 0) / 60;
      const amount = parseFloat((hours * Number(rate)).toFixed(2));
      const [credit] = await db('credits')
        .insert({
          client_id: entry.client_id,
          user_id: user.id,
          amount,
          remaining_amount: amount,
          description: `Credit for: ${entry.project_name} - ${entry.description || 'Time entry'}`,
          ...(entry.invoice_id ? { source_invoice_id: entry.invoice_id } : {}),
        })
        .returning('*');
      return credit;
    },

    createInvoice: async (_: any, { input }: any, context: Context) => {
      const user = requireAuth(context);
      const { client_id, invoice_number: customNumber, issue_date, due_date, tax_rate, notes, time_entry_ids, credit_ids, credit_time_entry_ids } = input;

      let invoice_number: string;
      if (customNumber) {
        const existing = await db('invoices').where({ invoice_number: customNumber, user_id: user.id }).first();
        if (existing) throw new GraphQLError(`Invoice number "${customNumber}" already exists`);
        invoice_number = customNumber;
      } else {
        const last = await db('invoices').where('user_id', user.id).orderBy('id', 'desc').first();
        if (last) {
          const num = parseInt(last.invoice_number, 10);
          invoice_number = String((num || 0) + 1);
        } else {
          invoice_number = '1';
        }
      }

      const [invoice] = await db('invoices')
        .insert({
          client_id,
          user_id: user.id,
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
          .whereIn('time_entries.id', time_entry_ids)
          .where('time_entries.user_id', user.id);
        for (const entry of entries) {
          const rate = entry.rate_override ?? entry.default_rate;
          const hours = (entry.duration_minutes || 0) / 60;
          const amount = hours * rate;
          const entryDate = new Date(entry.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          await db('invoice_line_items').insert({
            invoice_id: invoice.id,
            description: `${entry.project_name} - ${entryDate}${entry.description ? '\n' + entry.description : ''}`,
            quantity: parseFloat(hours.toFixed(2)),
            rate,
            amount: parseFloat(amount.toFixed(2)),
            time_entry_id: entry.id,
          });
          await db('time_entries').where('id', entry.id).update({ invoice_id: invoice.id });
          subtotal += amount;
        }
      }

      if (credit_time_entry_ids?.length) {
        const creditEntries = await db('time_entries')
          .join('projects', 'time_entries.project_id', 'projects.id')
          .select('time_entries.*', 'projects.default_rate', 'projects.name as project_name')
          .whereIn('time_entries.id', credit_time_entry_ids)
          .where('time_entries.user_id', user.id);
        for (const entry of creditEntries) {
          const rate = entry.rate_override ?? entry.default_rate;
          const hours = (entry.duration_minutes || 0) / 60;
          const amount = parseFloat((hours * rate).toFixed(2));
          const entryDate = new Date(entry.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          await db('invoice_line_items').insert({
            invoice_id: invoice.id,
            description: `Credit: ${entry.project_name} - ${entryDate}${entry.description ? '\n' + entry.description : ''}`,
            quantity: parseFloat(hours.toFixed(2)),
            rate: -Number(rate),
            amount: parseFloat((-amount).toFixed(2)),
            time_entry_id: entry.id,
          });
          subtotal -= amount;
        }
      }

      const tax_amount = subtotal * ((tax_rate || 0) / 100);
      const total = subtotal + tax_amount;

      const [updated] = await db('invoices')
        .where('id', invoice.id)
        .update({
          subtotal: parseFloat(subtotal.toFixed(2)),
          tax_amount: parseFloat(tax_amount.toFixed(2)),
          credits_applied: 0,
          total: parseFloat(Math.max(0, total).toFixed(2)),
        })
        .returning('*');
      return updated;
    },

    updateInvoiceStatus: async (_: any, { id, status, payment_method }: { id: number; status: string; payment_method?: string }, context: Context) => {
      const user = requireAuth(context);
      const updateData: Record<string, any> = { status, updated_at: db.fn.now() };
      if (payment_method !== undefined) updateData.payment_method = payment_method;
      const [invoice] = await db('invoices')
        .where({ id, user_id: user.id })
        .update(updateData)
        .returning('*');
      if (!invoice) throw new Error('Invoice not found');
      return invoice;
    },

    deleteInvoice: async (_: any, { id }: { id: number }, context: Context) => {
      const user = requireAuth(context);
      const invoice = await db('invoices').where({ id, user_id: user.id }).first();
      if (!invoice) throw new Error('Invoice not found');
      await db('time_entries').where({ invoice_id: id, user_id: user.id }).update({ invoice_id: null });
      const credits = await db('credits').where({ applied_invoice_id: id, user_id: user.id });
      for (const credit of credits) {
        await db('credits').where('id', credit.id).update({
          remaining_amount: credit.amount,
          applied_invoice_id: null,
        });
      }
      await db('invoice_line_items').where('invoice_id', id).del();
      await db('invoices').where({ id, user_id: user.id }).del();
      return true;
    },

    createCredit: async (_: any, { input }: any, context: Context) => {
      const user = requireAuth(context);
      const [credit] = await db('credits')
        .insert({ ...input, user_id: user.id, remaining_amount: input.amount })
        .returning('*');
      return credit;
    },

    deleteCredit: async (_: any, { id }: { id: number }, context: Context) => {
      const user = requireAuth(context);
      await db('credits').where({ id, user_id: user.id }).del();
      return true;
    },

    updateUserSettings: async (_: any, { input }: any, context: Context) => {
      const user = requireAuth(context);
      const existing = await db('user_settings').where('user_id', user.id).first();
      if (existing) {
        const [settings] = await db('user_settings')
          .where('user_id', user.id)
          .update({ ...input, updated_at: db.fn.now() })
          .returning('*');
        return settings;
      } else {
        const [settings] = await db('user_settings')
          .insert({ ...input, user_id: user.id })
          .returning('*');
        return settings;
      }
    },

    sendInvoice: async (_: any, { id, to, body, pdfBase64 }: { id: number; to: string; body?: string; pdfBase64?: string }, context: Context) => {
      const user = requireAuth(context);
      const settings = await db('user_settings').where('user_id', user.id).first();
      if (!settings?.smtp_host || !settings?.smtp_user || !settings?.smtp_pass) {
        throw new GraphQLError('SMTP settings not configured. Go to Settings to set up email.');
      }

      const invoice = await db('invoices')
        .join('clients', 'invoices.client_id', 'clients.id')
        .select('invoices.*', db.raw('COALESCE(clients.name, clients.company) as client_name'), 'clients.company as client_company')
        .where('invoices.id', id)
        .where('invoices.user_id', user.id)
        .first();
      if (!invoice) throw new GraphQLError('Invoice not found');

      const lineItems = await db('invoice_line_items').where('invoice_id', id).orderBy('id');
      const credits = await db('credits').where('applied_invoice_id', id);

      const fromName = settings.smtp_from_name || settings.first_name
        ? `${settings.first_name || ''} ${settings.last_name || ''}`.trim()
        : 'TimeForge';
      const fromEmail = settings.smtp_from_email || settings.smtp_user;

      const issueDate = new Date(invoice.issue_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const dueDate = invoice.issue_date === invoice.due_date
        ? 'Upon Receipt'
        : new Date(invoice.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

      const lineItemsHtml = lineItems.map((li: any) => {
        const desc = li.description.replace(/\n/g, '<br/>');
        return `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee">${desc}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${Number(li.quantity).toFixed(2)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${Number(li.rate).toFixed(2)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${Number(li.amount).toFixed(2)}</td>
        </tr>`;
      }).join('');

      const creditsTotal = credits.reduce((sum: number, c: any) => sum + Number(c.amount), 0);

      let paymentMethodsHtml = '';
      const methods = [
        { label: 'Venmo', value: settings.venmo },
        { label: 'Cash App', value: settings.cashapp },
        { label: 'PayPal', value: settings.paypal },
        { label: 'Zelle', value: settings.zelle },
      ].filter(m => m.value);
      if (methods.length > 0) {
        paymentMethodsHtml = `
          <div style="margin-top:24px;padding:16px;background:#f9fafb;border-radius:8px">
            <h3 style="margin:0 0 8px;font-size:14px;color:#374151">Payment Methods</h3>
            ${methods.map(m => `<p style="margin:4px 0;font-size:13px;color:#6b7280"><strong>${m.label}:</strong> ${m.value}</p>`).join('')}
          </div>`;
      }

      const bodyHtml = body
        ? `<div style="margin-bottom:24px;font-size:14px;color:#374151;white-space:pre-wrap">${body.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}</div>`
        : '';

      const html = `
        <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;color:#111827">
          ${bodyHtml}
          <h1 style="color:#4f46e5;font-size:24px">Invoice #${invoice.invoice_number}</h1>
          <p style="color:#6b7280">To: <strong>${invoice.client_name}</strong>${invoice.client_company ? ` (${invoice.client_company})` : ''}</p>
          <p style="color:#6b7280">Issue Date: ${issueDate} &nbsp;|&nbsp; Due: ${dueDate}</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <thead>
              <tr style="background:#f3f4f6">
                <th style="padding:8px;text-align:left">Description</th>
                <th style="padding:8px;text-align:right">Hours</th>
                <th style="padding:8px;text-align:right">Rate</th>
                <th style="padding:8px;text-align:right">Amount</th>
              </tr>
            </thead>
            <tbody>${lineItemsHtml}</tbody>
          </table>
          <div style="text-align:right;margin-top:16px">
            <p style="margin:4px 0;font-size:14px;color:#6b7280">Subtotal: $${Number(invoice.subtotal).toFixed(2)}</p>
            ${Number(invoice.tax_amount) > 0 ? `<p style="margin:4px 0;font-size:14px;color:#6b7280">Tax (${Number(invoice.tax_rate)}%): $${Number(invoice.tax_amount).toFixed(2)}</p>` : ''}
            ${creditsTotal > 0 ? `<p style="margin:4px 0;font-size:14px;color:#059669">Credits: -$${creditsTotal.toFixed(2)}</p>` : ''}
            <p style="margin:8px 0 0;font-size:20px;font-weight:bold;color:#111827">Total: $${Number(invoice.total).toFixed(2)}</p>
          </div>
          ${invoice.notes ? `<p style="margin-top:16px;padding:12px;background:#fffbeb;border-radius:8px;font-size:13px;color:#92400e">${invoice.notes}</p>` : ''}
          ${paymentMethodsHtml}
        </div>`;

      const transport = nodemailer.createTransport({
        host: settings.smtp_host,
        port: settings.smtp_port || 587,
        secure: settings.smtp_secure ?? true,
        auth: { user: settings.smtp_user, pass: settings.smtp_pass },
      });

      const mailOptions: any = {
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject: `Invoice #${invoice.invoice_number} from ${fromName}`,
        html,
      };

      if (pdfBase64) {
        mailOptions.attachments = [{
          filename: `Invoice-${invoice.invoice_number}.pdf`,
          content: Buffer.from(pdfBase64, 'base64'),
          contentType: 'application/pdf',
        }];
      }

      await transport.sendMail(mailOptions);

      if (invoice.status === 'draft') {
        await db('invoices').where('id', id).where('user_id', user.id).update({ status: 'sent' });
      }

      return true;
    },

    importTimeEntries: async (_: any, { entries }: { entries: any[] }, context: Context) => {
      const user = requireAuth(context);
      let imported = 0;
      for (const entry of entries) {
        const { project_id, description, start_time, end_time, is_billable, rate_override, invoice_number } = entry;
        const project = await db('projects').where({ id: project_id, user_id: user.id }).first();
        if (!project) throw new GraphQLError(`Project with id ${project_id} not found`);

        const duration_minutes = Math.round((new Date(end_time).getTime() - new Date(start_time).getTime()) / 60000);

        let invoice_id = null;
        if (invoice_number) {
          const invoice = await db('invoices').where({ invoice_number, user_id: user.id }).first();
          if (invoice) {
            invoice_id = invoice.id;
          }
        }

        await db('time_entries').insert({
          project_id,
          user_id: user.id,
          description: description || null,
          start_time,
          end_time,
          duration_minutes,
          is_billable: is_billable ?? true,
          rate_override: rate_override ?? null,
          invoice_id,
        });
        imported++;
      }
      return imported;
    },

    testSmtp: async (_: any, { host, port, user: smtpUser, pass, secure }: { host: string; port: number; user: string; pass: string; secure: boolean }, context: Context) => {
      requireAuth(context);
      const transport = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user: smtpUser, pass },
      });
      await transport.verify();
      return true;
    },
  },
};
