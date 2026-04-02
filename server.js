import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { mkdirSync, existsSync } from 'fs';

import authRoutes from './routes/auth.js';
import kycRoutes from './routes/kyc.js';

const app = express();
const PORT = process.env.PORT || 5000;

if (!existsSync('uploads')) {
  mkdirSync('uploads');
}

app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many requests. Please try again later.' },
});
app.use('/api/', limiter);

app.use('/api/auth', authRoutes);
app.use('/api/kyc', kycRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
