import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'path';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import db from './db';
import { typeDefs } from './graphql/schema';
import { resolvers } from './graphql/resolvers';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export interface Context {
  user: { id: number; email: string; role: string; name: string | null } | null;
}

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

async function seedAdmin() {
  const existing = await db('users').where('role', 'admin').first();
  if (!existing) {
    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const password_hash = await bcrypt.hash(password, 10);
    const [admin] = await db('users').insert({ email, password_hash, role: 'admin', name: 'Admin' }).returning('id');
    const adminId = typeof admin === 'object' ? admin.id : admin;
    await db('user_settings').insert({ user_id: adminId });
    console.log(`Admin user seeded: ${email}`);
  }
}

const isCompiled = __filename.endsWith('.js');

async function start() {
  try {
    // If running compiled JS, fix any knex_migrations entries that were recorded
    // with a .ts extension (from a dev run) so they resolve to the .js files.
    if (isCompiled) {
      await db.schema.hasTable('knex_migrations').then(async (exists) => {
        if (exists) {
          await db('knex_migrations')
            .whereRaw("name LIKE '%.ts'")
            .update({ name: db.raw("REPLACE(name, '.ts', '.js')") });
        }
      });
    }

    await db.migrate.latest();
    console.log('Migrations complete');

    await seedAdmin();

    const server = new ApolloServer({ typeDefs, resolvers });
    await server.start();

    app.use('/graphql', cors(), express.json({ limit: '50mb' }), expressMiddleware(server, {
      context: async ({ req }): Promise<Context> => {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return { user: null };
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
          const user = await db('users').where('id', decoded.userId).select('id', 'email', 'role', 'name').first();
          return { user: user || null };
        } catch {
          return { user: null };
        }
      },
    }));

    const publicDir = path.join(__dirname, '../public');
    app.use(express.static(publicDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(publicDir, 'index.html'));
    });

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
