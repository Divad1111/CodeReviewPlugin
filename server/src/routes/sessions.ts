/**
 * Session CRUD routes.
 */

import { Router, Request, Response } from 'express';
import { Session } from '../models/Session';
import { ReviewLog } from '../models/ReviewLog';
import { Comment } from '../models/Comment';
import { Summary } from '../models/Summary';
import { User } from '../models/User';
import { requireReviewer } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

/**
 * GET /api/sessions
 * Reviewer: all sessions owned by them.
 * Reviewee: sessions that contain comments related to them (via parentReviewer's sessions).
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { username, role, parentReviewer } = req.user!;

    let sessions;
    if (role === 'reviewer') {
      sessions = await Session.find({ ownerUsername: username })
        .sort({ createdAt: -1 });
    } else {
      // Reviewee: get sessions owned by their parent reviewer
      // and filter to only those where the reviewee's username appears as an author
      sessions = await Session.find({
        ownerUsername: parentReviewer,
        authors: username,
      }).sort({ createdAt: -1 });
    }

    res.json(sessions.map(s => ({
      id: s.sessionId,
      name: s.name,
      createdAt: s.createdAt,
      repoUrl: s.repoUrl,
      startDate: s.startDate,
      endDate: s.endDate,
      authors: s.authors,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sessions/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const session = await Session.findOne({ sessionId: req.params.id });
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json({
      id: session.sessionId,
      name: session.name,
      createdAt: session.createdAt,
      repoUrl: session.repoUrl,
      startDate: session.startDate,
      endDate: session.endDate,
      authors: session.authors,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sessions
 * Create a new session (reviewer only).
 */
router.post('/', requireReviewer, async (req: Request, res: Response) => {
  try {
    const { name, repoUrl, startDate, endDate, authors } = req.body;

    const sessionId = crypto.randomUUID();
    const session = new Session({
      sessionId,
      name: name || 'Untitled Session',
      createdAt: new Date().toISOString(),
      repoUrl,
      startDate,
      endDate,
      authors: authors || [],
      ownerUsername: req.user!.username,
    });

    await session.save();

    res.status(201).json({
      id: session.sessionId,
      name: session.name,
      createdAt: session.createdAt,
      repoUrl: session.repoUrl,
      startDate: session.startDate,
      endDate: session.endDate,
      authors: session.authors,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/sessions/:id
 * Update session (rename, update authors).
 */
router.put('/:id', requireReviewer, async (req: Request, res: Response) => {
  try {
    const update: any = {};
    if (req.body.name !== undefined) { update.name = req.body.name; }
    if (req.body.authors !== undefined) { update.authors = req.body.authors; }

    const session = await Session.findOneAndUpdate(
      { sessionId: req.params.id, ownerUsername: req.user!.username },
      update,
      { new: true }
    );

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json({
      id: session.sessionId,
      name: session.name,
      createdAt: session.createdAt,
      repoUrl: session.repoUrl,
      startDate: session.startDate,
      endDate: session.endDate,
      authors: session.authors,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/sessions/:id
 * Delete session and all related data.
 */
router.delete('/:id', requireReviewer, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id;
    const ownerUsername = req.user!.username;

    // Verify ownership
    const session = await Session.findOne({ sessionId, ownerUsername });
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Delete all related data
    const reviewLogs = await ReviewLog.find({ sessionId });
    const reviewLogIds = reviewLogs.map(r => r.reviewLogId);

    await Comment.deleteMany({ reviewLogId: { $in: reviewLogIds } });
    await ReviewLog.deleteMany({ sessionId });
    await Summary.deleteMany({ sessionId });
    await Session.deleteOne({ sessionId });

    res.json({ message: 'Session deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
