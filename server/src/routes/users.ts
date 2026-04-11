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
    }).sort({ createdAt: -1 });

    const result = users.map(user => {
      const u = user.toObject();
      return {
        id: u._id.toString(),
        username: u.username,
        roles: (u.roles && u.roles.length > 0) ? u.roles : ['reviewee'],
        createdAt: u.createdAt,
      };
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { username, password, roles } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are REQUIRED FOR NEW USERS' });
      return;
    }

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
      roles: (roles && roles.length > 0) ? roles : ['reviewee'],
      parentReviewer: req.user!.username,
    });

    await user.save();
    res.status(201).json({
      id: user._id.toString(),
      username: user.username,
      roles: user.roles,
      createdAt: user.createdAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { password, roles } = req.body;
    
    const user = await User.findOne({
      _id: req.params.id,
      parentReviewer: req.user!.username,
    });

    if (!user) {
      res.status(404).json({ error: 'User not found in update' });
      return;
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(password, salt);
    }

    if (roles && Array.isArray(roles)) {
      user.roles = roles;
      user.markModified('roles');
    }

    await user.save();
    res.json({ message: 'Update successful' });
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
