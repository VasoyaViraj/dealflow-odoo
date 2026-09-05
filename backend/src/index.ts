import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Route imports
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import productsRouter from './routes/products.js';
import customersRouter from './routes/customers.js';
import discountConfigRouter from './routes/discountConfig.js';
import quotationsRouter from './routes/quotations.js';
import approvalsRouter from './routes/approvals.js';
import fulfillmentRouter from './routes/fulfillment.js';

import { requireAuth } from './middleware/auth.js';

const app = express();

app.use(cors());
app.use(express.json());

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: 'phase-3+4+5' });
});

// ─── Auth routes ─────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRouter);

// ─── Shared read routes (require any authenticated user) ──────────────────────
app.use('/api/v1/products', productsRouter);
app.use('/api/v1/customers', customersRouter);
app.use('/api/v1/discount-config', discountConfigRouter);

// ─── Quotation engine (Phase 3) ──────────────────────────────────────────────
// Authorization is enforced per-quotation inside the router, not by role here:
// a sales rep sees only their own quotations, a customer only their own
// submitted ones, while managers and finance have read access to all.
app.use('/api/v1/quotations', quotationsRouter);

// ─── Admin-only CRUD routes ───────────────────────────────────────────────────
app.use('/api/v1/admin', adminRouter);

// ─── Phase 4: Approval engine routes ──────────────────────────────────────────
app.use('/api/v1', approvalsRouter);

// ─── Phase 5: Fulfillment engine routes ──────────────────────────────────────
// Mounted at the version root because its paths straddle two resources:
// /quotations/:id/fulfillment/* and /fulfillment/*. Like the approval router,
// authorization is per-quotation inside the router, not by role here.
app.use('/api/v1', fulfillmentRouter);

// ─── Legacy welcome endpoint ─────────────────────────────────────────────────
app.get('/api/v1/welcome', requireAuth, (req, res) => {
  const formattedRole = req.user!.role
    .split('_')
    .map((word: string) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');

  res.json({
    success: true,
    message: `Welcome ${formattedRole}`,
    role: req.user!.role,
  });
});

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`🚀 DealFlow360 backend running on http://localhost:${port}`);
});
