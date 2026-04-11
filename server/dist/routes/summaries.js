"use strict";
/**
 * Summary CRUD routes.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Summary_1 = require("../models/Summary");
const auth_1 = require("../middleware/auth");
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
/**
 * GET /api/summaries?sessionId=xxx&author=yyy
 */
router.get('/', async (req, res) => {
    try {
        const { sessionId, author } = req.query;
        const filter = {};
        if (sessionId) {
            filter.sessionId = sessionId;
        }
        if (author) {
            filter.author = author;
        }
        const summaries = await Summary_1.Summary.find(filter);
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
            }
            else {
                res.json(null);
            }
        }
        else {
            res.json(summaries.map(s => ({
                id: s.summaryId,
                sessionId: s.sessionId,
                author: s.author,
                summary: s.summary,
                updatedAt: s.updatedAt,
            })));
        }
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * POST /api/summaries (upsert)
 */
router.post('/', auth_1.requireReviewer, async (req, res) => {
    try {
        const { sessionId, author, summary } = req.body;
        const now = new Date().toISOString();
        let existing = await Summary_1.Summary.findOne({ sessionId, author });
        if (existing) {
            existing.summary = summary;
            existing.updatedAt = now;
            await existing.save();
        }
        else {
            existing = new Summary_1.Summary({
                summaryId: crypto_1.default.randomUUID(),
                sessionId,
                author,
                summary,
                updatedAt: now,
                ownerUsername: req.user.username,
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * DELETE /api/summaries?sessionId=xxx&author=yyy
 */
router.delete('/', auth_1.requireReviewer, async (req, res) => {
    try {
        const { sessionId, author } = req.query;
        await Summary_1.Summary.deleteMany({
            sessionId: sessionId,
            author: author,
        });
        res.json({ message: 'Summary deleted' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=summaries.js.map