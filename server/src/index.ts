/**
 * Server entry point - Express + MongoDB.
 */

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { config } from './config';
import { authMiddleware } from './middleware/auth';

// Routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import sessionRoutes from './routes/sessions';
import reviewLogRoutes from './routes/reviewLogs';
import commentRoutes from './routes/comments';
import summaryRoutes from './routes/summaries';
import historyRoutes from './routes/history';
import settingsRoutes from './routes/settings';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check (public)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public routes (no auth required)
app.use('/api/auth', authRoutes);

// Protected routes (auth required)
app.use('/api/sessions', authMiddleware, sessionRoutes);
app.use('/api/review-logs', authMiddleware, reviewLogRoutes);
app.use('/api/comments', authMiddleware, commentRoutes);
app.use('/api/summaries', authMiddleware, summaryRoutes);
app.use('/api/history', authMiddleware, historyRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);
app.use('/api/users', authMiddleware, userRoutes);

// Error handling
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Connect to MongoDB and start server
async function start() {
  try {
    console.log('[Server] Connecting to MongoDB...');
    await mongoose.connect(config.mongodbUri);
    console.log('[Server] MongoDB connected');

    app.listen(config.port, () => {
      console.log(`[Server] Code Review Server running on port ${config.port}`);
      console.log(`[Server] Health check: http://localhost:${config.port}/api/health`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

start();
