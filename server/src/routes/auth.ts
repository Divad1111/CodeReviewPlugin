/**
 * Authentication routes - login and register.
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Settings } from '../models/Settings';
import { AIModel } from '../models/AIModel';
import { config } from '../config';
import { LoginResponse, JwtPayload } from '../types/shared';
import crypto from 'crypto';

const router = Router();

/**
 * POST /api/auth/login
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const user = await User.findOne({ username });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const payload: JwtPayload = {
      username: user.username,
      role: user.role,
      parentReviewer: user.parentReviewer,
    };

    const token = jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn as any,
    });

    const response: LoginResponse = {
      token,
      username: user.username,
      role: user.role,
      parentReviewer: user.parentReviewer,
    };

    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/register
 * Public registration creates a reviewer account.
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    if (password.length < 3) {
      res.status(400).json({ error: 'Password must be at least 3 characters' });
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
      role: 'reviewer',
      parentReviewer: null,
    });

    await user.save();

    // Create default settings for new user
    const settings = new Settings({
      ownerUsername: username,
      aiModel: 'DeepSeek',
      debugMode: false,
    });
    await settings.save();

    // Create default AI model for new user
    const defaultModel = new AIModel({
      modelId: crypto.randomUUID(),
      name: 'DeepSeek',
      endpoint: 'https://api.deepseek.com/v1/chat/completions',
      modelName: 'deepseek-chat',
      isDefault: true,
      ownerUsername: username,
    });
    await defaultModel.save();

    res.status(201).json({ message: 'Registration successful' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
