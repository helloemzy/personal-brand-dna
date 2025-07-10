import { withAuth } from '../_lib/auth';
import { supabase } from '../_lib/database';
import { rateLimiter } from '../_lib/rateLimiter';
import { 
  standardizedAsyncHandler, 
  createSuccessResponse, 
  createError,
  validateMethod,
  validateRequestBody
} from '../_lib/standardizedErrorHandler';

/**
 * POST /api/workshop/save-progress
 * Auto-save workshop progress
 * 
 * Features:
 * - Rate limiting to prevent spam
 * - Incremental updates
 * - Conflict resolution
 * - Progress tracking
 */
const saveProgressHandler = async (req, res) => {
  // Rate limit auto-saves (max 30 per minute per user)
  const rateLimitResult = await rateLimiter.check(req, 30, 'save-progress');
  if (!rateLimitResult.success) {
    throw createError.rateLimited(rateLimitResult.retryAfter);
  }

  // Authenticate user
  const user = await withAuth(req, res);
  if (!user) {
    throw createError.unauthorized();
  }

  const { 
    sessionId, 
    workshopData, 
    currentStep, 
    completedSteps,
    syncVersion = 1,
    localChanges = {}
  } = req.body;

  // Validate session ownership
  const { data: existingSession, error: fetchError } = await supabase
    .from('workshop_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') { // Not found error
    console.error('Error fetching session:', fetchError);
    throw createError.external('Database');
  }

  // Calculate progress percentage
  const totalSteps = 5; // Values, Tone, Audience, Writing, Personality
  const progressPercentage = Math.round((completedSteps?.length || 0) / totalSteps * 100);

    // Prepare session data
    const sessionData = {
      id: sessionId,
      user_id: user.id,
      workshop_data: workshopData,
      current_step: currentStep,
      completed_steps: completedSteps || [],
      progress_percentage: progressPercentage,
      sync_version: syncVersion,
      local_changes: localChanges,
      last_saved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: progressPercentage === 100 ? 'ready_for_completion' : 'in_progress'
    };

    // Handle conflict resolution
    if (existingSession && existingSession.sync_version >= syncVersion) {
      // Potential conflict - merge changes
      console.log('Sync conflict detected, merging changes...');
      
      // Merge workshop data (local changes take precedence)
      const mergedData = {
        ...existingSession.workshop_data,
        ...workshopData
      };
      
      sessionData.workshop_data = mergedData;
      sessionData.sync_version = existingSession.sync_version + 1;
      sessionData.conflict_resolved_at = new Date().toISOString();
    }

    // Upsert session data
    const { data: savedSession, error: saveError } = await supabase
      .from('workshop_sessions')
      .upsert(sessionData, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving progress:', saveError);
      return res.status(500).json({ error: 'Failed to save progress' });
    }

    // Create a checkpoint if significant progress made
    if (completedSteps?.length > 0 && progressPercentage % 20 === 0) {
      // Save checkpoint for recovery
      await supabase
        .from('workshop_checkpoints')
        .insert({
          session_id: sessionId,
          user_id: user.id,
          checkpoint_data: workshopData,
          step_number: currentStep,
          created_at: new Date().toISOString()
        });
    }

    // Track save event for analytics
    if (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) {
      // Simplified tracking - in production use proper GA API
      console.log('Progress saved:', {
        userId: user.id,
        sessionId,
        currentStep,
        progressPercentage
      });
    }

    // Return standardized success response
    return res.status(200).json(createSuccessResponse({
      sessionId,
      syncVersion: savedSession.sync_version,
      progressPercentage,
      lastSavedAt: savedSession.last_saved_at,
      status: savedSession.status
    }, 'Progress saved successfully'));
};

// Export with standardized middleware chain
export default standardizedAsyncHandler(
  validateMethod(['POST'])(
    validateRequestBody([
      'sessionId',
      'workshopData'
    ], [
      'currentStep',
      'completedSteps',
      'syncVersion',
      'localChanges'
    ])(saveProgressHandler)
  )
);