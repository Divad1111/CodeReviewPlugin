/**
 * ReviewLog CRUD routes.
 */

import { Router, Request, Response } from 'express';
import { ReviewLog } from '../models/ReviewLog';
import { Comment } from '../models/Comment';
import { requireReviewer } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

/**
 * GET /api/review-logs?sessionId=xxx
 * Reviewer: all logs for the session.
 * Reviewee: only logs where author matches their username.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { sessionId, author } = req.query;
    const { username, role } = req.user!;

    const filter: any = {};
    if (sessionId) { filter.sessionId = sessionId; }
    if (author) { filter.author = author; }

    if (role === 'reviewee') {
      // Reviewee can only see logs for their own author name
      filter.author = username;
    }

    const logs = await ReviewLog.find(filter).sort({ author: 1, filePath: 1 });

    res.json(logs.map(r => ({
      id: r.reviewLogId,
      sessionId: r.sessionId,
      filePath: r.filePath,
      author: r.author,
      status: r.status,
      reviewedAt: r.reviewedAt,
      baseRevision: r.baseRevision,
      endRevision: r.endRevision,
      aiAudited: r.aiAudited,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/review-logs/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const log = await ReviewLog.findOne({ reviewLogId: req.params.id });
    if (!log) {
      res.status(404).json({ error: 'ReviewLog not found' });
      return;
    }

    res.json({
      id: log.reviewLogId,
      sessionId: log.sessionId,
      filePath: log.filePath,
      author: log.author,
      status: log.status,
      reviewedAt: log.reviewedAt,
      baseRevision: log.baseRevision,
      endRevision: log.endRevision,
      aiAudited: log.aiAudited,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/review-logs
 * Create or update a review log (upsert by sessionId + filePath + author).
 */
router.post('/', requireReviewer, async (req: Request, res: Response) => {
  try {
    const { sessionId, filePath, author, baseRevision, endRevision } = req.body;

    // Check if exists
    let log = await ReviewLog.findOne({ sessionId, filePath, author });

    if (log) {
      // Update revisions if provided
      if (baseRevision !== undefined) { log.baseRevision = baseRevision; }
      if (endRevision !== undefined) { log.endRevision = endRevision; }
      await log.save();
    } else {
      log = new ReviewLog({
        reviewLogId: crypto.randomUUID(),
        sessionId,
        filePath,
        author,
        status: 'pending',
        baseRevision,
        endRevision,
        aiAudited: false,
        ownerUsername: req.user!.username,
      });
      await log.save();
    }

    res.status(201).json({
      id: log.reviewLogId,
      sessionId: log.sessionId,
      filePath: log.filePath,
      author: log.author,
      status: log.status,
      reviewedAt: log.reviewedAt,
      baseRevision: log.baseRevision,
      endRevision: log.endRevision,
      aiAudited: log.aiAudited,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/review-logs/:id
 * Update status or AI audit flag.
 */
router.put('/:id', requireReviewer, async (req: Request, res: Response) => {
  try {
    const update: any = {};
    if (req.body.status !== undefined) {
      update.status = req.body.status;
      update.reviewedAt = req.body.status !== 'pending' ? new Date().toISOString() : null;
    }
    if (req.body.aiAudited !== undefined) {
      update.aiAudited = req.body.aiAudited;
    }

    const log = await ReviewLog.findOneAndUpdate(
      { reviewLogId: req.params.id },
      update,
      { new: true }
    );

    if (!log) {
      res.status(404).json({ error: 'ReviewLog not found' });
      return;
    }

    res.json({
      id: log.reviewLogId,
      sessionId: log.sessionId,
      filePath: log.filePath,
      author: log.author,
      status: log.status,
      reviewedAt: log.reviewedAt,
      baseRevision: log.baseRevision,
      endRevision: log.endRevision,
      aiAudited: log.aiAudited,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/review-logs/:id
 */
router.delete('/:id', requireReviewer, async (req: Request, res: Response) => {
  try {
    const log = await ReviewLog.findOne({ reviewLogId: req.params.id });
    if (!log) {
      res.status(404).json({ error: 'ReviewLog not found' });
      return;
    }

    // Delete associated comments
    await Comment.deleteMany({ reviewLogId: log.reviewLogId });
    await ReviewLog.deleteOne({ reviewLogId: req.params.id });

    res.json({ message: 'ReviewLog deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/review-logs?sessionId=xxx&author=yyy
 * Delete all review logs for a specific author in a session.
 */
router.delete('/', requireReviewer, async (req: Request, res: Response) => {
  try {
    const { sessionId, author } = req.query;
    if (!sessionId || !author) {
      res.status(400).json({ error: 'sessionId and author are required' });
      return;
    }

    const logs = await ReviewLog.find({ sessionId: sessionId as string, author: author as string });
    const logIds = logs.map(l => l.reviewLogId);

    await Comment.deleteMany({ reviewLogId: { $in: logIds } });
    await ReviewLog.deleteMany({ sessionId: sessionId as string, author: author as string });

    res.json({ message: 'ReviewLogs deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
