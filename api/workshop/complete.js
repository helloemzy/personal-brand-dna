import { withAuth } from '../_lib/auth';
import { errorHandler } from '../_lib/errorHandler';
import { supabase } from '../_lib/database';
import { 
  determineArchetype, 
  generateMissionStatement 
} from '../../src/services/archetypeService';
import { 
  analyzeWritingWithAI,
  analyzePersonalityWithAI,
  generateEnhancedMission
} from '../../src/services/aiAnalysisService';
import { 
  mapContentPillars, 
  generateStarterContent 
} from '../../src/services/contentPillarService';
import { 
  constructUVP, 
  generateUVPContentHooks 
} from '../../src/services/uvpConstructorService';
import { generateActionableContent } from '../../src/services/linkedinHeadlineService';

/**
 * POST /api/workshop/complete
 * Process a completed workshop and generate comprehensive results
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate user
    const user = await withAuth(req, res);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate workshop data
    const { workshopData, sessionId } = req.body;
    
    if (!workshopData || !sessionId) {
      return res.status(400).json({ error: 'Missing workshop data or session ID' });
    }

    // Validate required workshop fields
    const requiredFields = ['values', 'tonePreferences', 'audiencePersonas', 'writingSample', 'personalityQuiz'];
    const missingFields = requiredFields.filter(field => !workshopData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: 'Incomplete workshop data',
        missingFields 
      });
    }

    console.log(`Processing workshop completion for user ${user.id}, session ${sessionId}`);

    // Start processing timer
    const startTime = Date.now();

    // 1. Save workshop data to database
    const { error: saveError } = await supabase
      .from('workshop_sessions')
      .upsert({
        id: sessionId,
        user_id: user.id,
        workshop_data: workshopData,
        status: 'processing',
        updated_at: new Date().toISOString()
      });

    if (saveError) {
      console.error('Error saving workshop data:', saveError);
      return res.status(500).json({ error: 'Failed to save workshop data' });
    }

    // 2. Determine archetype
    const archetypeResult = await determineArchetype(workshopData);
    
    // 3. Perform AI analysis
    const [writingAnalysis, personalityAnalysis] = await Promise.all([
      analyzeWritingWithAI(workshopData.writingSample, workshopData.personalityQuiz),
      analyzePersonalityWithAI(workshopData.personalityQuiz)
    ]);

    // 4. Generate enhanced mission statements
    const missionStatements = await generateEnhancedMission(
      workshopData,
      archetypeResult.primary.archetype,
      writingAnalysis,
      personalityAnalysis
    );

    // 5. Map content pillars
    const contentPillars = await mapContentPillars(workshopData);
    const starterContent = await generateStarterContent(
      workshopData, 
      archetypeResult.primary.archetype, 
      contentPillars
    );

    // 6. Construct UVP
    const uvpAnalysis = await constructUVP(workshopData);
    const uvpHooks = await generateUVPContentHooks(uvpAnalysis, archetypeResult.primary.archetype);

    // 7. Generate actionable content
    const actionableContent = await generateActionableContent(workshopData, uvpAnalysis, contentPillars);

    // 8. Calculate processing time
    const processingTime = Date.now() - startTime;

    // 9. Compile results
    const results = {
      id: `result_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      sessionId,
      userId: user.id,
      archetype: archetypeResult,
      aiAnalysis: {
        writing: writingAnalysis,
        personality: personalityAnalysis
      },
      missions: missionStatements,
      contentPillars: {
        ...contentPillars,
        starterContent
      },
      uvp: {
        ...uvpAnalysis,
        hooks: uvpHooks
      },
      actionableContent,
      metadata: {
        processingTime,
        completedAt: new Date().toISOString(),
        version: '1.0'
      }
    };

    // 10. Save results to database
    const { error: resultsError } = await supabase
      .from('workshop_results')
      .insert({
        id: results.id,
        session_id: sessionId,
        user_id: user.id,
        results: results,
        created_at: new Date().toISOString()
      });

    if (resultsError) {
      console.error('Error saving results:', resultsError);
      // Don't fail the request, just log the error
    }

    // 11. Update session status
    await supabase
      .from('workshop_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result_id: results.id
      })
      .eq('id', sessionId);

    // 12. Track analytics event
    if (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) {
      // Track workshop completion (simplified - in production use proper GA API)
      console.log('Workshop completed:', {
        userId: user.id,
        archetype: archetypeResult.primary.archetype,
        processingTime
      });
    }

    // Return successful response
    return res.status(200).json({
      success: true,
      resultId: results.id,
      results,
      processingTime
    });

  } catch (error) {
    console.error('Error processing workshop completion:', error);
    return errorHandler(error, req, res);
  }
}