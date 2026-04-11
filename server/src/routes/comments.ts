/**
 * Comment CRUD routes.
 */

import { Router, Request, Response } from 'express';
import { Comment } from '../models/Comment';
import { requireReviewer } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

/**
 * GET /api/comments?reviewLogId=xxx
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { reviewLogId } = req.query;
    const filter: any = {};
    if (reviewLogId) { filter.reviewLogId = reviewLogId; }

    const comments = await Comment.find(filter).sort({ lineNumber: 1 });

    res.json(comments.map(c => ({
      id: c.commentId,
      reviewLogId: c.reviewLogId,
      lineNumber: c.lineNumber,
      codeSnippet: c.codeSnippet,
      commentText: c.commentText,
      revision: c.revision,
      createdAt: c.createdAt,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/comments/count?reviewLogId=xxx
 */
router.get('/count', async (req: Request, res: Response) => {
  try {
    const { reviewLogId } = req.query;
    const count = await Comment.countDocuments({ reviewLogId });
    res.json({ count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/comments
 */
router.post('/', requireReviewer, async (req: Request, res: Response) => {
  try {
    const { reviewLogId, lineNumber, commentText, codeSnippet, revision } = req.body;

    const comment = new Comment({
      commentId: crypto.randomUUID(),
      reviewLogId,
      lineNumber,
      codeSnippet: codeSnippet || null,
      commentText,
      revision: revision || null,
      createdAt: new Date().toISOString(),
      ownerUsername: req.user!.username,
    });

    await comment.save();

    res.status(201).json({
      id: comment.commentId,
      reviewLogId: comment.reviewLogId,
      lineNumber: comment.lineNumber,
      codeSnippet: comment.codeSnippet,
      commentText: comment.commentText,
      revision: comment.revision,
      createdAt: comment.createdAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/comments/:id
 */
router.put('/:id', requireReviewer, async (req: Request, res: Response) => {
  try {
    const comment = await Comment.findOneAndUpdate(
      { commentId: req.params.id },
      { commentText: req.body.commentText },
      { new: true }
    );

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    res.json({
      id: comment.commentId,
      reviewLogId: comment.reviewLogId,
      lineNumber: comment.lineNumber,
      codeSnippet: comment.codeSnippet,
      commentText: comment.commentText,
      revision: comment.revision,
      createdAt: comment.createdAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/comments/:id
 */
router.delete('/:id', requireReviewer, async (req: Request, res: Response) => {
  try {
    const result = await Comment.deleteOne({ commentId: req.params.id });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }
    res.json({ message: 'Comment deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/comments?reviewLogId=xxx&aiOnly=true
 * Delete AI-generated comments for a review log.
 */
router.delete('/', requireReviewer, async (req: Request, res: Response) => {
  try {
    const { reviewLogId, aiOnly } = req.query;
    if (!reviewLogId) {
      res.status(400).json({ error: 'reviewLogId is required' });
      return;
    }

    const filter: any = { reviewLogId };
    if (aiOnly === 'true') {
      filter.commentText = { $regex: /^\[🤖 AI\]/ };
    }

    await Comment.deleteMany(filter);
    res.json({ message: 'Comments deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
