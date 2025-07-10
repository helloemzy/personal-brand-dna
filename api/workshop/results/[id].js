import { withAuth } from '../../_lib/auth';
import { errorHandler } from '../../_lib/errorHandler';
import { supabase } from '../../_lib/database';

/**
 * GET /api/workshop/results/:id
 * Retrieve workshop results by ID
 * 
 * Supports both authenticated (full data) and public (limited data) access
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: 'Missing result ID' });
    }

    // Check if this is a public share request
    const isPublicRequest = req.headers['x-public-access'] === 'true';
    
    // Try to authenticate user (optional for public shares)
    let user = null;
    try {
      user = await withAuth(req, res, { optional: true });
    } catch (error) {
      // Auth failed, but that's ok for public requests
      if (!isPublicRequest) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    // Fetch results based on ID type
    let results = null;
    let isOwner = false;

    // Check if it's a share code (8 characters)
    if (id.length === 8) {
      // This is likely a share code
      const { data: shareData, error: shareError } = await supabase
        .from('shared_results')
        .select('*')
        .eq('share_code', id)
        .single();

      if (shareError || !shareData) {
        return res.status(404).json({ error: 'Results not found' });
      }

      // Check if share has expired
      if (shareData.expires_at && new Date(shareData.expires_at) < new Date()) {
        return res.status(410).json({ error: 'Share link has expired' });
      }

      // Track share view
      await supabase
        .from('shared_results')
        .update({
          view_count: (shareData.view_count || 0) + 1,
          last_viewed_at: new Date().toISOString()
        })
        .eq('share_code', id);

      results = shareData.results;
      isOwner = user && shareData.user_id === user.id;

    } else {
      // This is a direct result ID
      const query = supabase
        .from('workshop_results')
        .select('*')
        .eq('id', id);

      // If user is authenticated, ensure they own the results
      if (user && !isPublicRequest) {
        query.eq('user_id', user.id);
      }

      const { data: resultData, error: resultError } = await query.single();

      if (resultError || !resultData) {
        return res.status(404).json({ error: 'Results not found' });
      }

      results = resultData.results;
      isOwner = user && resultData.user_id === user.id;
    }

    // If not the owner and not a public request, limit the data
    if (!isOwner && !isPublicRequest) {
      // Return limited public data
      const publicResults = {
        archetype: {
          primary: {
            archetype: results.archetype?.primary?.archetype,
            score: results.archetype?.primary?.score,
            description: results.archetype?.primary?.description
          }
        },
        missions: results.missions?.slice(0, 1), // Only first mission
        contentPillars: {
          expertise: {
            name: results.contentPillars?.expertise?.name,
            percentage: results.contentPillars?.expertise?.percentage
          },
          experience: {
            name: results.contentPillars?.experience?.name,
            percentage: results.contentPillars?.experience?.percentage
          },
          evolution: {
            name: results.contentPillars?.evolution?.name,
            percentage: results.contentPillars?.evolution?.percentage
          }
        },
        uvp: {
          primary: results.uvp?.primary
        },
        metadata: {
          completedAt: results.metadata?.completedAt
        }
      };

      return res.status(200).json({
        success: true,
        results: publicResults,
        isPublic: true,
        isOwner: false
      });
    }

    // Return full results for owner
    return res.status(200).json({
      success: true,
      results,
      isOwner,
      canEdit: isOwner,
      canRegenerate: isOwner
    });

  } catch (error) {
    console.error('Error retrieving results:', error);
    return errorHandler(error, req, res);
  }
}