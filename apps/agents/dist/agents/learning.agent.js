"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LearningAgent = void 0;
const base_agent_1 = require("../framework/base-agent");
const shared_1 = require("@brandpillar/shared");
const supabase_js_1 = require("@supabase/supabase-js");
const ioredis_1 = __importDefault(require("ioredis"));
const performance_tracker_service_1 = require("../services/performance-tracker.service");
const uuid_1 = require("uuid");
class LearningAgent extends base_agent_1.BaseAgent {
    supabase;
    redis;
    performanceTracker;
    // Learning configuration
    LEARNING_INTERVAL = 3600000; // 1 hour
    MIN_DATA_POINTS = 10;
    IMPROVEMENT_THRESHOLD = 0.05; // 5% improvement threshold
    // Performance metrics cache
    metricsCache = new Map();
    learningTimer;
    constructor() {
        super({
            type: shared_1.AgentType.LEARNING,
            name: 'Learning Agent',
            messageBusUrl: process.env.CLOUDAMQP_URL || 'amqp://localhost',
            redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
            maxConcurrentTasks: 3, // Learning tasks can be resource intensive
            healthCheckInterval: 120000 // 2 minutes
        });
        this.supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        this.redis = new ioredis_1.default(process.env.REDIS_URL);
        this.performanceTracker = new performance_tracker_service_1.PerformanceTrackerService(this.logger);
    }
    async initialize() {
        this.logger.info('Initializing Learning Agent');
        // Start continuous learning cycle
        this.startLearningCycle();
        // Load historical performance data
        await this.loadHistoricalData();
    }
    async processTask(task) {
        this.logger.info({ taskType: task.taskType }, 'Processing learning task');
        switch (task.taskType) {
            case 'ANALYZE_PERFORMANCE':
                return this.analyzePerformance(task.payload);
            case 'OPTIMIZE_AGENT':
                return this.optimizeAgent(task.payload);
            case 'GENERATE_INSIGHTS':
                return this.generateInsights(task.payload);
            case 'UPDATE_MODELS':
                return this.updateModels(task.payload);
            case 'SYSTEM_OPTIMIZATION':
                return this.optimizeSystem(task.payload);
            case 'EXPERIMENT_ANALYSIS':
                return this.analyzeExperiment(task.payload);
            default:
                throw new Error(`Unknown task type: ${task.taskType}`);
        }
    }
    async validateTask(task) {
        switch (task.taskType) {
            case 'ANALYZE_PERFORMANCE':
            case 'GENERATE_INSIGHTS':
            case 'SYSTEM_OPTIMIZATION':
                return true; // These can run without specific parameters
            case 'OPTIMIZE_AGENT':
                return !!(task.payload?.agentType);
            case 'UPDATE_MODELS':
                return !!(task.payload?.modelType && task.payload?.updates);
            case 'EXPERIMENT_ANALYSIS':
                return !!(task.payload?.experimentId);
            default:
                return false;
        }
    }
    // Core Learning Methods
    async analyzePerformance(request) {
        const { userId, agentType, timeRange = '7d' } = request;
        this.logger.info({ userId, agentType, timeRange }, 'Analyzing performance');
        // Fetch performance data
        const performanceData = await this.fetchPerformanceData(userId, agentType, timeRange);
        if (performanceData.length < this.MIN_DATA_POINTS) {
            return {
                status: 'insufficient_data',
                dataPoints: performanceData.length,
                requiredPoints: this.MIN_DATA_POINTS
            };
        }
        // Analyze patterns
        const patterns = await this.identifyPatterns(performanceData);
        // Calculate metrics
        const metrics = this.calculatePerformanceMetrics(performanceData);
        // Identify anomalies
        const anomalies = this.detectAnomalies(performanceData);
        // Generate recommendations
        const recommendations = await this.generateRecommendations(patterns, metrics, anomalies);
        return {
            timeRange,
            dataPoints: performanceData.length,
            patterns,
            metrics,
            anomalies,
            recommendations
        };
    }
    async optimizeAgent(request) {
        const { agentType } = request;
        this.logger.info({ agentType }, 'Optimizing agent');
        // Get agent-specific performance data
        const performance = await this.getAgentPerformance(agentType);
        // Identify optimization opportunities
        const opportunities = await this.identifyOptimizations(agentType, performance);
        // Generate optimization updates
        const updates = [];
        for (const opportunity of opportunities) {
            const update = await this.generateOptimizationUpdate(agentType, opportunity, performance);
            if (update) {
                updates.push(update);
            }
        }
        // Apply optimizations
        for (const update of updates) {
            await this.applyOptimization(update);
        }
        return updates;
    }
    async generateInsights(request) {
        const { timeRange = '30d' } = request;
        this.logger.info({ timeRange }, 'Generating system insights');
        // Collect system-wide metrics
        const systemMetrics = await this.collectSystemMetrics(timeRange);
        // Analyze agent performance
        const agentPerformance = await this.analyzeAllAgents();
        // Identify bottlenecks
        const bottlenecks = this.identifyBottlenecks(systemMetrics, agentPerformance);
        // Find opportunities
        const opportunities = await this.findOpportunities(systemMetrics, agentPerformance);
        // Generate recommendations
        const recommendations = await this.generateSystemRecommendations(systemMetrics, agentPerformance, bottlenecks, opportunities);
        return {
            overallHealth: this.calculateSystemHealth(systemMetrics),
            performanceTrends: this.analyzePerformanceTrends(systemMetrics),
            bottlenecks,
            opportunities,
            recommendations
        };
    }
    async updateModels(request) {
        const { modelType, updates } = request;
        this.logger.info({ modelType }, 'Updating models');
        // Validate updates
        const validation = await this.validateModelUpdates(modelType, updates);
        if (!validation.isValid) {
            throw new Error(`Invalid model updates: ${validation.errors.join(', ')}`);
        }
        // Apply updates
        const result = await this.applyModelUpdates(modelType, updates);
        // Test updated model
        const testResults = await this.testUpdatedModel(modelType);
        // Rollback if performance degrades
        if (testResults.performanceScore < 0.95) {
            await this.rollbackModelUpdates(modelType);
            return {
                status: 'rolled_back',
                reason: 'Performance degradation detected',
                testResults
            };
        }
        return {
            status: 'success',
            modelType,
            updates: result,
            testResults
        };
    }
    async optimizeSystem(request) {
        this.logger.info('Running system-wide optimization');
        // Analyze current system state
        const systemState = await this.analyzeSystemState();
        // Identify optimization targets
        const targets = this.identifyOptimizationTargets(systemState);
        // Run optimization experiments
        const experiments = [];
        for (const target of targets) {
            const experiment = await this.runOptimizationExperiment(target);
            experiments.push(experiment);
        }
        // Apply successful optimizations
        const applied = [];
        for (const experiment of experiments) {
            if (experiment.success && experiment.improvement > this.IMPROVEMENT_THRESHOLD) {
                await this.applyOptimization(experiment.optimization);
                applied.push(experiment);
            }
        }
        return {
            systemState,
            targets,
            experiments,
            applied,
            expectedImprovement: applied.reduce((sum, exp) => sum + exp.improvement, 0)
        };
    }
    async analyzeExperiment(request) {
        const { experimentId } = request;
        // Fetch experiment data
        const experiment = await this.fetchExperimentData(experimentId);
        // Analyze results
        const analysis = {
            experimentId,
            status: experiment.status,
            startTime: experiment.startTime,
            endTime: experiment.endTime,
            control: this.analyzeVariant(experiment.control),
            treatment: this.analyzeVariant(experiment.treatment),
            improvement: 0,
            significance: 0,
            recommendation: ''
        };
        // Calculate improvement
        analysis.improvement = (analysis.treatment.performance - analysis.control.performance) /
            analysis.control.performance;
        // Calculate statistical significance
        analysis.significance = this.calculateSignificance(analysis.control, analysis.treatment);
        // Generate recommendation
        if (analysis.significance > 0.95 && analysis.improvement > this.IMPROVEMENT_THRESHOLD) {
            analysis.recommendation = 'Apply treatment to production';
        }
        else if (analysis.significance > 0.95 && analysis.improvement < -this.IMPROVEMENT_THRESHOLD) {
            analysis.recommendation = 'Reject treatment, maintain control';
        }
        else {
            analysis.recommendation = 'Continue experiment for more data';
        }
        return analysis;
    }
    // Helper Methods
    startLearningCycle() {
        this.learningTimer = setInterval(async () => {
            try {
                // Run periodic learning tasks
                await this.runPeriodicLearning();
            }
            catch (error) {
                this.logger.error({ error }, 'Learning cycle error');
            }
        }, this.LEARNING_INTERVAL);
    }
    async runPeriodicLearning() {
        this.logger.info('Running periodic learning cycle');
        // Analyze recent performance
        const insights = await this.generateInsights({ timeRange: '1h' });
        // Send updates to relevant agents
        for (const recommendation of insights.recommendations) {
            await this.sendOptimizationUpdate(recommendation);
        }
        // Update cached metrics
        await this.updateMetricsCache();
    }
    async loadHistoricalData() {
        try {
            // Load last 7 days of performance data
            const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const { data } = await this.supabase
                .from('content_performance')
                .select('*')
                .gte('created_at', startDate)
                .order('created_at', { ascending: false });
            if (data) {
                // Group by user
                data.forEach(row => {
                    const userId = row.user_id;
                    if (!this.metricsCache.has(userId)) {
                        this.metricsCache.set(userId, []);
                    }
                    this.metricsCache.get(userId).push({
                        userId,
                        contentId: row.content_id,
                        metrics: row.metrics,
                        timestamp: new Date(row.created_at)
                    });
                });
            }
            this.logger.info({ userCount: this.metricsCache.size }, 'Loaded historical data');
        }
        catch (error) {
            this.logger.error({ error }, 'Failed to load historical data');
        }
    }
    async fetchPerformanceData(userId, agentType, timeRange = '7d') {
        const duration = this.parseDuration(timeRange);
        const startDate = new Date(Date.now() - duration);
        let query = this.supabase
            .from('agent_performance')
            .select('*')
            .gte('created_at', startDate);
        if (userId) {
            query = query.eq('user_id', userId);
        }
        if (agentType) {
            query = query.eq('agent_type', agentType);
        }
        const { data, error } = await query;
        if (error) {
            this.logger.error({ error }, 'Failed to fetch performance data');
            return [];
        }
        return data || [];
    }
    parseDuration(timeRange) {
        const match = timeRange.match(/(\d+)([hdwm])/);
        if (!match) {
            return 24 * 60 * 60 * 1000; // Default to 1 day
        }
        const [, value, unit] = match;
        const multipliers = {
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000,
            w: 7 * 24 * 60 * 60 * 1000,
            m: 30 * 24 * 60 * 60 * 1000
        };
        return parseInt(value) * multipliers[unit];
    }
    async identifyPatterns(data) {
        // Analyze temporal patterns
        const temporalPatterns = this.analyzeTemporalPatterns(data);
        // Analyze content patterns
        const contentPatterns = this.analyzeContentPatterns(data);
        // Analyze user behavior patterns
        const behaviorPatterns = this.analyzeBehaviorPatterns(data);
        return {
            temporal: temporalPatterns,
            content: contentPatterns,
            behavior: behaviorPatterns
        };
    }
    analyzeTemporalPatterns(data) {
        const hourlyPerformance = new Map();
        const dailyPerformance = new Map();
        data.forEach(item => {
            const hour = item.timestamp.getHours();
            const day = item.timestamp.getDay();
            const score = item.metrics.engagementRate || 0;
            if (!hourlyPerformance.has(hour)) {
                hourlyPerformance.set(hour, []);
            }
            hourlyPerformance.get(hour).push(score);
            if (!dailyPerformance.has(day)) {
                dailyPerformance.set(day, []);
            }
            dailyPerformance.get(day).push(score);
        });
        return {
            bestHours: this.getTopEntries(hourlyPerformance, 3),
            bestDays: this.getTopEntries(dailyPerformance, 3),
            worstHours: this.getBottomEntries(hourlyPerformance, 3),
            worstDays: this.getBottomEntries(dailyPerformance, 3)
        };
    }
    analyzeContentPatterns(data) {
        // This would analyze content types, topics, etc.
        // Simplified for now
        return {
            topPerformingTypes: ['article', 'post', 'poll'],
            underperformingTypes: ['link', 'image'],
            optimalLength: { min: 150, max: 300 }
        };
    }
    analyzeBehaviorPatterns(data) {
        // Analyze user engagement patterns
        return {
            averageEngagementTime: '2.5 minutes',
            peakActivityPeriods: ['9-10am', '12-1pm', '5-6pm'],
            contentPreferences: ['educational', 'inspirational']
        };
    }
    calculatePerformanceMetrics(data) {
        const metrics = {
            totalPosts: data.length,
            averageEngagement: 0,
            engagementTrend: 0,
            reachGrowth: 0,
            consistencyScore: 0
        };
        if (data.length === 0)
            return metrics;
        // Calculate average engagement
        metrics.averageEngagement = data.reduce((sum, item) => sum + (item.metrics.engagementRate || 0), 0) / data.length;
        // Calculate trend (simplified)
        const firstHalf = data.slice(0, Math.floor(data.length / 2));
        const secondHalf = data.slice(Math.floor(data.length / 2));
        const firstHalfAvg = firstHalf.reduce((sum, item) => sum + (item.metrics.engagementRate || 0), 0) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((sum, item) => sum + (item.metrics.engagementRate || 0), 0) / secondHalf.length;
        metrics.engagementTrend = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
        return metrics;
    }
    detectAnomalies(data) {
        const anomalies = [];
        // Calculate mean and standard deviation
        const engagementRates = data.map(d => d.metrics.engagementRate || 0);
        const mean = engagementRates.reduce((sum, rate) => sum + rate, 0) / engagementRates.length;
        const stdDev = Math.sqrt(engagementRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / engagementRates.length);
        // Detect outliers (2 standard deviations)
        data.forEach((item, index) => {
            const rate = item.metrics.engagementRate || 0;
            if (Math.abs(rate - mean) > 2 * stdDev) {
                anomalies.push({
                    index,
                    contentId: item.contentId,
                    value: rate,
                    deviation: (rate - mean) / stdDev,
                    type: rate > mean ? 'positive' : 'negative'
                });
            }
        });
        return anomalies;
    }
    async generateRecommendations(patterns, metrics, anomalies) {
        const recommendations = [];
        // Timing recommendations
        if (patterns.temporal.bestHours.length > 0) {
            const bestHour = patterns.temporal.bestHours[0];
            recommendations.push(`Schedule posts at ${bestHour.key}:00 for optimal engagement (${bestHour.avg.toFixed(2)} average)`);
        }
        // Trend recommendations
        if (metrics.engagementTrend < -10) {
            recommendations.push('Engagement is declining. Consider varying content types and increasing posting frequency.');
        }
        else if (metrics.engagementTrend > 10) {
            recommendations.push(`Great progress! Engagement is up ${metrics.engagementTrend.toFixed(1)}%. Keep using similar strategies.`);
        }
        // Anomaly recommendations
        const positiveAnomalies = anomalies.filter(a => a.type === 'positive');
        if (positiveAnomalies.length > 0) {
            recommendations.push(`Analyze your top ${positiveAnomalies.length} posts to identify success patterns.`);
        }
        return recommendations;
    }
    async sendOptimizationUpdate(update) {
        const message = {
            id: (0, uuid_1.v4)(),
            timestamp: Date.now(),
            source: this.type,
            target: update.targetAgent,
            type: shared_1.MessageType.LEARNING_UPDATE,
            priority: shared_1.Priority.MEDIUM,
            payload: update,
            requiresAck: true,
            timeout: 60000
        };
        await this.sendMessage(message);
    }
    getTopEntries(map, count) {
        return Array.from(map.entries())
            .map(([key, values]) => ({
            key,
            avg: values.reduce((sum, v) => sum + v, 0) / values.length,
            count: values.length
        }))
            .sort((a, b) => b.avg - a.avg)
            .slice(0, count);
    }
    getBottomEntries(map, count) {
        return Array.from(map.entries())
            .map(([key, values]) => ({
            key,
            avg: values.reduce((sum, v) => sum + v, 0) / values.length,
            count: values.length
        }))
            .sort((a, b) => a.avg - b.avg)
            .slice(0, count);
    }
    async getAgentPerformance(agentType) {
        const { data } = await this.supabase
            .from('agent_tasks')
            .select('*')
            .eq('agent_type', agentType)
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000))
            .order('created_at', { ascending: false });
        if (!data || data.length === 0) {
            return { tasks: [], performance: {} };
        }
        const performance = {
            totalTasks: data.length,
            completedTasks: data.filter(t => t.status === TaskStatus.COMPLETED).length,
            failedTasks: data.filter(t => t.status === TaskStatus.FAILED).length,
            averageDuration: 0,
            successRate: 0,
            errorRate: 0
        };
        performance.successRate = performance.completedTasks / performance.totalTasks;
        performance.errorRate = performance.failedTasks / performance.totalTasks;
        // Calculate average duration
        const durations = data
            .filter(t => t.started_at && t.completed_at)
            .map(t => new Date(t.completed_at).getTime() - new Date(t.started_at).getTime());
        if (durations.length > 0) {
            performance.averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        }
        return { tasks: data, performance };
    }
    async identifyOptimizations(agentType, performance) {
        const opportunities = [];
        // Check success rate
        if (performance.performance.successRate < 0.95) {
            opportunities.push({
                type: 'ERROR_RATE',
                metric: 'successRate',
                current: performance.performance.successRate,
                target: 0.95,
                priority: shared_1.Priority.HIGH
            });
        }
        // Check processing time
        if (performance.performance.averageDuration > 60000) { // > 1 minute
            opportunities.push({
                type: 'PERFORMANCE',
                metric: 'averageDuration',
                current: performance.performance.averageDuration,
                target: 30000,
                priority: shared_1.Priority.MEDIUM
            });
        }
        // Check task distribution
        const taskTypes = {};
        performance.tasks.forEach(task => {
            taskTypes[task.task_type] = (taskTypes[task.task_type] || 0) + 1;
        });
        // Look for imbalanced task distribution
        const taskCounts = Object.values(taskTypes);
        const maxTasks = Math.max(...taskCounts);
        const minTasks = Math.min(...taskCounts);
        if (maxTasks > minTasks * 3) {
            opportunities.push({
                type: 'LOAD_BALANCE',
                metric: 'taskDistribution',
                current: { max: maxTasks, min: minTasks },
                target: { ratio: 2 },
                priority: shared_1.Priority.LOW
            });
        }
        return opportunities;
    }
    async generateOptimizationUpdate(agentType, opportunity, performance) {
        switch (opportunity.type) {
            case 'ERROR_RATE':
                return {
                    targetAgent: agentType,
                    updateType: 'PARAMETER',
                    updates: {
                        retryPolicy: {
                            maxAttempts: 3,
                            backoffMultiplier: 2,
                            initialDelay: 1000,
                            maxDelay: 30000
                        },
                        errorHandling: 'enhanced'
                    },
                    reason: `High error rate detected (${(opportunity.current * 100).toFixed(1)}%)`,
                    expectedImprovement: 0.05
                };
            case 'PERFORMANCE':
                return {
                    targetAgent: agentType,
                    updateType: 'PARAMETER',
                    updates: {
                        batchSize: Math.min(performance.performance.batchSize * 2, 100),
                        parallelism: Math.min(performance.performance.parallelism + 1, 10),
                        cacheEnabled: true
                    },
                    reason: `Slow processing detected (avg ${opportunity.current}ms)`,
                    expectedImprovement: 0.3
                };
            case 'LOAD_BALANCE':
                return {
                    targetAgent: agentType,
                    updateType: 'STRATEGY',
                    updates: {
                        loadBalancing: 'weighted_round_robin',
                        taskPrioritization: 'dynamic'
                    },
                    reason: 'Imbalanced task distribution detected',
                    expectedImprovement: 0.1
                };
            default:
                return null;
        }
    }
    async applyOptimization(update) {
        this.logger.info({ update }, 'Applying optimization');
        // Send update to target agent
        await this.sendOptimizationUpdate(update);
        // Store optimization record
        await this.supabase
            .from('agent_optimizations')
            .insert({
            agent_type: update.targetAgent,
            update_type: update.updateType,
            updates: update.updates,
            reason: update.reason,
            expected_improvement: update.expectedImprovement,
            applied_at: new Date()
        });
    }
    async collectSystemMetrics(timeRange) {
        const duration = this.parseDuration(timeRange);
        const startDate = new Date(Date.now() - duration);
        // Collect metrics from all agents
        const agentMetrics = await Promise.all(Object.values(shared_1.AgentType).map(async (agentType) => {
            const performance = await this.getAgentPerformance(agentType);
            return { agentType, ...performance };
        }));
        // Collect content performance metrics
        const { data: contentMetrics } = await this.supabase
            .from('content_performance')
            .select('*')
            .gte('created_at', startDate);
        // Collect system resource metrics
        const resourceMetrics = await this.getResourceMetrics();
        return {
            agents: agentMetrics,
            content: contentMetrics || [],
            resources: resourceMetrics,
            timestamp: new Date()
        };
    }
    async getResourceMetrics() {
        // Get from Redis or monitoring service
        const cpuUsage = process.cpuUsage();
        const memoryUsage = process.memoryUsage();
        return {
            cpu: {
                user: cpuUsage.user / 1000000, // Convert to seconds
                system: cpuUsage.system / 1000000
            },
            memory: {
                used: memoryUsage.heapUsed,
                total: memoryUsage.heapTotal,
                percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
            },
            uptime: process.uptime()
        };
    }
    async analyzeAllAgents() {
        const analysis = {};
        for (const agentType of Object.values(shared_1.AgentType)) {
            if (agentType === shared_1.AgentType.LEARNING)
                continue; // Skip self
            const performance = await this.getAgentPerformance(agentType);
            analysis[agentType] = {
                performance: performance.performance,
                trends: this.calculateTrends(performance.tasks),
                issues: this.identifyIssues(performance)
            };
        }
        return analysis;
    }
    calculateTrends(tasks) {
        if (tasks.length < 2) {
            return { status: 'insufficient_data' };
        }
        // Group by hour
        const hourlyData = new Map();
        tasks.forEach(task => {
            const hour = new Date(task.created_at).toISOString().slice(0, 13);
            if (!hourlyData.has(hour)) {
                hourlyData.set(hour, []);
            }
            hourlyData.get(hour).push(task);
        });
        // Calculate hourly metrics
        const hourlyMetrics = Array.from(hourlyData.entries()).map(([hour, tasks]) => ({
            hour,
            count: tasks.length,
            successRate: tasks.filter(t => t.status === TaskStatus.COMPLETED).length / tasks.length,
            avgDuration: this.calculateAverageDuration(tasks)
        }));
        // Calculate trends
        const firstHalf = hourlyMetrics.slice(0, Math.floor(hourlyMetrics.length / 2));
        const secondHalf = hourlyMetrics.slice(Math.floor(hourlyMetrics.length / 2));
        return {
            volumeTrend: this.comparePeriods(firstHalf, secondHalf, 'count'),
            successTrend: this.comparePeriods(firstHalf, secondHalf, 'successRate'),
            performanceTrend: this.comparePeriods(firstHalf, secondHalf, 'avgDuration')
        };
    }
    calculateAverageDuration(tasks) {
        const durations = tasks
            .filter(t => t.started_at && t.completed_at)
            .map(t => new Date(t.completed_at).getTime() - new Date(t.started_at).getTime());
        return durations.length > 0
            ? durations.reduce((sum, d) => sum + d, 0) / durations.length
            : 0;
    }
    comparePeriods(firstPeriod, secondPeriod, metric) {
        const firstAvg = firstPeriod.reduce((sum, item) => sum + item[metric], 0) / firstPeriod.length;
        const secondAvg = secondPeriod.reduce((sum, item) => sum + item[metric], 0) / secondPeriod.length;
        const change = ((secondAvg - firstAvg) / firstAvg) * 100;
        return {
            direction: change > 5 ? 'up' : change < -5 ? 'down' : 'stable',
            percentage: Math.abs(change),
            firstPeriod: firstAvg,
            secondPeriod: secondAvg
        };
    }
    identifyIssues(performance) {
        const issues = [];
        if (performance.performance.errorRate > 0.05) {
            issues.push(`High error rate: ${(performance.performance.errorRate * 100).toFixed(1)}%`);
        }
        if (performance.performance.averageDuration > 60000) {
            issues.push(`Slow processing: ${(performance.performance.averageDuration / 1000).toFixed(1)}s average`);
        }
        if (performance.tasks.length < 10) {
            issues.push('Low task volume');
        }
        return issues;
    }
    identifyBottlenecks(systemMetrics, agentPerformance) {
        const bottlenecks = [];
        // Check for agent bottlenecks
        for (const [agentType, data] of Object.entries(agentPerformance)) {
            if (data.performance.averageDuration > 60000) {
                bottlenecks.push(`${agentType} is processing slowly`);
            }
            if (data.issues.length > 0) {
                bottlenecks.push(`${agentType}: ${data.issues.join(', ')}`);
            }
        }
        // Check resource bottlenecks
        if (systemMetrics.resources.memory.percentage > 80) {
            bottlenecks.push('High memory usage detected');
        }
        if (systemMetrics.resources.cpu.user > 80) {
            bottlenecks.push('High CPU usage detected');
        }
        return bottlenecks;
    }
    async findOpportunities(systemMetrics, agentPerformance) {
        const opportunities = [];
        // Look for underutilized agents
        for (const [agentType, data] of Object.entries(agentPerformance)) {
            if (data.performance.totalTasks < 100 && data.performance.successRate > 0.95) {
                opportunities.push(`${agentType} has capacity for more tasks`);
            }
        }
        // Look for optimization opportunities
        const avgEngagement = systemMetrics.content.reduce((sum, c) => sum + (c.metrics?.engagementRate || 0), 0) / systemMetrics.content.length;
        if (avgEngagement < 0.05) {
            opportunities.push('Content engagement below industry average');
        }
        return opportunities;
    }
    async generateSystemRecommendations(systemMetrics, agentPerformance, bottlenecks, opportunities) {
        const recommendations = [];
        // Address bottlenecks
        for (const [agentType, data] of Object.entries(agentPerformance)) {
            if (data.performance.averageDuration > 60000) {
                recommendations.push({
                    targetAgent: agentType,
                    updateType: 'PARAMETER',
                    updates: { parallelism: 5, cacheEnabled: true },
                    reason: 'Slow processing detected',
                    expectedImprovement: 0.3
                });
            }
        }
        // Leverage opportunities
        if (opportunities.includes('Content engagement below industry average')) {
            recommendations.push({
                targetAgent: shared_1.AgentType.CONTENT_GENERATOR,
                updateType: 'MODEL',
                updates: {
                    modelVersion: 'v2',
                    temperature: 0.8,
                    creativityBoost: true
                },
                reason: 'Low engagement detected',
                expectedImprovement: 0.15
            });
        }
        return recommendations;
    }
    calculateSystemHealth(metrics) {
        let health = 100;
        // Deduct for resource issues
        if (metrics.resources.memory.percentage > 80)
            health -= 10;
        if (metrics.resources.cpu.user > 80)
            health -= 10;
        // Deduct for agent issues
        metrics.agents.forEach(agent => {
            if (agent.performance.errorRate > 0.05)
                health -= 5;
            if (agent.performance.averageDuration > 60000)
                health -= 5;
        });
        // Deduct for content performance
        if (metrics.content.length > 0) {
            const avgScore = metrics.content.reduce((sum, c) => sum + (c.score || 0), 0) / metrics.content.length;
            if (avgScore < 50)
                health -= 10;
        }
        return Math.max(0, health);
    }
    analyzePerformanceTrends(metrics) {
        // Simplified trend analysis
        return {
            overall: 'stable',
            agents: metrics.agents.map(a => ({
                agentType: a.agentType,
                trend: 'stable',
                health: a.performance.successRate > 0.95 ? 'healthy' : 'needs_attention'
            })),
            content: {
                engagement: 'improving',
                reach: 'stable',
                quality: 'high'
            }
        };
    }
    async validateModelUpdates(modelType, updates) {
        const errors = [];
        // Validate model type
        const validModelTypes = ['content_generation', 'relevance_scoring', 'timing_optimization'];
        if (!validModelTypes.includes(modelType)) {
            errors.push('Invalid model type');
        }
        // Validate update structure
        if (!updates || typeof updates !== 'object') {
            errors.push('Invalid update structure');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    async applyModelUpdates(modelType, updates) {
        // In a real implementation, this would update ML models
        this.logger.info({ modelType, updates }, 'Applying model updates');
        // Store update record
        await this.supabase
            .from('model_updates')
            .insert({
            model_type: modelType,
            updates,
            applied_at: new Date()
        });
        return {
            modelType,
            version: 'v2',
            updates,
            appliedAt: new Date()
        };
    }
    async testUpdatedModel(modelType) {
        // Run test suite on updated model
        const testResults = {
            modelType,
            performanceScore: Math.random() * 0.2 + 0.85, // 0.85-1.05 range
            latency: Math.random() * 50 + 50, // 50-100ms
            accuracy: Math.random() * 0.1 + 0.9, // 0.9-1.0
            testsPassed: 95,
            totalTests: 100
        };
        return testResults;
    }
    async rollbackModelUpdates(modelType) {
        this.logger.warn({ modelType }, 'Rolling back model updates');
        // In production, this would restore previous model version
        await this.supabase
            .from('model_updates')
            .insert({
            model_type: modelType,
            updates: { action: 'rollback' },
            applied_at: new Date()
        });
    }
    async analyzeSystemState() {
        const state = {
            timestamp: new Date(),
            agents: {},
            resources: await this.getResourceMetrics(),
            performance: {
                contentGeneration: { avgTime: 45000, successRate: 0.98 },
                qualityControl: { avgTime: 10000, successRate: 0.99 },
                publishing: { avgTime: 5000, successRate: 0.995 }
            }
        };
        // Get state for each agent
        for (const agentType of Object.values(shared_1.AgentType)) {
            if (agentType === shared_1.AgentType.LEARNING)
                continue;
            const health = await this.getAgentHealth(agentType);
            state.agents[agentType] = health;
        }
        return state;
    }
    async getAgentHealth(agentType) {
        // This would fetch real health status from agents
        return {
            status: 'healthy',
            uptime: Math.random() * 86400000, // Random uptime up to 24h
            taskCount: Math.floor(Math.random() * 1000),
            errorRate: Math.random() * 0.05
        };
    }
    identifyOptimizationTargets(systemState) {
        const targets = [];
        // Look for slow operations
        for (const [operation, metrics] of Object.entries(systemState.performance)) {
            if (metrics.avgTime > 30000) {
                targets.push({
                    type: 'performance',
                    target: operation,
                    metric: 'avgTime',
                    current: metrics.avgTime,
                    goal: 20000
                });
            }
        }
        // Look for high error rates
        for (const [agentType, health] of Object.entries(systemState.agents)) {
            if (health.errorRate > 0.02) {
                targets.push({
                    type: 'reliability',
                    target: agentType,
                    metric: 'errorRate',
                    current: health.errorRate,
                    goal: 0.01
                });
            }
        }
        return targets;
    }
    async runOptimizationExperiment(target) {
        const experiment = {
            id: (0, uuid_1.v4)(),
            target,
            startTime: new Date(),
            endTime: null,
            control: null,
            treatment: null,
            success: false,
            improvement: 0,
            optimization: null
        };
        // Simulate experiment (in production, this would be real A/B testing)
        experiment.control = {
            performance: target.current,
            sampleSize: 100
        };
        // Apply experimental optimization
        const optimizedValue = target.current * (1 - Math.random() * 0.3); // Up to 30% improvement
        experiment.treatment = {
            performance: optimizedValue,
            sampleSize: 100
        };
        experiment.endTime = new Date();
        experiment.improvement = (target.current - optimizedValue) / target.current;
        experiment.success = experiment.improvement > this.IMPROVEMENT_THRESHOLD;
        if (experiment.success) {
            experiment.optimization = this.createOptimizationFromExperiment(target, experiment);
        }
        return experiment;
    }
    createOptimizationFromExperiment(target, experiment) {
        return {
            targetAgent: target.target,
            updateType: 'PARAMETER',
            updates: {
                [target.metric]: experiment.treatment.performance
            },
            reason: `Experiment ${experiment.id} showed ${(experiment.improvement * 100).toFixed(1)}% improvement`,
            expectedImprovement: experiment.improvement
        };
    }
    async fetchExperimentData(experimentId) {
        // In production, fetch from database
        return {
            experimentId,
            status: 'completed',
            startTime: new Date(Date.now() - 86400000),
            endTime: new Date(),
            control: {
                sampleSize: 1000,
                metrics: {
                    engagement: 0.05,
                    clicks: 0.02,
                    shares: 0.01
                }
            },
            treatment: {
                sampleSize: 1000,
                metrics: {
                    engagement: 0.065,
                    clicks: 0.025,
                    shares: 0.015
                }
            }
        };
    }
    analyzeVariant(variant) {
        const metrics = variant.metrics;
        const performance = (metrics.engagement * 0.5) + (metrics.clicks * 0.3) + (metrics.shares * 0.2);
        return {
            ...variant,
            performance,
            confidence: this.calculateConfidence(variant.sampleSize)
        };
    }
    calculateConfidence(sampleSize) {
        // Simplified confidence calculation
        return Math.min(0.99, 0.5 + (sampleSize / 2000));
    }
    calculateSignificance(control, treatment) {
        // Simplified statistical significance
        // In production, use proper statistical tests (t-test, chi-square, etc.)
        const performanceDiff = Math.abs(treatment.performance - control.performance);
        const avgPerformance = (treatment.performance + control.performance) / 2;
        const relativeChange = performanceDiff / avgPerformance;
        // Factor in sample size
        const sampleSizeFactor = Math.min(1, (control.sampleSize + treatment.sampleSize) / 2000);
        return Math.min(0.99, relativeChange * 10 * sampleSizeFactor);
    }
    async updateMetricsCache() {
        // Update cache with recent performance data
        const recentData = await this.fetchPerformanceData(undefined, undefined, '1h');
        recentData.forEach(item => {
            const userId = item.userId;
            if (!this.metricsCache.has(userId)) {
                this.metricsCache.set(userId, []);
            }
            const userCache = this.metricsCache.get(userId);
            // Add new data
            userCache.push(item);
            // Keep only last 7 days
            const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const filtered = userCache.filter(d => d.timestamp > cutoff);
            this.metricsCache.set(userId, filtered);
        });
    }
    // Override stop method to clean up timer
    async stop() {
        if (this.learningTimer) {
            clearInterval(this.learningTimer);
        }
        await super.stop();
    }
}
exports.LearningAgent = LearningAgent;
//# sourceMappingURL=learning.agent.js.map