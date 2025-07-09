"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskStatus = exports.Priority = exports.MessageType = exports.AgentType = void 0;
// Agent Types
var AgentType;
(function (AgentType) {
    AgentType["NEWS_MONITOR"] = "NEWS_MONITOR";
    AgentType["CONTENT_GENERATOR"] = "CONTENT_GENERATOR";
    AgentType["QUALITY_CONTROL"] = "QUALITY_CONTROL";
    AgentType["PUBLISHER"] = "PUBLISHER";
    AgentType["LEARNING"] = "LEARNING";
    AgentType["ORCHESTRATOR"] = "ORCHESTRATOR";
})(AgentType || (exports.AgentType = AgentType = {}));
// Message Types
var MessageType;
(function (MessageType) {
    MessageType["TASK_REQUEST"] = "TASK_REQUEST";
    MessageType["TASK_RESULT"] = "TASK_RESULT";
    MessageType["STATUS_UPDATE"] = "STATUS_UPDATE";
    MessageType["ERROR_REPORT"] = "ERROR_REPORT";
    MessageType["COORDINATION"] = "COORDINATION";
    MessageType["LEARNING_UPDATE"] = "LEARNING_UPDATE";
})(MessageType || (exports.MessageType = MessageType = {}));
// Priority Levels
var Priority;
(function (Priority) {
    Priority[Priority["LOW"] = 1] = "LOW";
    Priority[Priority["MEDIUM"] = 5] = "MEDIUM";
    Priority[Priority["HIGH"] = 10] = "HIGH";
    Priority[Priority["CRITICAL"] = 20] = "CRITICAL";
})(Priority || (exports.Priority = Priority = {}));
// Task Status
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["PENDING"] = "pending";
    TaskStatus["IN_PROGRESS"] = "in_progress";
    TaskStatus["COMPLETED"] = "completed";
    TaskStatus["FAILED"] = "failed";
    TaskStatus["CANCELLED"] = "cancelled";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
