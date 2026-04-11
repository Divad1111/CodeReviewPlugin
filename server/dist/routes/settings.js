"use strict";
/**
 * Settings routes - per-user settings and AI models.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Settings_1 = require("../models/Settings");
const AIModel_1 = require("../models/AIModel");
const auth_1 = require("../middleware/auth");
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
/**
 * GET /api/settings
 */
router.get('/', async (req, res) => {
    try {
        let settings = await Settings_1.Settings.findOne({ ownerUsername: req.user.username });
        if (!settings) {
            // Create default settings
            settings = new Settings_1.Settings({
                ownerUsername: req.user.username,
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * PUT /api/settings
 */
router.put('/', async (req, res) => {
    try {
        const update = req.body;
        await Settings_1.Settings.findOneAndUpdate({ ownerUsername: req.user.username }, {
            svnUsername: update.svnUsername || null,
            svnPassword: update.svnPassword || null,
            aiModel: update.aiModel || 'DeepSeek',
            codingStandards: update.codingStandards || null,
            excludePatterns: update.excludePatterns || null,
            debugMode: update.debugMode || false,
            language: update.language || null,
        }, { upsert: true, new: true });
        res.json({ message: 'Settings saved' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// --- AI Model routes ---
/**
 * GET /api/settings/ai-models
 */
router.get('/ai-models', async (req, res) => {
    try {
        const models = await AIModel_1.AIModel.find({ ownerUsername: req.user.username })
            .sort({ isDefault: -1, name: 1 });
        res.json(models.map(m => ({
            id: m.modelId,
            name: m.name,
            endpoint: m.endpoint,
            modelName: m.modelName,
            apiKey: m.apiKey || '',
            isDefault: m.isDefault,
        })));
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * GET /api/settings/ai-models/by-name/:name
 */
router.get('/ai-models/by-name/:name', async (req, res) => {
    try {
        const model = await AIModel_1.AIModel.findOne({
            ownerUsername: req.user.username,
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * POST /api/settings/ai-models
 */
router.post('/ai-models', auth_1.requireReviewer, async (req, res) => {
    try {
        const { name, endpoint, modelName, apiKey, id } = req.body;
        if (id) {
            // Update existing
            await AIModel_1.AIModel.findOneAndUpdate({ modelId: id, ownerUsername: req.user.username }, { name, endpoint, modelName, apiKey: apiKey || null });
            res.json({ message: 'Model updated' });
        }
        else {
            // Create new
            const model = new AIModel_1.AIModel({
                modelId: crypto_1.default.randomUUID(),
                name,
                endpoint,
                modelName,
                apiKey: apiKey || null,
                isDefault: false,
                ownerUsername: req.user.username,
            });
            await model.save();
            res.status(201).json({ message: 'Model added' });
        }
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * DELETE /api/settings/ai-models/:id
 */
router.delete('/ai-models/:id', auth_1.requireReviewer, async (req, res) => {
    try {
        await AIModel_1.AIModel.deleteOne({
            modelId: req.params.id,
            ownerUsername: req.user.username,
            isDefault: false,
        });
        res.json({ message: 'Model deleted' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * POST /api/settings/import
 */
router.post('/import', async (req, res) => {
    try {
        const data = req.body;
        // Update settings
        if (data.settings) {
            await Settings_1.Settings.findOneAndUpdate({ ownerUsername: req.user.username }, {
                svnUsername: data.settings.svnUsername || null,
                svnPassword: data.settings.svnPassword || null,
                aiModel: data.settings.aiModel || 'DeepSeek',
                codingStandards: data.settings.codingStandards || null,
                excludePatterns: data.settings.excludePatterns || null,
                debugMode: data.settings.debugMode || false,
                language: data.settings.language || null,
            }, { upsert: true });
        }
        // Update models
        if (Array.isArray(data.models)) {
            // Delete non-default models
            await AIModel_1.AIModel.deleteMany({ ownerUsername: req.user.username, isDefault: false });
            for (const m of data.models) {
                if (m.isDefault) {
                    continue;
                }
                const model = new AIModel_1.AIModel({
                    modelId: crypto_1.default.randomUUID(),
                    name: m.name,
                    endpoint: m.endpoint,
                    modelName: m.modelName,
                    apiKey: m.apiKey || null,
                    isDefault: false,
                    ownerUsername: req.user.username,
                });
                await model.save();
            }
        }
        res.json({ message: 'Settings imported' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=settings.js.map