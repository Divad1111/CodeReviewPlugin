/**
 * Summary CRUD routes.
 */

import { Router, Request, Response } from 'express';
import { Summary } from '../models/Summary';
import { requireReviewer } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

/**
 * GET /api/summaries?sessionId=xxx&author=yyy
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { sessionId, author } = req.query;
    const filter: any = {};
    if (sessionId) { filter.sessionId = sessionId; }
    if (author) { filter.author = author; }

    const { username } = req.user!;
    const currentUsernameLower = username.toLowerCase();

    const summaries = await Summary.find({
      $and: [
        filter,
        {
          $or: [
            { ownerUsername: { $regex: new RegExp(`^${currentUsernameLower}$`, 'i') } },
            { author: { $regex: new RegExp(`^${currentUsernameLower}$`, 'i') } }
          ]
        }
      ]
    });

    if (sessionId && author) {
      // Return single summary or null
      const s = summaries[0];
      if (s) {
        res.json({
          id: s.summaryId,
          sessionId: s.sessionId,
          author: s.author,
          summary: s.summary,
          updatedAt: s.updatedAt,
        });
      } else {
        res.json(null);
      }
    } else {
      res.json(summaries.map(s => ({
        id: s.summaryId,
        sessionId: s.sessionId,
        author: s.author,
        summary: s.summary,
        updatedAt: s.updatedAt,
      })));
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/summaries (upsert)
 */
router.post('/', requireReviewer, async (req: Request, res: Response) => {
  try {
    const { sessionId, author, summary } = req.body;
    const now = new Date().toISOString();

    let existing = await Summary.findOne({ sessionId, author });

    if (existing) {
      existing.summary = summary;
      existing.updatedAt = now;
      await existing.save();
    } else {
      existing = new Summary({
        summaryId: crypto.randomUUID(),
        sessionId,
        author,
        summary,
        updatedAt: now,
        ownerUsername: req.user!.username,
      });
      await existing.save();
    }

    res.json({
      id: existing.summaryId,
      sessionId: existing.sessionId,
      author: existing.author,
      summary: existing.summary,
      updatedAt: existing.updatedAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/summaries?sessionId=xxx&author=yyy
 */
router.delete('/', requireReviewer, async (req: Request, res: Response) => {
  try {
    const { sessionId, author } = req.query;
    await Summary.deleteMany({
      sessionId: sessionId as string,
      author: author as string,
    });
    res.json({ message: 'Summary deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
