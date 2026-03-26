import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
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

  res.json({
    total_clients: Number(totalClients.count),
    active_projects: Number(totalProjects.count),
    running_timers: runningTimers,
    unbilled_hours: parseFloat(((unbilledEntries[0]?.total_minutes || 0) / 60).toFixed(2)),
    unbilled_amount: parseFloat(parseFloat(unbilledEntries[0]?.total_amount || '0').toFixed(2)),
    recent_invoices: recentInvoices,
    outstanding_amount: parseFloat(outstandingAmount[0]?.total || '0'),
    available_credits: parseFloat(availableCredits[0]?.total || '0'),
  });
});

export default router;
