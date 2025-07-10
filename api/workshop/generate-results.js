import { withAuth } from '../_lib/auth';
import { errorHandler } from '../_lib/errorHandler';
import { supabase } from '../_lib/database';
import { 
  generateEnhancedMission 
} from '../../src/services/aiAnalysisService';
import { 
  generateStarterContent 
} from '../../src/services/contentPillarService';
import { 
  generateUVPContentHooks 
} from '../../src/services/uvpConstructorService';
import { generateActionableContent } from '../../src/services/linkedinHeadlineService';

/**
 * POST /api/workshop/generate-results
 * Generate additional results or regenerate specific sections
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

    const { resultId, regenerate, options = {} } = req.body;
    
    if (!resultId) {
      return res.status(400).json({ error: 'Missing result ID' });
    }

    // Fetch existing results
    const { data: existingResult, error: fetchError } = await supabase
      .from('workshop_results')
      .select('*')
      .eq('id', resultId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existingResult) {
      return res.status(404).json({ error: 'Results not found' });
    }

    const results = existingResult.results;
    const updatedSections = {};

    // Regenerate requested sections
    if (regenerate?.includes('missions')) {
      console.log('Regenerating mission statements...');
      
      // Fetch workshop data
      const { data: session } = await supabase
        .from('workshop_sessions')
        .select('workshop_data')
        .eq('id', existingResult.session_id)
        .single();

      if (session?.workshop_data) {
        const newMissions = await generateEnhancedMission(
          session.workshop_data,
          results.archetype.primary.archetype,
          results.aiAnalysis.writing,
          results.aiAnalysis.personality
        );
        
        updatedSections.missions = newMissions;
      }
    }

    if (regenerate?.includes('content')) {
      console.log('Regenerating content ideas...');
      
      // Fetch workshop data if not already fetched
      const { data: session } = await supabase
        .from('workshop_sessions')
        .select('workshop_data')
        .eq('id', existingResult.session_id)
        .single();

      if (session?.workshop_data && results.contentPillars) {
        const newContent = await generateStarterContent(
          session.workshop_data,
          results.archetype.primary.archetype,
          results.contentPillars
        );
        
        updatedSections.starterContent = newContent;
      }
    }

    if (regenerate?.includes('headlines')) {
      console.log('Regenerating LinkedIn headlines...');
      
      // Generate new headline variations
      if (results.actionableContent?.linkedinHeadlines) {
        // Fetch workshop data if needed
        const { data: session } = await supabase
          .from('workshop_sessions')
          .select('workshop_data')
          .eq('id', existingResult.session_id)
          .single();

        if (session?.workshop_data) {
          const newActionableContent = await generateActionableContent(
            session.workshop_data,
            results.uvp,
            results.contentPillars
          );
          
          updatedSections.linkedinHeadlines = newActionableContent.linkedinHeadlines;
        }
      }
    }

    if (regenerate?.includes('uvp')) {
      console.log('Regenerating UVP hooks...');
      
      if (results.uvp) {
        const newHooks = await generateUVPContentHooks(
          results.uvp,
          results.archetype.primary.archetype
        );
        
        updatedSections.uvpHooks = newHooks;
      }
    }

    // Apply any custom generation options
    if (options.generateAdditionalContent) {
      // Generate extra content based on specific parameters
      console.log('Generating additional content with options:', options);
      
      if (options.contentType === 'posts' && options.topic) {
        // Generate specific post ideas for a topic
        const { data: session } = await supabase
          .from('workshop_sessions')
          .select('workshop_data')
          .eq('id', existingResult.session_id)
          .single();

        if (session?.workshop_data) {
          // This would call a specialized content generation function
          updatedSections.additionalContent = {
            type: 'posts',
            topic: options.topic,
            ideas: [] // Would be populated by actual generation
          };
        }
      }
    }

    // Update results in database
    if (Object.keys(updatedSections).length > 0) {
      const updatedResults = {
        ...results,
        ...updatedSections,
        metadata: {
          ...results.metadata,
          lastRegenerated: new Date().toISOString(),
          regenerationCount: (results.metadata.regenerationCount || 0) + 1
        }
      };

      const { error: updateError } = await supabase
        .from('workshop_results')
        .update({
          results: updatedResults,
          updated_at: new Date().toISOString()
        })
        .eq('id', resultId);

      if (updateError) {
        console.error('Error updating results:', updateError);
        return res.status(500).json({ error: 'Failed to update results' });
      }

      return res.status(200).json({
        success: true,
        updatedSections: Object.keys(updatedSections),
        results: updatedResults
      });
    } else {
      return res.status(200).json({
        success: true,
        message: 'No sections to regenerate',
        results
      });
    }

  } catch (error) {
    console.error('Error generating results:', error);
    return errorHandler(error, req, res);
  }
}