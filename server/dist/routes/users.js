"use strict";
/**
 * User management routes - manage reviewee accounts.
 * Only reviewers can access these routes.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = require("../models/User");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// All routes require reviewer role
router.use(auth_1.requireReviewer);
/**
 * GET /api/users
 * Get all reviewee users created by the current reviewer.
 */
router.get('/', async (req, res) => {
    try {
        const users = await User_1.User.find({
            parentReviewer: req.user.username,
            role: 'reviewee',
        }).select('username role createdAt');
        res.json(users.map(u => ({
            id: u._id,
            username: u.username,
            role: u.role,
            createdAt: u.createdAt,
        })));
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * POST /api/users
 * Create a new reviewee user.
 */
router.post('/', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            res.status(400).json({ error: 'Username and password are required' });
            return;
        }
        // Check if username exists
        const existing = await User_1.User.findOne({ username });
        if (existing) {
            res.status(409).json({ error: 'Username already exists' });
            return;
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        const passwordHash = await bcryptjs_1.default.hash(password, salt);
        const user = new User_1.User({
            username,
            passwordHash,
            role: 'reviewee',
            parentReviewer: req.user.username,
        });
        await user.save();
        res.status(201).json({
            id: user._id,
            username: user.username,
            role: user.role,
            createdAt: user.createdAt,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * PUT /api/users/:id
 * Update a reviewee user's password.
 */
router.put('/:id', async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) {
            res.status(400).json({ error: 'Password is required' });
            return;
        }
        const user = await User_1.User.findOne({
            _id: req.params.id,
            parentReviewer: req.user.username,
            role: 'reviewee',
        });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        user.passwordHash = await bcryptjs_1.default.hash(password, salt);
        await user.save();
        res.json({ message: 'User updated' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * DELETE /api/users/:id
 * Delete a reviewee user.
 */
router.delete('/:id', async (req, res) => {
    try {
        const result = await User_1.User.deleteOne({
            _id: req.params.id,
            parentReviewer: req.user.username,
            role: 'reviewee',
        });
        if (result.deletedCount === 0) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json({ message: 'User deleted' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map