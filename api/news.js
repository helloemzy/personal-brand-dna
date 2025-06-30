// Consolidated news API router
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import Parser from 'rss-parser';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const JWT_SECRET = process.env.JWT_SECRET;
const parser = new Parser();

// Auth middleware
async function authenticateToken(req) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw new Error('No token provided');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

// Route handler
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Authenticate user
    const user = await authenticateToken(req);
    req.user = user;

    const { action } = req.query;

    switch (action) {
      case 'articles':
        return await handleGetArticles(req, res);
      case 'sources':
        if (req.method === 'GET') {
          return await handleGetSources(req, res);
        } else if (req.method === 'POST') {
          return await handleAddSource(req, res);
        } else if (req.method === 'DELETE') {
          return await handleDeleteSource(req, res);
        }
        break;
      case 'refresh':
        return await handleRefreshArticles(req, res);
      default:
        return res.status(404).json({ error: 'Invalid news action' });
    }
  } catch (error) {
    console.error('News API error:', error);
    if (error.message === 'No token provided' || error.message === 'Invalid token') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Get news articles
async function handleGetArticles(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { page = 1, limit = 20, minRelevance } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from('news_articles')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.userId)
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (minRelevance) {
      query = query.gte('relevance_score', parseFloat(minRelevance));
    }

    const { data: articles, error, count } = await query;

    if (error) throw error;

    return res.status(200).json({
      articles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get articles error:', error);
    return res.status(500).json({ error: 'Failed to fetch news articles' });
  }
}

// Get user's news sources
async function handleGetSources(req, res) {
  try {
    const { data: sources, error } = await supabase
      .from('news_sources')
      .select('*')
      .eq('user_id', req.user.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json({ sources });
  } catch (error) {
    console.error('Get sources error:', error);
    return res.status(500).json({ error: 'Failed to fetch news sources' });
  }
}

// Add news source
async function handleAddSource(req, res) {
  const { name, url, type = 'rss' } = req.body;

  if (!name || !url) {
    return res.status(400).json({ error: 'Name and URL are required' });
  }

  try {
    // Validate RSS feed
    if (type === 'rss') {
      await parser.parseURL(url);
    }

    const { data: source, error } = await supabase
      .from('news_sources')
      .insert({
        user_id: req.user.userId,
        name,
        url,
        type,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    // Fetch initial articles
    await fetchArticlesFromSource(source, req.user.userId);

    return res.status(201).json({ source });
  } catch (error) {
    console.error('Add source error:', error);
    return res.status(500).json({ error: 'Failed to add news source' });
  }
}

// Delete news source
async function handleDeleteSource(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Source ID is required' });
  }

  try {
    // Delete associated articles first
    await supabase
      .from('news_articles')
      .delete()
      .eq('source_id', id)
      .eq('user_id', req.user.userId);

    // Delete the source
    const { error } = await supabase
      .from('news_sources')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.userId);

    if (error) throw error;

    return res.status(200).json({ message: 'Source deleted successfully' });
  } catch (error) {
    console.error('Delete source error:', error);
    return res.status(500).json({ error: 'Failed to delete news source' });
  }
}

// Refresh articles from all sources
async function handleRefreshArticles(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data: sources, error } = await supabase
      .from('news_sources')
      .select('*')
      .eq('user_id', req.user.userId)
      .eq('is_active', true);

    if (error) throw error;

    let totalFetched = 0;
    for (const source of sources) {
      const fetched = await fetchArticlesFromSource(source, req.user.userId);
      totalFetched += fetched;
    }

    return res.status(200).json({
      message: 'Articles refreshed successfully',
      articlesAdded: totalFetched
    });
  } catch (error) {
    console.error('Refresh articles error:', error);
    return res.status(500).json({ error: 'Failed to refresh articles' });
  }
}

// Fetch articles from a source
async function fetchArticlesFromSource(source, userId) {
  try {
    if (source.type !== 'rss') return 0;

    const feed = await parser.parseURL(source.url);
    const articles = [];

    for (const item of feed.items.slice(0, 20)) {
      // Check if article already exists
      const { data: existing } = await supabase
        .from('news_articles')
        .select('id')
        .eq('url', item.link)
        .eq('user_id', userId)
        .single();

      if (!existing) {
        articles.push({
          user_id: userId,
          source_id: source.id,
          title: item.title,
          url: item.link,
          description: item.contentSnippet || item.content,
          published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          relevance_score: 0 // Will be calculated by a separate process
        });
      }
    }

    if (articles.length > 0) {
      const { error } = await supabase
        .from('news_articles')
        .insert(articles);

      if (error) throw error;
    }

    return articles.length;
  } catch (error) {
    console.error('Fetch articles error:', error);
    return 0;
  }
}