import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import { requireAuth } from './middleware/auth';

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// API Routes
app.use('/api/v1/auth', authRouter);

// Temporary welcome endpoint for demo purposes
app.get('/api/v1/welcome', requireAuth, (req, res) => {
  const formattedRole = req.user!.role
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');

  res.json({
    success: true,
    message: `Welcome ${formattedRole}`,
    role: req.user!.role,
  });
});

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
