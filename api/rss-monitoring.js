import { createClient } from '@supabase/supabase-js';
import Parser from 'rss-parser';
import { google } from 'googleapis';
import OpenAI from 'openai';
import crypto from 'crypto';

// Initialize services
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const rssParser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media'],
      ['media:thumbnail', 'thumbnail'],
      ['category', 'categories', { keepArray: true }]
    ]
  }
});

// Google Alerts custom search (if using Google Custom Search API)
const customsearch = google.customsearch('v1');

export default async function handler(req, res) {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Route to appropriate handler
    if (pathname.endsWith('/add-feed')) {
      return await handleAddFeed(req, res);
    } else if (pathname.endsWith('/fetch-articles')) {
      return await handleFetchArticles(req, res);
    } else if (pathname.endsWith('/analyze-relevance')) {
      return await handleAnalyzeRelevance(req, res);
    } else if (pathname.endsWith('/trending-topics')) {
      return await handleTrendingTopics(req, res);
    } else if (pathname.endsWith('/competitor-analysis')) {
      return await handleCompetitorAnalysis(req, res);
    } else {
      return res.status(404).json({ error: 'Not found' });
    }
  } catch (error) {
    console.error('RSS monitoring error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Add new RSS feed or Google Alert
async function handleAddFeed(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, feedUrl, feedName, feedType, keywords, category } = req.body;

  try {
    // Check user's tier and feed limit
    const { data: user } = await supabase
      .from('users')
      .select('posting_tier')
      .eq('id', userId)
      .single();

    const { data: tier } = await supabase
      .from('posting_tiers')
      .select('max_rss_feeds')
      .eq('tier_name', user.posting_tier)
      .single();

    const { count: currentFeeds } = await supabase
      .from('rss_feeds')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (currentFeeds >= tier.max_rss_feeds) {
      return res.status(400).json({ 
        error: `Feed limit reached. Your ${user.posting_tier} tier allows ${tier.max_rss_feeds} feeds.` 
      });
    }

    // Validate RSS feed
    if (feedType === 'rss') {
      try {
        await rssParser.parseURL(feedUrl);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid RSS feed URL' });
      }
    }

    // Add feed to database
    const { data: newFeed, error } = await supabase
      .from('rss_feeds')
      .insert({
        user_id: userId,
        feed_url: feedUrl,
        feed_name: feedName,
        feed_type: feedType,
        include_keywords: keywords || [],
        feed_category: category,
        check_frequency_minutes: user.posting_tier === 'aggressive' ? 15 : 60
      })
      .select()
      .single();

    if (error) throw error;

    // Fetch initial articles
    await fetchArticlesForFeed(newFeed.id);

    return res.status(201).json({ 
      message: 'Feed added successfully',
      feed: newFeed 
    });
  } catch (error) {
    console.error('Add feed error:', error);
    return res.status(500).json({ error: 'Failed to add feed' });
  }
}

// Fetch articles from RSS feeds
async function handleFetchArticles(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, feedId } = req.body;

  try {
    // Get active feeds
    const feedQuery = supabase
      .from('rss_feeds')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (feedId) {
      feedQuery.eq('id', feedId);
    }

    const { data: feeds } = await feedQuery;

    const results = [];
    for (const feed of feeds) {
      const articlesFound = await fetchArticlesForFeed(feed.id);
      results.push({
        feedId: feed.id,
        feedName: feed.feed_name,
        articlesFound
      });
    }

    return res.status(200).json({ results });
  } catch (error) {
    console.error('Fetch articles error:', error);
    return res.status(500).json({ error: 'Failed to fetch articles' });
  }
}

// Core function to fetch articles from a single feed
async function fetchArticlesForFeed(feedId) {
  try {
    const { data: feed } = await supabase
      .from('rss_feeds')
      .select('*')
      .eq('id', feedId)
      .single();

    if (!feed) return 0;

    let articles = [];

    if (feed.feed_type === 'rss') {
      // Parse RSS feed
      const parsedFeed = await rssParser.parseURL(feed.feed_url);
      articles = parsedFeed.items.map(item => ({
        title: item.title,
        url: item.link,
        summary: item.contentSnippet || item.description,
        content: item.content || item['content:encoded'] || item.description,
        author: item.creator || item.author,
        published_at: item.pubDate ? new Date(item.pubDate) : new Date(),
        categories: item.categories || [],
        media: item.media || item.thumbnail
      }));
    } else if (feed.feed_type === 'google_alerts') {
      // Handle Google Alerts (via Custom Search API or scraping)
      articles = await fetchGoogleAlerts(feed);
    }

    // Filter by keywords if specified
    if (feed.include_keywords && feed.include_keywords.length > 0) {
      articles = articles.filter(article => {
        const content = `${article.title} ${article.summary}`.toLowerCase();
        return feed.include_keywords.some(keyword => 
          content.includes(keyword.toLowerCase())
        );
      });
    }

    // Filter out excluded keywords
    if (feed.exclude_keywords && feed.exclude_keywords.length > 0) {
      articles = articles.filter(article => {
        const content = `${article.title} ${article.summary}`.toLowerCase();
        return !feed.exclude_keywords.some(keyword => 
          content.includes(keyword.toLowerCase())
        );
      });
    }

    // Insert new articles (avoiding duplicates)
    let newArticles = 0;
    for (const article of articles) {
      const { error } = await supabase
        .from('news_articles')
        .insert({
          rss_feed_id: feedId,
          user_id: feed.user_id,
          title: article.title,
          url: article.url,
          summary: article.summary,
          content: article.content,
          author: article.author,
          published_at: article.published_at,
          source_name: feed.feed_name,
          categories: article.categories,
          keywords_matched: findMatchedKeywords(article, feed.include_keywords)
        })
        .single();

      if (!error) newArticles++;
    }

    // Update feed last checked time
    await supabase
      .from('rss_feeds')
      .update({
        last_checked_at: new Date().toISOString(),
        last_successful_fetch: new Date().toISOString()
      })
      .eq('id', feedId);

    return newArticles;
  } catch (error) {
    console.error('Fetch feed error:', error);
    
    // Update error count
    await supabase
      .from('rss_feeds')
      .update({
        error_count: feed.error_count + 1,
        last_error: error.message,
        last_checked_at: new Date().toISOString()
      })
      .eq('id', feedId);

    return 0;
  }
}

// Analyze article relevance using AI
async function handleAnalyzeRelevance(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, articleId } = req.body;

  try {
    // Get article and user's brand framework
    const { data: article } = await supabase
      .from('news_articles')
      .select('*')
      .eq('id', articleId)
      .single();

    const { data: brandFramework } = await supabase
      .from('personal_brand_frameworks')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (!article || !brandFramework) {
      return res.status(404).json({ error: 'Article or brand framework not found' });
    }

    // Analyze relevance with OpenAI
    const relevanceAnalysis = await analyzeArticleRelevance(article, brandFramework);

    // Update article with analysis
    await supabase
      .from('news_articles')
      .update({
        relevance_score: relevanceAnalysis.relevanceScore,
        sentiment_score: relevanceAnalysis.sentimentScore,
        trending_score: relevanceAnalysis.trendingScore,
        analyzed_at: new Date().toISOString(),
        processing_status: relevanceAnalysis.relevanceScore > 0.7 ? 'analyzed' : 'ignored'
      })
      .eq('id', articleId);

    return res.status(200).json({ 
      relevance: relevanceAnalysis,
      shouldCreateContent: relevanceAnalysis.relevanceScore > 0.7
    });
  } catch (error) {
    console.error('Analyze relevance error:', error);
    return res.status(500).json({ error: 'Failed to analyze relevance' });
  }
}

// Get trending topics for newsjacking
async function handleTrendingTopics(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.query;

  try {
    // Get user's industry and interests
    const { data: user } = await supabase
      .from('users')
      .select('industry, role')
      .eq('id', userId)
      .single();

    const { data: brandFramework } = await supabase
      .from('personal_brand_frameworks')
      .select('expertise_areas, content_pillars')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    // Get recent high-relevance articles
    const { data: trendingArticles } = await supabase
      .from('news_articles')
      .select('*')
      .eq('user_id', userId)
      .gte('relevance_score', 0.8)
      .gte('trending_score', 0.7)
      .gte('published_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()) // Last 48 hours
      .order('trending_score', { ascending: false })
      .limit(10);

    // Group by topic/theme
    const trendingTopics = await groupArticlesByTopic(trendingArticles, brandFramework);

    // Add newsjacking angles
    const topicsWithAngles = await Promise.all(
      trendingTopics.map(async topic => ({
        ...topic,
        suggestedAngles: await generateNewsjackingAngles(topic, brandFramework)
      }))
    );

    return res.status(200).json({ 
      trendingTopics: topicsWithAngles,
      industry: user.industry 
    });
  } catch (error) {
    console.error('Trending topics error:', error);
    return res.status(500).json({ error: 'Failed to get trending topics' });
  }
}

// Competitor analysis for content strategy
async function handleCompetitorAnalysis(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body;

  try {
    // Get user's tier
    const { data: user } = await supabase
      .from('users')
      .select('posting_tier')
      .eq('id', userId)
      .single();

    if (!['regular', 'aggressive'].includes(user.posting_tier)) {
      return res.status(403).json({ 
        error: 'Competitor analysis is only available for Regular and Aggressive tiers' 
      });
    }

    // Get tracked competitors
    const { data: competitors } = await supabase
      .from('competitor_tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    // Analyze competitor content patterns
    const analysis = await Promise.all(
      competitors.map(async competitor => {
        // In production, this would scrape LinkedIn or use LinkedIn API
        // For now, return mock analysis
        return {
          competitorName: competitor.competitor_name,
          avgEngagementRate: competitor.avg_engagement_rate,
          topPerformingTopics: competitor.top_performing_topics,
          postingPatterns: competitor.posting_patterns,
          contentGaps: await identifyContentGaps(competitor, userId),
          opportunities: await identifyOpportunities(competitor, userId)
        };
      })
    );

    return res.status(200).json({ 
      competitorAnalysis: analysis,
      recommendations: await generateCompetitiveStrategy(analysis, userId)
    });
  } catch (error) {
    console.error('Competitor analysis error:', error);
    return res.status(500).json({ error: 'Failed to analyze competitors' });
  }
}

// Helper functions

async function analyzeArticleRelevance(article, brandFramework) {
  const prompt = `Analyze this news article's relevance to the user's personal brand:

Article:
Title: ${article.title}
Summary: ${article.summary}
Categories: ${article.categories?.join(', ')}

User's Brand Framework:
- Brand Archetype: ${brandFramework.brand_archetype}
- Target Audience: ${JSON.stringify(brandFramework.target_audience)}
- Expertise Areas: ${brandFramework.expertise_areas?.join(', ')}
- Content Pillars: ${JSON.stringify(brandFramework.content_pillars)}

Provide scores (0-1) for:
1. Relevance Score: How relevant is this to their brand and audience?
2. Sentiment Score: How positive/negative is this news? (-1 to 1)
3. Trending Score: How likely is this to generate engagement?
4. Newsjacking Potential: How easy to add unique perspective?

Also identify:
- Key angles for content creation
- Target audience connection points
- Potential risks or sensitivities

Format as JSON.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are a content strategist analyzing news for personal branding opportunities.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3
  });

  return JSON.parse(response.choices[0].message.content);
}

function findMatchedKeywords(article, keywords) {
  if (!keywords || keywords.length === 0) return [];
  
  const content = `${article.title} ${article.summary} ${article.content}`.toLowerCase();
  return keywords.filter(keyword => content.includes(keyword.toLowerCase()));
}

async function fetchGoogleAlerts(feed) {
  // Implementation would depend on how Google Alerts are accessed
  // Options:
  // 1. Parse Google Alerts RSS feed (if available)
  // 2. Use Google Custom Search API
  // 3. Scrape Google News (not recommended)
  
  // For now, return empty array
  return [];
}

async function groupArticlesByTopic(articles, brandFramework) {
  // Use AI to group articles by common themes
  const prompt = `Group these articles by common themes or topics:

${articles.map(a => `- ${a.title}`).join('\n')}

Consider the user's content pillars:
${JSON.stringify(brandFramework.content_pillars)}

Group into 3-5 main topics with article IDs for each group.
Format as JSON array with structure: { topic, description, articleIds, urgency }`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are a content strategist organizing news by themes.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.4
  });

  const groups = JSON.parse(response.choices[0].message.content);
  
  // Map article IDs back to article objects
  return groups.map(group => ({
    ...group,
    articles: articles.filter(a => group.articleIds.includes(a.id))
  }));
}

async function generateNewsjackingAngles(topic, brandFramework) {
  const prompt = `Generate 3 newsjacking angles for this trending topic:

Topic: ${topic.topic}
Description: ${topic.description}

User's Brand:
- Archetype: ${brandFramework.brand_archetype}
- Expertise: ${brandFramework.expertise_areas?.join(', ')}

For each angle provide:
1. Headline approach
2. Key message
3. Content type (contrarian, industry impact, personal story, etc.)
4. Urgency level (post within X hours)

Format as JSON array.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are a newsjacking expert creating timely content angles.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.6
  });

  return JSON.parse(response.choices[0].message.content);
}

async function identifyContentGaps(competitor, userId) {
  // Identify topics competitor covers that user doesn't
  // In production, would analyze actual content
  return [
    'Industry predictions they haven\'t addressed',
    'Personal stories in areas you excel',
    'Technical deep-dives they avoid'
  ];
}

async function identifyOpportunities(competitor, userId) {
  // Find opportunities based on competitor weaknesses
  return [
    'Post during their quiet hours',
    'Cover topics they ignore',
    'Engage with their audience\'s questions'
  ];
}

async function generateCompetitiveStrategy(analysis, userId) {
  // Generate strategic recommendations based on competitor analysis
  return {
    immediateActions: [
      'Fill content gaps in [specific topics]',
      'Post at [optimal times] when competitors are quiet',
      'Create series on [underserved topics]'
    ],
    contentDifferentiators: [
      'More personal stories',
      'Deeper technical analysis',
      'Faster news response time'
    ],
    postingStrategy: {
      optimalTimes: ['07:00', '12:30', '17:00'],
      avoidTimes: ['09:00', '14:00'], // When competitors post
      weekendOpportunity: true
    }
  };
}

// Scheduled job to check feeds (would run via cron)
export async function checkAllFeeds() {
  const { data: activeFeeds } = await supabase
    .from('rss_feeds')
    .select('*')
    .eq('is_active', true)
    .or(`last_checked_at.is.null,last_checked_at.lt.${new Date(Date.now() - 60 * 60 * 1000).toISOString()}`);

  for (const feed of activeFeeds) {
    await fetchArticlesForFeed(feed.id);
  }
}