import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  let query = db('invoices')
    .join('clients', 'invoices.client_id', 'clients.id')
    .select('invoices.*', 'clients.name as client_name');

  if (req.query.client_id) {
    query = query.where('invoices.client_id', req.query.client_id as string);
  }
  if (req.query.status) {
    query = query.where('invoices.status', req.query.status as string);
  }

  const invoices = await query.orderBy('invoices.created_at', 'desc');
  res.json(invoices);
});

router.get('/:id', async (req: Request, res: Response) => {
  const invoice = await db('invoices')
    .join('clients', 'invoices.client_id', 'clients.id')
    .select('invoices.*', 'clients.name as client_name', 'clients.email as client_email', 'clients.address as client_address')
    .where('invoices.id', req.params.id)
    .first();
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  const line_items = await db('invoice_line_items')
    .where('invoice_id', req.params.id)
    .orderBy('id');

  const credits = await db('credits')
    .where('applied_invoice_id', req.params.id);

  res.json({ ...invoice, line_items, credits });
});

// Generate next invoice number
async function getNextInvoiceNumber(): Promise<string> {
  const last = await db('invoices').orderBy('id', 'desc').first();
  if (!last) return 'INV-0001';
  const num = parseInt(last.invoice_number.replace('INV-', ''), 10) + 1;
  return `INV-${String(num).padStart(4, '0')}`;
}

router.post('/', async (req: Request, res: Response) => {
  const { client_id, issue_date, due_date, tax_rate, notes, line_items, time_entry_ids, credit_ids, apply_credits } = req.body;

  const invoice_number = await getNextInvoiceNumber();

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

  // Add manual line items
  if (line_items?.length) {
    for (const item of line_items) {
      const amount = item.quantity * item.rate;
      await db('invoice_line_items').insert({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        amount,
      });
      subtotal += amount;
    }
  }

  // Add time entries as line items
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

  // Apply credits
  let credits_applied = 0;
  const creditsToApply = credit_ids?.length
    ? await db('credits').whereIn('id', credit_ids).where('remaining_amount', '>', 0).orderBy('created_at')
    : apply_credits
      ? await db('credits').where('client_id', client_id).where('remaining_amount', '>', 0).orderBy('created_at')
      : [];

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

  res.status(201).json(updated);
});

router.put('/:id/status', async (req: Request, res: Response) => {
  const { status } = req.body;
  const [invoice] = await db('invoices')
    .where('id', req.params.id)
    .update({ status, updated_at: db.fn.now() })
    .returning('*');
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  res.json(invoice);
});

router.delete('/:id', async (req: Request, res: Response) => {
  // Un-link time entries
  await db('time_entries').where('invoice_id', req.params.id).update({ invoice_id: null });
  // Restore credits
  const credits = await db('credits').where('applied_invoice_id', req.params.id);
  for (const credit of credits) {
    await db('credits').where('id', credit.id).update({
      remaining_amount: credit.amount,
      applied_invoice_id: null,
    });
  }
  await db('invoice_line_items').where('invoice_id', req.params.id).del();
  await db('invoices').where('id', req.params.id).del();
  res.status(204).send();
});

export default router;
