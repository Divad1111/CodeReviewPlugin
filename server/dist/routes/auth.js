"use strict";
/**
 * Authentication routes - login and register.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const Settings_1 = require("../models/Settings");
const AIModel_1 = require("../models/AIModel");
const config_1 = require("../config");
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            res.status(400).json({ error: 'Username and password are required' });
            return;
        }
        const user = await User_1.User.findOne({ username });
        if (!user) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        const payload = {
            username: user.username,
            role: user.role,
            parentReviewer: user.parentReviewer,
        };
        const token = jsonwebtoken_1.default.sign(payload, config_1.config.jwtSecret, {
            expiresIn: config_1.config.jwtExpiresIn,
        });
        const response = {
            token,
            username: user.username,
            role: user.role,
            parentReviewer: user.parentReviewer,
        };
        res.json(response);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * POST /api/auth/register
 * Public registration creates a reviewer account.
 */
router.post('/register', async (req, res) => {
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
            role: 'reviewer',
            parentReviewer: null,
        });
        await user.save();
        // Create default settings for new user
        const settings = new Settings_1.Settings({
            ownerUsername: username,
            aiModel: 'DeepSeek',
            debugMode: false,
        });
        await settings.save();
        // Create default AI model for new user
        const defaultModel = new AIModel_1.AIModel({
            modelId: crypto_1.default.randomUUID(),
            name: 'DeepSeek',
            endpoint: 'https://api.deepseek.com/v1/chat/completions',
            modelName: 'deepseek-chat',
            isDefault: true,
            ownerUsername: username,
        });
        await defaultModel.save();
        res.status(201).json({ message: 'Registration successful' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map