"use strict";
/**
 * Script to clear the MongoDB database.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load .env file from server root
dotenv_1.default.config({ path: path_1.default.join(__dirname, '..', '.env') });
const mongodbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/code_review';
async function clearDatabase() {
    try {
        console.log(`[Cleaner] Connecting to MongoDB at ${mongodbUri}...`);
        await mongoose_1.default.connect(mongodbUri);
        console.log('[Cleaner] Connected. Dropping database...');
        await mongoose_1.default.connection.db?.dropDatabase();
        console.log('[Cleaner] Database cleared successfully.');
        await mongoose_1.default.disconnect();
        process.exit(0);
    }
    catch (err) {
        console.error('[Cleaner] Error clearing database:', err);
        process.exit(1);
    }
}
clearDatabase();
//# sourceMappingURL=clearDb.js.map