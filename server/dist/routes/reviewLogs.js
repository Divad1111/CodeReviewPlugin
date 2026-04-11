"use strict";
/**
 * ReviewLog CRUD routes.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ReviewLog_1 = require("../models/ReviewLog");
const Comment_1 = require("../models/Comment");
const auth_1 = require("../middleware/auth");
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
/**
 * GET /api/review-logs?sessionId=xxx
 * Reviewer: all logs for the session.
 * Reviewee: only logs where author matches their username.
 */
router.get('/', async (req, res) => {
    try {
        const { sessionId, author } = req.query;
        const { username, role } = req.user;
        const filter = {};
        if (sessionId) {
            filter.sessionId = sessionId;
        }
        if (author) {
            filter.author = author;
        }
        if (role === 'reviewee') {
            // Reviewee can only see logs for their own author name
            filter.author = username;
        }
        const logs = await ReviewLog_1.ReviewLog.find(filter).sort({ author: 1, filePath: 1 });
        res.json(logs.map(r => ({
            id: r.reviewLogId,
            sessionId: r.sessionId,
            filePath: r.filePath,
            author: r.author,
            status: r.status,
            reviewedAt: r.reviewedAt,
            baseRevision: r.baseRevision,
            endRevision: r.endRevision,
            aiAudited: r.aiAudited,
        })));
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * GET /api/review-logs/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const log = await ReviewLog_1.ReviewLog.findOne({ reviewLogId: req.params.id });
        if (!log) {
            res.status(404).json({ error: 'ReviewLog not found' });
            return;
        }
        res.json({
            id: log.reviewLogId,
            sessionId: log.sessionId,
            filePath: log.filePath,
            author: log.author,
            status: log.status,
            reviewedAt: log.reviewedAt,
            baseRevision: log.baseRevision,
            endRevision: log.endRevision,
            aiAudited: log.aiAudited,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * POST /api/review-logs
 * Create or update a review log (upsert by sessionId + filePath + author).
 */
router.post('/', auth_1.requireReviewer, async (req, res) => {
    try {
        const { sessionId, filePath, author, baseRevision, endRevision } = req.body;
        // Check if exists
        let log = await ReviewLog_1.ReviewLog.findOne({ sessionId, filePath, author });
        if (log) {
            // Update revisions if provided
            if (baseRevision !== undefined) {
                log.baseRevision = baseRevision;
            }
            if (endRevision !== undefined) {
                log.endRevision = endRevision;
            }
            await log.save();
        }
        else {
            log = new ReviewLog_1.ReviewLog({
                reviewLogId: crypto_1.default.randomUUID(),
                sessionId,
                filePath,
                author,
                status: 'pending',
                baseRevision,
                endRevision,
                aiAudited: false,
                ownerUsername: req.user.username,
            });
            await log.save();
        }
        res.status(201).json({
            id: log.reviewLogId,
            sessionId: log.sessionId,
            filePath: log.filePath,
            author: log.author,
            status: log.status,
            reviewedAt: log.reviewedAt,
            baseRevision: log.baseRevision,
            endRevision: log.endRevision,
            aiAudited: log.aiAudited,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * PUT /api/review-logs/:id
 * Update status or AI audit flag.
 */
router.put('/:id', auth_1.requireReviewer, async (req, res) => {
    try {
        const update = {};
        if (req.body.status !== undefined) {
            update.status = req.body.status;
            update.reviewedAt = req.body.status !== 'pending' ? new Date().toISOString() : null;
        }
        if (req.body.aiAudited !== undefined) {
            update.aiAudited = req.body.aiAudited;
        }
        const log = await ReviewLog_1.ReviewLog.findOneAndUpdate({ reviewLogId: req.params.id }, update, { new: true });
        if (!log) {
            res.status(404).json({ error: 'ReviewLog not found' });
            return;
        }
        res.json({
            id: log.reviewLogId,
            sessionId: log.sessionId,
            filePath: log.filePath,
            author: log.author,
            status: log.status,
            reviewedAt: log.reviewedAt,
            baseRevision: log.baseRevision,
            endRevision: log.endRevision,
            aiAudited: log.aiAudited,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * DELETE /api/review-logs/:id
 */
router.delete('/:id', auth_1.requireReviewer, async (req, res) => {
    try {
        const log = await ReviewLog_1.ReviewLog.findOne({ reviewLogId: req.params.id });
        if (!log) {
            res.status(404).json({ error: 'ReviewLog not found' });
            return;
        }
        // Delete associated comments
        await Comment_1.Comment.deleteMany({ reviewLogId: log.reviewLogId });
        await ReviewLog_1.ReviewLog.deleteOne({ reviewLogId: req.params.id });
        res.json({ message: 'ReviewLog deleted' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * DELETE /api/review-logs?sessionId=xxx&author=yyy
 * Delete all review logs for a specific author in a session.
 */
router.delete('/', auth_1.requireReviewer, async (req, res) => {
    try {
        const { sessionId, author } = req.query;
        if (!sessionId || !author) {
            res.status(400).json({ error: 'sessionId and author are required' });
            return;
        }
        const logs = await ReviewLog_1.ReviewLog.find({ sessionId: sessionId, author: author });
        const logIds = logs.map(l => l.reviewLogId);
        await Comment_1.Comment.deleteMany({ reviewLogId: { $in: logIds } });
        await ReviewLog_1.ReviewLog.deleteMany({ sessionId: sessionId, author: author });
        res.json({ message: 'ReviewLogs deleted' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=reviewLogs.js.map