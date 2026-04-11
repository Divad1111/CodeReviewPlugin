"use strict";
/**
 * Server configuration - loads from environment variables.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load .env file from server root
dotenv_1.default.config({ path: path_1.default.join(__dirname, '..', '.env') });
exports.config = {
    port: parseInt(process.env.PORT || '3000', 10),
    mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/code_review',
    jwtSecret: process.env.JWT_SECRET || 'default-secret-change-this',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
};
//# sourceMappingURL=config.js.map