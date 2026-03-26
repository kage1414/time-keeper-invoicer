import express from 'express';
import cors from 'cors';
import db from './db';
import clientRoutes from './routes/clients';
import projectRoutes from './routes/projects';
import timeEntryRoutes from './routes/timeEntries';
import invoiceRoutes from './routes/invoices';
import creditRoutes from './routes/credits';
import dashboardRoutes from './routes/dashboard';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/clients', clientRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/time-entries', timeEntryRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

async function start() {
  try {
    await db.migrate.latest();
    console.log('Migrations complete');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
