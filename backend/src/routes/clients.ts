import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const clients = await db('clients').orderBy('name');
  res.json(clients);
});

router.get('/:id', async (req: Request, res: Response) => {
  const client = await db('clients').where('id', req.params.id).first();
  if (!client) return res.status(404).json({ error: 'Client not found' });
  res.json(client);
});

router.post('/', async (req: Request, res: Response) => {
  const { name, email, address, phone } = req.body;
  const [client] = await db('clients').insert({ name, email, address, phone }).returning('*');
  res.status(201).json(client);
});

router.put('/:id', async (req: Request, res: Response) => {
  const { name, email, address, phone } = req.body;
  const [client] = await db('clients')
    .where('id', req.params.id)
    .update({ name, email, address, phone, updated_at: db.fn.now() })
    .returning('*');
  if (!client) return res.status(404).json({ error: 'Client not found' });
  res.json(client);
});

router.delete('/:id', async (req: Request, res: Response) => {
  await db('clients').where('id', req.params.id).del();
  res.status(204).send();
});

export default router;
