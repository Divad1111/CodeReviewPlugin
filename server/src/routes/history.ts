/**
 * Input history routes.
 */

import { Router, Request, Response } from 'express';
import { InputHistory } from '../models/InputHistory';

const router = Router();

/**
 * GET /api/history?type=repo_url|author
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    const filter: any = { ownerUsername: req.user!.username };
    if (type) { filter.type = type; }

    const items = await InputHistory.find(filter).sort({ usedAt: -1 });
    res.json(items.map(i => i.value));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/history
 * Record a history item (upsert).
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { type, value } = req.body;
    const now = new Date().toISOString();

    await InputHistory.findOneAndUpdate(
      { ownerUsername: req.user!.username, type, value },
      { usedAt: now },
      { upsert: true, new: true }
    );

    res.json({ message: 'History recorded' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/history
 */
router.delete('/', async (req: Request, res: Response) => {
  try {
    const { type, value } = req.query;
    await InputHistory.deleteOne({
      ownerUsername: req.user!.username,
      type: type as string,
      value: value as string,
    });
    res.json({ message: 'History deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
