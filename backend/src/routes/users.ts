import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';

const router = Router();

// GET /api/users — list all users
router.get('/', async (_req, res) => {
  const all = await db.select().from(users);
  res.json(all);
});

// GET /api/users/:id — get one user
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// POST /api/users — create a user
router.post('/', async (req, res) => {
  const { name, email } = req.body ?? {};
  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' });
  }
  const [created] = await db.insert(users).values({ name, email }).returning();
  res.status(201).json(created);
});

// DELETE /api/users/:id — delete a user
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const [deleted] = await db.delete(users).where(eq(users.id, id)).returning();
  if (!deleted) return res.status(404).json({ error: 'User not found' });
  res.json(deleted);
});

export default router;
