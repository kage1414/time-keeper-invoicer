import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  let query = db('credits')
    .join('clients', 'credits.client_id', 'clients.id')
    .select('credits.*', 'clients.name as client_name');

  if (req.query.client_id) {
    query = query.where('credits.client_id', req.query.client_id as string);
  }
  if (req.query.available === 'true') {
    query = query.where('credits.remaining_amount', '>', 0);
  }

  const credits = await query.orderBy('credits.created_at', 'desc');
  res.json(credits);
});

router.post('/', async (req: Request, res: Response) => {
  const { client_id, amount, description, source_invoice_id } = req.body;
  const [credit] = await db('credits')
    .insert({ client_id, amount, remaining_amount: amount, description, source_invoice_id })
    .returning('*');
  res.status(201).json(credit);
});

router.delete('/:id', async (req: Request, res: Response) => {
  await db('credits').where('id', req.params.id).del();
  res.status(204).send();
});

export default router;
