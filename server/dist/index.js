"use strict";
/**
 * Server entry point - Express + MongoDB.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("./config");
const auth_1 = require("./middleware/auth");
// Routes
const auth_2 = __importDefault(require("./routes/auth"));
const users_1 = __importDefault(require("./routes/users"));
const sessions_1 = __importDefault(require("./routes/sessions"));
const reviewLogs_1 = __importDefault(require("./routes/reviewLogs"));
const comments_1 = __importDefault(require("./routes/comments"));
const summaries_1 = __importDefault(require("./routes/summaries"));
const history_1 = __importDefault(require("./routes/history"));
const settings_1 = __importDefault(require("./routes/settings"));
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
// Health check (public)
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Public routes (no auth required)
app.use('/api/auth', auth_2.default);
// Protected routes (auth required)
app.use('/api/sessions', auth_1.authMiddleware, sessions_1.default);
app.use('/api/review-logs', auth_1.authMiddleware, reviewLogs_1.default);
app.use('/api/comments', auth_1.authMiddleware, comments_1.default);
app.use('/api/summaries', auth_1.authMiddleware, summaries_1.default);
app.use('/api/history', auth_1.authMiddleware, history_1.default);
app.use('/api/settings', auth_1.authMiddleware, settings_1.default);
app.use('/api/users', auth_1.authMiddleware, users_1.default);
// Error handling
app.use((err, _req, res, _next) => {
    console.error('[Server Error]', err);
    res.status(500).json({ error: 'Internal server error' });
});
// Connect to MongoDB and start server
async function start() {
    try {
        console.log('[Server] Connecting to MongoDB...');
        await mongoose_1.default.connect(config_1.config.mongodbUri);
        console.log('[Server] MongoDB connected');
        app.listen(config_1.config.port, () => {
            console.log(`[Server] Code Review Server running on port ${config_1.config.port}`);
            console.log(`[Server] Health check: http://localhost:${config_1.config.port}/api/health`);
        });
    }
    catch (err) {
        console.error('[Server] Failed to start:', err);
        process.exit(1);
    }
}
start();
//# sourceMappingURL=index.js.map