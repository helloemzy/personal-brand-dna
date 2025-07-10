"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Test setup file
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load test environment variables
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env.test') });
// Mock logger to reduce noise in tests
jest.mock('pino', () => ({
    default: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        child: jest.fn(() => ({
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
        })),
    }),
}));
// Global test timeout
jest.setTimeout(30000);
// Clean up after tests
afterAll(async () => {
    // Close any open connections
    await new Promise(resolve => setTimeout(resolve, 500));
});
//# sourceMappingURL=setup.js.map