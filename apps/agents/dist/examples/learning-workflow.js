"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runLearningWorkflow = runLearningWorkflow;
const shared_1 = require("@brandpillar/shared");
const queue_1 = require("@brandpillar/queue");
const uuid_1 = require("uuid");
/**
 * Example workflow demonstrating the Learning Agent capabilities
 *
 * This workflow shows how the Learning Agent:
 * 1. Analyzes performance data across all agents
 * 2. Identifies optimization opportunities
 * 3. Generates insights and recommendations
 * 4. Updates other agents with optimizations
 * 5. Monitors the impact of changes
 */
async function runLearningWorkflow() {
    const messageBus = new queue_1.RabbitMQMessageBus({
        url: process.env.CLOUDAMQP_URL || 'amqp://localhost',
        exchangeName: 'brandpillar.agents'
    });
    await messageBus.connect();
    try {
        console.log('🎯 Starting Learning Agent Workflow\n');
        // Step 1: Request performance analysis
        console.log('📊 Step 1: Requesting performance analysis...');
        const analysisMessage = {
            id: (0, uuid_1.v4)(),
            timestamp: Date.now(),
            source: shared_1.AgentType.ORCHESTRATOR,
            target: shared_1.AgentType.LEARNING,
            type: shared_1.MessageType.TASK_REQUEST,
            priority: shared_1.Priority.MEDIUM,
            payload: {
                taskType: 'ANALYZE_PERFORMANCE',
                data: {
                    timeRange: '7d',
                    agentType: shared_1.AgentType.CONTENT_GENERATOR
                }
            },
            requiresAck: true,
            timeout: 60000
        };
        await messageBus.publish(analysisMessage);
        console.log('✅ Performance analysis requested\n');
        // Simulate waiting for results
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Step 2: Request system insights
        console.log('🔍 Step 2: Requesting system insights...');
        const insightsMessage = {
            id: (0, uuid_1.v4)(),
            timestamp: Date.now(),
            source: shared_1.AgentType.ORCHESTRATOR,
            target: shared_1.AgentType.LEARNING,
            type: shared_1.MessageType.TASK_REQUEST,
            priority: shared_1.Priority.MEDIUM,
            payload: {
                taskType: 'GENERATE_INSIGHTS',
                data: {
                    timeRange: '30d'
                }
            },
            requiresAck: true,
            timeout: 60000
        };
        await messageBus.publish(insightsMessage);
        console.log('✅ System insights requested\n');
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Step 3: Request agent optimization
        console.log('⚡ Step 3: Requesting agent optimization...');
        const optimizationMessage = {
            id: (0, uuid_1.v4)(),
            timestamp: Date.now(),
            source: shared_1.AgentType.ORCHESTRATOR,
            target: shared_1.AgentType.LEARNING,
            type: shared_1.MessageType.TASK_REQUEST,
            priority: shared_1.Priority.HIGH,
            payload: {
                taskType: 'OPTIMIZE_AGENT',
                data: {
                    agentType: shared_1.AgentType.CONTENT_GENERATOR
                }
            },
            requiresAck: true,
            timeout: 60000
        };
        await messageBus.publish(optimizationMessage);
        console.log('✅ Agent optimization requested\n');
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Step 4: Run system-wide optimization
        console.log('🚀 Step 4: Running system-wide optimization...');
        const systemOptMessage = {
            id: (0, uuid_1.v4)(),
            timestamp: Date.now(),
            source: shared_1.AgentType.ORCHESTRATOR,
            target: shared_1.AgentType.LEARNING,
            type: shared_1.MessageType.TASK_REQUEST,
            priority: shared_1.Priority.HIGH,
            payload: {
                taskType: 'SYSTEM_OPTIMIZATION',
                data: {}
            },
            requiresAck: true,
            timeout: 120000
        };
        await messageBus.publish(systemOptMessage);
        console.log('✅ System optimization initiated\n');
        await new Promise(resolve => setTimeout(resolve, 3000));
        // Step 5: Analyze an experiment
        console.log('🧪 Step 5: Analyzing A/B test experiment...');
        const experimentMessage = {
            id: (0, uuid_1.v4)(),
            timestamp: Date.now(),
            source: shared_1.AgentType.ORCHESTRATOR,
            target: shared_1.AgentType.LEARNING,
            type: shared_1.MessageType.TASK_REQUEST,
            priority: shared_1.Priority.MEDIUM,
            payload: {
                taskType: 'EXPERIMENT_ANALYSIS',
                data: {
                    experimentId: 'exp_' + (0, uuid_1.v4)()
                }
            },
            requiresAck: true,
            timeout: 60000
        };
        await messageBus.publish(experimentMessage);
        console.log('✅ Experiment analysis requested\n');
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Step 6: Update models based on learnings
        console.log('🔧 Step 6: Updating ML models...');
        const modelUpdateMessage = {
            id: (0, uuid_1.v4)(),
            timestamp: Date.now(),
            source: shared_1.AgentType.ORCHESTRATOR,
            target: shared_1.AgentType.LEARNING,
            type: shared_1.MessageType.TASK_REQUEST,
            priority: shared_1.Priority.MEDIUM,
            payload: {
                taskType: 'UPDATE_MODELS',
                data: {
                    modelType: 'content_generation',
                    updates: {
                        temperature: 0.8,
                        top_p: 0.95,
                        frequency_penalty: 0.3,
                        presence_penalty: 0.2
                    }
                }
            },
            requiresAck: true,
            timeout: 90000
        };
        await messageBus.publish(modelUpdateMessage);
        console.log('✅ Model update requested\n');
        console.log('🎉 Learning workflow completed!\n');
        console.log('Expected outcomes:');
        console.log('- Performance metrics analyzed and patterns identified');
        console.log('- System-wide insights generated with recommendations');
        console.log('- Specific agents optimized based on performance data');
        console.log('- Experiments analyzed for statistical significance');
        console.log('- ML models updated with improved parameters');
        console.log('- All agents now operating with optimized settings\n');
        // Show example optimization update that would be sent to other agents
        console.log('📤 Example optimization update sent to Content Generator:');
        const exampleUpdate = {
            targetAgent: shared_1.AgentType.CONTENT_GENERATOR,
            updateType: 'PARAMETER',
            updates: {
                batchSize: 10,
                parallelism: 5,
                cacheEnabled: true,
                modelParameters: {
                    temperature: 0.8,
                    creativityBoost: true
                }
            },
            reason: 'Low engagement detected in recent content',
            expectedImprovement: 0.15
        };
        console.log(JSON.stringify(exampleUpdate, null, 2));
    }
    catch (error) {
        console.error('❌ Error in learning workflow:', error);
    }
    finally {
        await messageBus.disconnect();
    }
}
// Run the workflow if this file is executed directly
if (require.main === module) {
    runLearningWorkflow().catch(console.error);
}
//# sourceMappingURL=learning-workflow.js.map