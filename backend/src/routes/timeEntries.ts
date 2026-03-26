import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
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

  if (req.query.project_id) {
    query = query.where('time_entries.project_id', req.query.project_id as string);
  }
  if (req.query.unbilled === 'true') {
    query = query.whereNull('time_entries.invoice_id').where('time_entries.is_billable', true);
  }
  if (req.query.client_id) {
    query = query.where('clients.id', req.query.client_id as string);
  }

  const entries = await query.orderBy('time_entries.start_time', 'desc');
  res.json(entries);
});

router.get('/:id', async (req: Request, res: Response) => {
  const entry = await db('time_entries')
    .join('projects', 'time_entries.project_id', 'projects.id')
    .select('time_entries.*', 'projects.name as project_name', 'projects.default_rate')
    .where('time_entries.id', req.params.id)
    .first();
  if (!entry) return res.status(404).json({ error: 'Time entry not found' });
  res.json(entry);
});

router.post('/', async (req: Request, res: Response) => {
  const { project_id, description, start_time, end_time, duration_minutes, is_billable, rate_override } = req.body;

  let duration = duration_minutes;
  if (!duration && start_time && end_time) {
    duration = Math.round((new Date(end_time).getTime() - new Date(start_time).getTime()) / 60000);
  }

  const [entry] = await db('time_entries')
    .insert({ project_id, description, start_time: start_time || new Date(), end_time, duration_minutes: duration, is_billable: is_billable ?? true, rate_override })
    .returning('*');
  res.status(201).json(entry);
});

router.put('/:id', async (req: Request, res: Response) => {
  const { project_id, description, start_time, end_time, duration_minutes, is_billable, rate_override } = req.body;

  let duration = duration_minutes;
  if (!duration && start_time && end_time) {
    duration = Math.round((new Date(end_time).getTime() - new Date(start_time).getTime()) / 60000);
  }

  const [entry] = await db('time_entries')
    .where('id', req.params.id)
    .update({
      project_id, description, start_time, end_time,
      duration_minutes: duration, is_billable, rate_override,
      updated_at: db.fn.now(),
    })
    .returning('*');
  if (!entry) return res.status(404).json({ error: 'Time entry not found' });
  res.json(entry);
});

router.delete('/:id', async (req: Request, res: Response) => {
  await db('time_entries').where('id', req.params.id).del();
  res.status(204).send();
});

// Timer: start a new running entry
router.post('/start', async (req: Request, res: Response) => {
  const { project_id, description } = req.body;
  const [entry] = await db('time_entries')
    .insert({ project_id, description, start_time: new Date(), is_billable: true })
    .returning('*');
  res.status(201).json(entry);
});

// Timer: stop a running entry
router.post('/:id/stop', async (req: Request, res: Response) => {
  const entry = await db('time_entries').where('id', req.params.id).first();
  if (!entry) return res.status(404).json({ error: 'Time entry not found' });
  if (entry.end_time) return res.status(400).json({ error: 'Timer already stopped' });

  const end_time = new Date();
  const duration_minutes = Math.round((end_time.getTime() - new Date(entry.start_time).getTime()) / 60000);

  const [updated] = await db('time_entries')
    .where('id', req.params.id)
    .update({ end_time, duration_minutes, updated_at: db.fn.now() })
    .returning('*');
  res.json(updated);
});

export default router;
