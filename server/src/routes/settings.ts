/**
 * Settings routes - per-user settings and AI models.
 */

import { Router, Request, Response } from 'express';
import { Settings } from '../models/Settings';
import { AIModel } from '../models/AIModel';
import { requireReviewer } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

/**
 * GET /api/settings
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    let settings = await Settings.findOne({ ownerUsername: req.user!.username });
    if (!settings) {
      // Create default settings
      settings = new Settings({
        ownerUsername: req.user!.username,
        aiModel: 'DeepSeek',
        debugMode: false,
      });
      await settings.save();
    }

    res.json({
      svnUsername: settings.svnUsername || '',
      svnPassword: settings.svnPassword || '',
      aiModel: settings.aiModel || 'DeepSeek',
      codingStandards: settings.codingStandards || '',
      excludePatterns: settings.excludePatterns || '',
      debugMode: settings.debugMode || false,
      language: settings.language || '',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/settings
 */
router.put('/', async (req: Request, res: Response) => {
  try {
    const update = req.body;
    await Settings.findOneAndUpdate(
      { ownerUsername: req.user!.username },
      {
        svnUsername: update.svnUsername || null,
        svnPassword: update.svnPassword || null,
        aiModel: update.aiModel || 'DeepSeek',
        codingStandards: update.codingStandards || null,
        excludePatterns: update.excludePatterns || null,
        debugMode: update.debugMode || false,
        language: update.language || null,
      },
      { upsert: true, new: true }
    );

    res.json({ message: 'Settings saved' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- AI Model routes ---

/**
 * GET /api/settings/ai-models
 */
router.get('/ai-models', async (req: Request, res: Response) => {
  try {
    const models = await AIModel.find({ ownerUsername: req.user!.username })
      .sort({ isDefault: -1, name: 1 });

    res.json(models.map(m => ({
      id: m.modelId,
      name: m.name,
      endpoint: m.endpoint,
      modelName: m.modelName,
      apiKey: m.apiKey || '',
      isDefault: m.isDefault,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/settings/ai-models/by-name/:name
 */
router.get('/ai-models/by-name/:name', async (req: Request, res: Response) => {
  try {
    const model = await AIModel.findOne({
      ownerUsername: req.user!.username,
      name: req.params.name,
    });

    if (!model) {
      res.json(null);
      return;
    }

    res.json({
      id: model.modelId,
      name: model.name,
      endpoint: model.endpoint,
      modelName: model.modelName,
      apiKey: model.apiKey || '',
      isDefault: model.isDefault,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/settings/ai-models
 */
router.post('/ai-models', requireReviewer, async (req: Request, res: Response) => {
  try {
    const { name, endpoint, modelName, apiKey, id } = req.body;

    if (id) {
      // Update existing
      await AIModel.findOneAndUpdate(
        { modelId: id, ownerUsername: req.user!.username },
        { name, endpoint, modelName, apiKey: apiKey || null }
      );
      res.json({ message: 'Model updated' });
    } else {
      // Create new
      const model = new AIModel({
        modelId: crypto.randomUUID(),
        name,
        endpoint,
        modelName,
        apiKey: apiKey || null,
        isDefault: false,
        ownerUsername: req.user!.username,
      });
      await model.save();
      res.status(201).json({ message: 'Model added' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/settings/ai-models/:id
 */
router.delete('/ai-models/:id', requireReviewer, async (req: Request, res: Response) => {
  try {
    await AIModel.deleteOne({
      modelId: req.params.id,
      ownerUsername: req.user!.username,
      isDefault: false,
    });
    res.json({ message: 'Model deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/settings/import
 */
router.post('/import', async (req: Request, res: Response) => {
  try {
    const data = req.body;

    // Update settings
    if (data.settings) {
      await Settings.findOneAndUpdate(
        { ownerUsername: req.user!.username },
        {
          svnUsername: data.settings.svnUsername || null,
          svnPassword: data.settings.svnPassword || null,
          aiModel: data.settings.aiModel || 'DeepSeek',
          codingStandards: data.settings.codingStandards || null,
          excludePatterns: data.settings.excludePatterns || null,
          debugMode: data.settings.debugMode || false,
          language: data.settings.language || null,
        },
        { upsert: true }
      );
    }

    // Update models
    if (Array.isArray(data.models)) {
      // Delete non-default models
      await AIModel.deleteMany({ ownerUsername: req.user!.username, isDefault: false });

      for (const m of data.models) {
        if (m.isDefault) { continue; }
        const model = new AIModel({
          modelId: crypto.randomUUID(),
          name: m.name,
          endpoint: m.endpoint,
          modelName: m.modelName,
          apiKey: m.apiKey || null,
          isDefault: false,
          ownerUsername: req.user!.username,
        });
        await model.save();
      }
    }

    res.json({ message: 'Settings imported' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
