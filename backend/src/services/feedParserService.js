const Parser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');
const logger = require('../utils/logger');

// Configure RSS parser with custom fields
const parser = new Parser({
  customFields: {
    feed: [
      ['subtitle', 'subtitle'],
      ['image', 'image'],
      ['updated', 'updated']
    ],
    item: [
      ['media:content', 'media:content', { keepArray: true }],
      ['media:thumbnail', 'media:thumbnail'],
      ['content:encoded', 'content:encoded'],
      ['dc:creator', 'dc:creator'],
      ['category', 'categories', { keepArray: true }],
      ['enclosure', 'enclosure']
    ]
  },
  timeout: 30000 // 30 second timeout
});

/**
 * Parse RSS/Atom feed
 * @param {string} feedUrl - URL of the RSS feed
 * @returns {Object} Parsed feed data
 */
async function parseRSSFeed(feedUrl) {
  try {
    logger.info(`Parsing RSS feed: ${feedUrl}`);
    const feed = await parser.parseURL(feedUrl);
    
    return {
      feedInfo: {
        title: feed.title || 'Unknown Feed',
        description: feed.description,
        link: feed.link,
        image: feed.image?.url || feed.itunes?.image,
        lastUpdated: feed.lastBuildDate || feed.updated
      },
      articles: feed.items.map(item => ({
        externalId: item.guid || item.id || item.link,
        title: item.title,
        summary: item.contentSnippet || item.summary || extractSummary(item.content),
        content: item['content:encoded'] || item.content,
        author: item['dc:creator'] || item.creator || item.author,
        publishedAt: item.pubDate || item.published || item.updated,
        articleUrl: item.link,
        imageUrl: extractImageUrl(item),
        categories: extractCategories(item),
        rawData: item
      }))
    };
  } catch (error) {
    logger.error(`Error parsing RSS feed ${feedUrl}:`, error);
    throw new Error(`Failed to parse RSS feed: ${error.message}`);
  }
}

/**
 * Parse JSON feed (JSON Feed 1.1 specification)
 * @param {string} feedUrl - URL of the JSON feed
 * @returns {Object} Parsed feed data
 */
async function parseJSONFeed(feedUrl) {
  try {
    logger.info(`Parsing JSON feed: ${feedUrl}`);
    const response = await axios.get(feedUrl, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Personal Brand DNA Feed Reader/1.0',
        'Accept': 'application/json, application/feed+json'
      }
    });
    
    const feed = response.data;
    
    // Validate JSON Feed format
    if (!feed.version || !feed.version.startsWith('https://jsonfeed.org/version/')) {
      throw new Error('Invalid JSON Feed format');
    }
    
    return {
      feedInfo: {
        title: feed.title || 'Unknown Feed',
        description: feed.description,
        link: feed.home_page_url || feed.feed_url,
        image: feed.icon || feed.favicon,
        lastUpdated: feed.updated
      },
      articles: (feed.items || []).map(item => ({
        externalId: item.id || item.url,
        title: item.title,
        summary: item.summary || extractSummary(item.content_text || item.content_html),
        content: item.content_html || item.content_text,
        author: item.author?.name || item.authors?.[0]?.name,
        publishedAt: item.date_published || item.date_modified,
        articleUrl: item.url || item.external_url,
        imageUrl: item.image || item.banner_image,
        categories: item.tags || [],
        rawData: item
      }))
    };
  } catch (error) {
    logger.error(`Error parsing JSON feed ${feedUrl}:`, error);
    throw new Error(`Failed to parse JSON feed: ${error.message}`);
  }
}

/**
 * Fetch and parse feed based on type
 * @param {string} feedUrl - URL of the feed
 * @param {string} feedType - Type of feed (rss, atom, json)
 * @returns {Object} Parsed feed data
 */
async function parseFeed(feedUrl, feedType = 'rss') {
  try {
    // Validate URL
    new URL(feedUrl);
    
    switch (feedType.toLowerCase()) {
      case 'json':
        return await parseJSONFeed(feedUrl);
      case 'rss':
      case 'atom':
      default:
        return await parseRSSFeed(feedUrl);
    }
  } catch (error) {
    logger.error(`Error parsing feed ${feedUrl}:`, error);
    throw error;
  }
}

/**
 * Discover feed URLs from a website
 * @param {string} websiteUrl - URL of the website
 * @returns {Array} Array of discovered feed URLs
 */
async function discoverFeeds(websiteUrl) {
  try {
    logger.info(`Discovering feeds from: ${websiteUrl}`);
    
    const response = await axios.get(websiteUrl, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Personal Brand DNA Feed Discoverer/1.0'
      }
    });
    
    const $ = cheerio.load(response.data);
    const feeds = [];
    const baseUrl = new URL(websiteUrl);
    
    // Look for RSS/Atom links in HTML
    $('link[type="application/rss+xml"], link[type="application/atom+xml"], link[type="application/json"], link[type="application/feed+json"]').each((i, elem) => {
      const href = $(elem).attr('href');
      const title = $(elem).attr('title') || 'RSS Feed';
      const type = $(elem).attr('type');
      
      if (href) {
        const feedUrl = new URL(href, baseUrl).toString();
        feeds.push({
          url: feedUrl,
          title: title,
          type: type.includes('json') ? 'json' : 'rss'
        });
      }
    });
    
    // Common feed URL patterns
    const commonPaths = [
      '/feed',
      '/rss',
      '/rss.xml',
      '/feed.xml',
      '/atom.xml',
      '/blog/feed',
      '/blog/rss',
      '/feeds/posts/default',
      '/feed.json',
      '/api/feed.json'
    ];
    
    // Check common paths if no feeds found
    if (feeds.length === 0) {
      for (const path of commonPaths) {
        try {
          const testUrl = new URL(path, baseUrl).toString();
          const testResponse = await axios.head(testUrl, { 
            timeout: 5000,
            validateStatus: status => status === 200
          });
          
          if (testResponse.status === 200) {
            const contentType = testResponse.headers['content-type'] || '';
            feeds.push({
              url: testUrl,
              title: `Feed at ${path}`,
              type: contentType.includes('json') ? 'json' : 'rss'
            });
          }
        } catch (e) {
          // Ignore errors for individual paths
        }
      }
    }
    
    return feeds;
  } catch (error) {
    logger.error(`Error discovering feeds from ${websiteUrl}:`, error);
    throw new Error(`Failed to discover feeds: ${error.message}`);
  }
}

/**
 * Extract full article content from URL (for summary feeds)
 * @param {string} articleUrl - URL of the article
 * @returns {Object} Extracted content
 */
async function extractArticleContent(articleUrl) {
  try {
    logger.info(`Extracting content from: ${articleUrl}`);
    
    const response = await axios.get(articleUrl, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Personal Brand DNA Content Extractor/1.0'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // Remove unwanted elements
    $('script, style, nav, header, footer, .comments, .sidebar, .advertisement').remove();
    
    // Try different content selectors
    const contentSelectors = [
      'article',
      'main',
      '.post-content',
      '.entry-content', 
      '.article-content',
      '.content',
      '[itemprop="articleBody"]',
      '.post',
      '#content'
    ];
    
    let content = '';
    let title = '';
    
    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length && element.text().trim().length > 100) {
        content = element.html();
        break;
      }
    }
    
    // Extract title
    title = $('h1').first().text().trim() || 
            $('title').text().trim() || 
            $('[property="og:title"]').attr('content') || '';
    
    // Extract meta description
    const description = $('[name="description"]').attr('content') || 
                       $('[property="og:description"]').attr('content') || '';
    
    // Extract featured image
    const image = $('[property="og:image"]').attr('content') || 
                  $('article img').first().attr('src') || '';
    
    return {
      title,
      content: content || $('body').html(),
      description,
      image,
      extractedAt: new Date()
    };
  } catch (error) {
    logger.error(`Error extracting content from ${articleUrl}:`, error);
    return null;
  }
}

// Helper functions

function extractSummary(content, maxLength = 200) {
  if (!content) return '';
  
  // Strip HTML tags
  const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Return truncated text
  if (text.length <= maxLength) return text;
  
  // Find last complete sentence within maxLength
  const truncated = text.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  
  if (lastPeriod > maxLength * 0.8) {
    return truncated.substring(0, lastPeriod + 1);
  }
  
  return truncated.trim() + '...';
}

function extractImageUrl(item) {
  // Try different image sources
  if (item['media:thumbnail']) {
    return item['media:thumbnail'].$.url || item['media:thumbnail'];
  }
  
  if (item['media:content'] && Array.isArray(item['media:content'])) {
    const image = item['media:content'].find(media => 
      media.$.type && media.$.type.startsWith('image/')
    );
    if (image) return image.$.url;
  }
  
  if (item.enclosure && item.enclosure.type && item.enclosure.type.startsWith('image/')) {
    return item.enclosure.url;
  }
  
  // Extract from content
  if (item.content || item['content:encoded']) {
    const content = item['content:encoded'] || item.content;
    const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/);
    if (imgMatch) return imgMatch[1];
  }
  
  return null;
}

function extractCategories(item) {
  const categories = [];
  
  if (item.categories) {
    if (Array.isArray(item.categories)) {
      categories.push(...item.categories.map(cat => 
        typeof cat === 'object' ? cat._ || cat.term || cat : cat
      ));
    } else {
      categories.push(item.categories);
    }
  }
  
  if (item.category) {
    if (Array.isArray(item.category)) {
      categories.push(...item.category);
    } else {
      categories.push(item.category);
    }
  }
  
  // Remove duplicates and empty values
  return [...new Set(categories.filter(cat => cat && cat.trim()))];
}

module.exports = {
  parseFeed,
  parseRSSFeed,
  parseJSONFeed,
  discoverFeeds,
  extractArticleContent
};