"use strict";
/**
 * Input history routes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const InputHistory_1 = require("../models/InputHistory");
const router = (0, express_1.Router)();
/**
 * GET /api/history?type=repo_url|author
 */
router.get('/', async (req, res) => {
    try {
        const { type } = req.query;
        const filter = { ownerUsername: req.user.username };
        if (type) {
            filter.type = type;
        }
        const items = await InputHistory_1.InputHistory.find(filter).sort({ usedAt: -1 });
        res.json(items.map(i => i.value));
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * POST /api/history
 * Record a history item (upsert).
 */
router.post('/', async (req, res) => {
    try {
        const { type, value } = req.body;
        const now = new Date().toISOString();
        await InputHistory_1.InputHistory.findOneAndUpdate({ ownerUsername: req.user.username, type, value }, { usedAt: now }, { upsert: true, new: true });
        res.json({ message: 'History recorded' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * DELETE /api/history
 */
router.delete('/', async (req, res) => {
    try {
        const { type, value } = req.query;
        await InputHistory_1.InputHistory.deleteOne({
            ownerUsername: req.user.username,
            type: type,
            value: value,
        });
        res.json({ message: 'History deleted' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=history.js.map