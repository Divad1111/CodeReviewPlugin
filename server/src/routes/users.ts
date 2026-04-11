/**
 * User management routes - manage reviewee accounts.
 * Only reviewers can access these routes.
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { requireReviewer } from '../middleware/auth';

const router = Router();

// All routes require reviewer role
router.use(requireReviewer);

/**
 * GET /api/users
 * Get all reviewee users created by the current reviewer.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const users = await User.find({
      parentReviewer: req.user!.username,
      role: 'reviewee',
    }).select('username role createdAt');

    res.json(users.map(u => ({
      id: u._id,
      username: u.username,
      role: u.role,
      createdAt: u.createdAt,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/users
 * Create a new reviewee user.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    // Check if username exists
    const existing = await User.findOne({ username });
    if (existing) {
      res.status(409).json({ error: 'Username already exists' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new User({
      username,
      passwordHash,
      role: 'reviewee',
      parentReviewer: req.user!.username,
    });

    await user.save();
    res.status(201).json({
      id: user._id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/users/:id
 * Update a reviewee user's password.
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    if (!password) {
      res.status(400).json({ error: 'Password is required' });
      return;
    }

    const user = await User.findOne({
      _id: req.params.id,
      parentReviewer: req.user!.username,
      role: 'reviewee',
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(password, salt);
    await user.save();

    res.json({ message: 'User updated' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/users/:id
 * Delete a reviewee user.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await User.deleteOne({
      _id: req.params.id,
      parentReviewer: req.user!.username,
      role: 'reviewee',
    });

    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ message: 'User deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
