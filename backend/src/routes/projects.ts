import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  let query = db('projects')
    .join('clients', 'projects.client_id', 'clients.id')
    .select('projects.*', 'clients.name as client_name');

  if (req.query.client_id) {
    query = query.where('projects.client_id', req.query.client_id as string);
  }
  if (req.query.is_active !== undefined) {
    query = query.where('projects.is_active', req.query.is_active === 'true');
  }

  const projects = await query.orderBy('projects.name');
  res.json(projects);
});

router.get('/:id', async (req: Request, res: Response) => {
  const project = await db('projects')
    .join('clients', 'projects.client_id', 'clients.id')
    .select('projects.*', 'clients.name as client_name')
    .where('projects.id', req.params.id)
    .first();
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

router.post('/', async (req: Request, res: Response) => {
  const { client_id, name, description, default_rate } = req.body;
  const [project] = await db('projects')
    .insert({ client_id, name, description, default_rate })
    .returning('*');
  res.status(201).json(project);
});

router.put('/:id', async (req: Request, res: Response) => {
  const { client_id, name, description, default_rate, is_active } = req.body;
  const [project] = await db('projects')
    .where('id', req.params.id)
    .update({ client_id, name, description, default_rate, is_active, updated_at: db.fn.now() })
    .returning('*');
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

router.delete('/:id', async (req: Request, res: Response) => {
  await db('projects').where('id', req.params.id).del();
  res.status(204).send();
});

export default router;
