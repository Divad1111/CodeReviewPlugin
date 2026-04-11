"use strict";
/**
 * Comment CRUD routes.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Comment_1 = require("../models/Comment");
const auth_1 = require("../middleware/auth");
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
/**
 * GET /api/comments?reviewLogId=xxx
 */
router.get('/', async (req, res) => {
    try {
        const { reviewLogId } = req.query;
        const filter = {};
        if (reviewLogId) {
            filter.reviewLogId = reviewLogId;
        }
        const comments = await Comment_1.Comment.find(filter).sort({ lineNumber: 1 });
        res.json(comments.map(c => ({
            id: c.commentId,
            reviewLogId: c.reviewLogId,
            lineNumber: c.lineNumber,
            codeSnippet: c.codeSnippet,
            commentText: c.commentText,
            revision: c.revision,
            createdAt: c.createdAt,
        })));
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * GET /api/comments/count?reviewLogId=xxx
 */
router.get('/count', async (req, res) => {
    try {
        const { reviewLogId } = req.query;
        const count = await Comment_1.Comment.countDocuments({ reviewLogId });
        res.json({ count });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * POST /api/comments
 */
router.post('/', auth_1.requireReviewer, async (req, res) => {
    try {
        const { reviewLogId, lineNumber, commentText, codeSnippet, revision } = req.body;
        const comment = new Comment_1.Comment({
            commentId: crypto_1.default.randomUUID(),
            reviewLogId,
            lineNumber,
            codeSnippet: codeSnippet || null,
            commentText,
            revision: revision || null,
            createdAt: new Date().toISOString(),
            ownerUsername: req.user.username,
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * PUT /api/comments/:id
 */
router.put('/:id', auth_1.requireReviewer, async (req, res) => {
    try {
        const comment = await Comment_1.Comment.findOneAndUpdate({ commentId: req.params.id }, { commentText: req.body.commentText }, { new: true });
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * DELETE /api/comments/:id
 */
router.delete('/:id', auth_1.requireReviewer, async (req, res) => {
    try {
        const result = await Comment_1.Comment.deleteOne({ commentId: req.params.id });
        if (result.deletedCount === 0) {
            res.status(404).json({ error: 'Comment not found' });
            return;
        }
        res.json({ message: 'Comment deleted' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * DELETE /api/comments?reviewLogId=xxx&aiOnly=true
 * Delete AI-generated comments for a review log.
 */
router.delete('/', auth_1.requireReviewer, async (req, res) => {
    try {
        const { reviewLogId, aiOnly } = req.query;
        if (!reviewLogId) {
            res.status(400).json({ error: 'reviewLogId is required' });
            return;
        }
        const filter = { reviewLogId };
        if (aiOnly === 'true') {
            filter.commentText = { $regex: /^\[🤖 AI\]/ };
        }
        await Comment_1.Comment.deleteMany(filter);
        res.json({ message: 'Comments deleted' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=comments.js.map