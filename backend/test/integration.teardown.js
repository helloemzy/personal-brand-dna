const { Pool } = require('pg');
const redis = require('redis');

module.exports = async () => {
  console.log('\n🧹 Cleaning up integration test environment...\n');

  try {
    // Clean up test database
    const pool = new Pool({
      connectionString: 'postgresql://postgres:postgres@localhost:5432/pbdna_test'
    });

    // Clean up test data (keep schema)
    await pool.query(`
      TRUNCATE TABLE 
        users, 
        workshop_sessions,
        workshop_values,
        workshop_tone_preferences,
        workshop_audience_personas,
        workshop_writing_samples,
        workshop_quiz_responses,
        workshop_analysis_results,
        news_sources,
        news_articles,
        article_relevance_scores,
        content_ideas,
        user_article_interactions,
        user_news_preferences,
        calendar_events,
        calendar_event_series,
        content_series,
        content_slots,
        linkedin_oauth_tokens,
        linkedin_publishing_queue,
        linkedin_post_analytics
      CASCADE
    `);

    await pool.end();
    console.log('✅ Test database cleaned\n');

    // Clean up Redis test data
    const redisClient = redis.createClient({
      url: 'redis://localhost:6379/2'
    });

    await redisClient.connect();
    await redisClient.flushDb();
    await redisClient.quit();
    console.log('✅ Redis test cache cleared\n');

  } catch (error) {
    console.error('Error during cleanup:', error);
  }

  console.log('✅ Integration test cleanup completed\n');
};