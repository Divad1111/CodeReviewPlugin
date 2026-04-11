"use strict";
/**
 * Session CRUD routes.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Session_1 = require("../models/Session");
const ReviewLog_1 = require("../models/ReviewLog");
const Comment_1 = require("../models/Comment");
const Summary_1 = require("../models/Summary");
const auth_1 = require("../middleware/auth");
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
/**
 * GET /api/sessions
 * Reviewer: all sessions owned by them.
 * Reviewee: sessions that contain comments related to them (via parentReviewer's sessions).
 */
router.get('/', async (req, res) => {
    try {
        const { username, roles, parentReviewer } = req.user;
        let sessions = [];
        const query = { $or: [] };
        // 1. If user is a reviewer, they can see sessions they created
        if (roles.includes('reviewer')) {
            query.$or.push({ ownerUsername: username });
        }
        // 2. If user is a reviewee, they can see sessions where they are an author 
        // (owned by their parent reviewer)
        if (roles.includes('reviewee') && parentReviewer) {
            query.$or.push({
                ownerUsername: parentReviewer,
                authors: username,
            });
        }
        // Fallback for standalone/unexpected cases
        if (query.$or.length === 0) {
            sessions = [];
        }
        else {
            sessions = await Session_1.Session.find(query).sort({ createdAt: -1 });
        }
        res.json(sessions.map(s => {
            // Use ownership check instead of global role to determine visibility.
            // Owners (reviewers) see all authors; participants (reviewees) see only themselves.
            const currentUsernameLower = username.toLowerCase();
            const isOwner = s.ownerUsername.toLowerCase() === currentUsernameLower;
            const filteredAuthors = isOwner
                ? s.authors
                : s.authors.filter((a) => a.toLowerCase() === currentUsernameLower);
            return {
                id: s.sessionId,
                name: s.name,
                createdAt: s.createdAt,
                repoUrl: s.repoUrl,
                startDate: s.startDate,
                endDate: s.endDate,
                authors: filteredAuthors,
            };
        }));
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * GET /api/sessions/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const session = await Session_1.Session.findOne({ sessionId: req.params.id });
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }
        const { username } = req.user;
        const currentUsernameLower = username.toLowerCase();
        const isOwner = session.ownerUsername.toLowerCase() === currentUsernameLower;
        const filteredAuthors = isOwner
            ? session.authors
            : session.authors.filter((a) => a.toLowerCase() === currentUsernameLower);
        res.json({
            id: session.sessionId,
            name: session.name,
            createdAt: session.createdAt,
            repoUrl: session.repoUrl,
            startDate: session.startDate,
            endDate: session.endDate,
            authors: filteredAuthors,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * POST /api/sessions
 * Create a new session (reviewer only).
 */
router.post('/', auth_1.requireReviewer, async (req, res) => {
    try {
        const { name, repoUrl, startDate, endDate, authors } = req.body;
        const sessionId = crypto_1.default.randomUUID();
        const session = new Session_1.Session({
            sessionId,
            name: name || 'Untitled Session',
            createdAt: new Date().toISOString(),
            repoUrl,
            startDate,
            endDate,
            authors: authors || [],
            ownerUsername: req.user.username,
        });
        await session.save();
        res.status(201).json({
            id: session.sessionId,
            name: session.name,
            createdAt: session.createdAt,
            repoUrl: session.repoUrl,
            startDate: session.startDate,
            endDate: session.endDate,
            authors: session.authors,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * PUT /api/sessions/:id
 * Update session (rename, update authors).
 */
router.put('/:id', auth_1.requireReviewer, async (req, res) => {
    try {
        const update = {};
        if (req.body.name !== undefined) {
            update.name = req.body.name;
        }
        if (req.body.authors !== undefined) {
            update.authors = req.body.authors;
        }
        const session = await Session_1.Session.findOneAndUpdate({ sessionId: req.params.id, ownerUsername: req.user.username }, update, { new: true });
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }
        res.json({
            id: session.sessionId,
            name: session.name,
            createdAt: session.createdAt,
            repoUrl: session.repoUrl,
            startDate: session.startDate,
            endDate: session.endDate,
            authors: session.authors,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * DELETE /api/sessions/:id
 * Delete session and all related data.
 */
router.delete('/:id', auth_1.requireReviewer, async (req, res) => {
    try {
        const sessionId = req.params.id;
        const ownerUsername = req.user.username;
        // Verify ownership
        const session = await Session_1.Session.findOne({ sessionId, ownerUsername });
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }
        // Delete all related data
        const reviewLogs = await ReviewLog_1.ReviewLog.find({ sessionId });
        const reviewLogIds = reviewLogs.map(r => r.reviewLogId);
        await Comment_1.Comment.deleteMany({ reviewLogId: { $in: reviewLogIds } });
        await ReviewLog_1.ReviewLog.deleteMany({ sessionId });
        await Summary_1.Summary.deleteMany({ sessionId });
        await Session_1.Session.deleteOne({ sessionId });
        res.json({ message: 'Session deleted' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=sessions.js.map