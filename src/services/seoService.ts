/**
 * SEO Service
 * Provides comprehensive SEO functionality including meta tags, structured data,
 * Open Graph tags, and dynamic sitemap generation
 */

import { WorkshopData } from '../types';

interface SEOMetadata {
  title: string;
  description: string;
  keywords?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  ogType?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  twitterSite?: string;
  twitterCreator?: string;
  jsonLd?: any;
}

// Default site metadata
const DEFAULT_METADATA: SEOMetadata = {
  title: 'BrandPillar AI - Build Your Personal Brand on Autopilot',
  description: 'The AI-powered platform that builds your personal brand on autopilot with intelligent content creation and news monitoring. Transform your expertise into influence.',
  keywords: 'personal brand, LinkedIn, content creation, AI writing, brand building, thought leadership, professional branding, content automation',
  ogTitle: 'BrandPillar AI - Personal Brand on Autopilot',
  ogDescription: 'AI brand discovery + automated content + news monitoring. Build your LinkedIn influence with 3-5 posts/week. Start 7-day free trial.',
  ogImage: 'https://brandpillar-ai.vercel.app/og-image.jpg',
  ogUrl: 'https://brandpillar-ai.vercel.app',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterSite: '@BrandPillarAI',
  twitterCreator: '@BrandPillarAI'
};

// Page-specific metadata configurations
const PAGE_METADATA: Record<string, Partial<SEOMetadata>> = {
  '/': {
    title: 'BrandPillar AI - Build Your Personal Brand on Autopilot',
    description: 'Transform your expertise into influence. AI-powered brand discovery, automated content creation, and intelligent news monitoring. Start your 7-day free trial.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'BrandPillar AI',
      description: 'AI-powered personal brand building platform',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      offers: {
        '@type': 'AggregateOffer',
        lowPrice: '39',
        highPrice: '149',
        priceCurrency: 'USD',
        offerCount: '3'
      }
    }
  },
  '/brand-house': {
    title: 'Brand House Workshop - Discover Your Brand DNA | BrandPillar AI',
    description: 'Complete our 10-minute Brand House workshop to discover your unique brand archetype, values, and voice. Get AI-powered insights and actionable content strategies.',
    ogTitle: 'Discover Your Brand DNA in 10 Minutes',
    ogDescription: 'Free Brand House workshop reveals your archetype, mission, and content strategy. Start building your personal brand today.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Quiz',
      name: 'Brand House Workshop',
      description: 'Personal brand discovery assessment',
      educationalLevel: 'Professional',
      timeRequired: 'PT10M'
    }
  },
  '/workshop/results': {
    title: 'Your Brand House Results - Personal Brand Blueprint | BrandPillar AI',
    description: 'Explore your personalized Brand House with AI-determined archetype, mission statement, content pillars, and actionable strategies for building your personal brand.',
    ogTitle: 'Your Personal Brand Blueprint is Ready',
    ogDescription: 'Discover your brand archetype, mission, and content strategy. Download your Brand House report and start creating content that resonates.'
  },
  '/pricing': {
    title: 'Pricing Plans - Choose Your Brand Building Journey | BrandPillar AI',
    description: 'Flexible pricing plans for every professional. From 3 posts/week starter plan to daily executive posting. All plans include AI brand discovery and content generation.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'OfferCatalog',
      name: 'BrandPillar AI Pricing Plans',
      itemListElement: [
        {
          '@type': 'Offer',
          name: 'Starter Plan',
          price: '39',
          priceCurrency: 'USD',
          description: '3 posts/week, 5 news sources'
        },
        {
          '@type': 'Offer',
          name: 'Professional Plan',
          price: '79',
          priceCurrency: 'USD',
          description: '5 posts/week + 1 article, 25 news sources'
        },
        {
          '@type': 'Offer',
          name: 'Executive Plan',
          price: '149',
          priceCurrency: 'USD',
          description: 'Daily posts + 2 articles, unlimited sources'
        }
      ]
    }
  },
  '/dashboard': {
    title: 'Dashboard - Manage Your Personal Brand | BrandPillar AI',
    description: 'Your personal brand command center. Track content performance, manage scheduled posts, monitor news sources, and optimize your LinkedIn presence.',
    ogType: 'website'
  },
  '/content-calendar': {
    title: 'Content Calendar - Schedule Your Brand Story | BrandPillar AI',
    description: 'Visual content calendar for planning and scheduling your LinkedIn posts. Drag-and-drop interface with AI content suggestions and optimal posting times.'
  },
  '/analytics': {
    title: 'Analytics Dashboard - Track Your Brand Growth | BrandPillar AI',
    description: 'Comprehensive analytics for your personal brand. Track engagement, reach, follower growth, and content performance with actionable insights.'
  },
  '/news-monitoring': {
    title: 'News Monitoring - Stay Ahead of Industry Trends | BrandPillar AI',
    description: 'Real-time news monitoring from your curated sources. AI-powered relevance scoring and one-click content generation from trending topics.'
  }
};

class SEOService {
  /**
   * Get metadata for a specific page
   */
  getPageMetadata(pathname: string, customData?: Partial<SEOMetadata>): SEOMetadata {
    const pageConfig = PAGE_METADATA[pathname] || {};
    
    return {
      ...DEFAULT_METADATA,
      ...pageConfig,
      ...customData,
      // Ensure full URLs for Open Graph
      ogUrl: `https://brandpillar-ai.vercel.app${pathname}`,
      canonical: `https://brandpillar-ai.vercel.app${pathname}`
    };
  }

  /**
   * Generate metadata for workshop results page with user data
   */
  getResultsPageMetadata(workshopData: Partial<WorkshopData>): SEOMetadata {
    const archetype = workshopData.archetype || 'Brand Archetype';
    const mission = workshopData.missionStatements?.[0] || '';
    
    return {
      title: `${archetype} - Your Personal Brand Blueprint | BrandPillar AI`,
      description: `You're a ${archetype}! ${mission.slice(0, 120)}... Discover your complete Brand House with content pillars and strategies.`,
      ogTitle: `I'm a ${archetype} - Discovered My Brand DNA!`,
      ogDescription: mission.slice(0, 150) || `Just discovered my personal brand archetype and mission. Ready to build my influence on LinkedIn with AI-powered content.`,
      ogImage: 'https://brandpillar-ai.vercel.app/og-results.jpg',
      canonical: 'https://brandpillar-ai.vercel.app/workshop/results'
    };
  }

  /**
   * Generate metadata for shared results page
   */
  getSharedResultsMetadata(shareData: any): SEOMetadata {
    const { archetype, mission } = shareData;
    
    return {
      title: `${archetype} Brand Profile - BrandPillar AI`,
      description: `${mission.slice(0, 150)}... See how this ${archetype} builds their personal brand with BrandPillar AI.`,
      ogTitle: `${archetype} - Personal Brand Showcase`,
      ogDescription: mission,
      ogImage: 'https://brandpillar-ai.vercel.app/og-share.jpg',
      ogType: 'profile'
    };
  }

  /**
   * Generate JSON-LD structured data for a person/professional
   */
  generatePersonSchema(userData: any) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: userData.name || 'Professional',
      jobTitle: userData.currentRole || 'Professional',
      description: userData.mission || '',
      knowsAbout: userData.contentPillars?.map((p: any) => p.topics).flat() || [],
      url: userData.linkedinUrl || ''
    };
  }

  /**
   * Generate JSON-LD for an article/blog post
   */
  generateArticleSchema(article: any) {
    return {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: article.title,
      description: article.description,
      author: {
        '@type': 'Person',
        name: article.author || 'BrandPillar AI User'
      },
      datePublished: article.publishedDate || new Date().toISOString(),
      publisher: {
        '@type': 'Organization',
        name: 'BrandPillar AI',
        logo: {
          '@type': 'ImageObject',
          url: 'https://brandpillar-ai.vercel.app/logo.png'
        }
      }
    };
  }

  /**
   * Generate breadcrumb structured data
   */
  generateBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: `https://brandpillar-ai.vercel.app${item.url}`
      }))
    };
  }

  /**
   * Generate dynamic sitemap entries
   */
  generateSitemapEntries(): Array<{ url: string; priority: number; changefreq: string }> {
    const staticPages = [
      { url: '/', priority: 1.0, changefreq: 'daily' },
      { url: '/brand-house', priority: 0.9, changefreq: 'weekly' },
      { url: '/pricing', priority: 0.8, changefreq: 'weekly' },
      { url: '/dashboard', priority: 0.7, changefreq: 'daily' },
      { url: '/content-calendar', priority: 0.7, changefreq: 'daily' },
      { url: '/analytics', priority: 0.7, changefreq: 'daily' },
      { url: '/news-monitoring', priority: 0.7, changefreq: 'daily' },
      { url: '/get-started', priority: 0.8, changefreq: 'weekly' },
      { url: '/workshop/results', priority: 0.6, changefreq: 'weekly' }
    ];

    // In production, add dynamic pages like shared results
    // const dynamicPages = await this.getDynamicPages();
    
    return staticPages;
  }

  /**
   * Generate robots.txt content
   */
  generateRobotsTxt(): string {
    return `User-agent: *
Allow: /

User-agent: *
Disallow: /api/
Disallow: /admin/
Disallow: /workshop/steps/
Disallow: /_next/
Disallow: /static/

Sitemap: https://brandpillar-ai.vercel.app/sitemap.xml`;
  }

  /**
   * Get optimal preview image for social sharing
   */
  getPreviewImage(type: 'default' | 'results' | 'share' | 'article' = 'default'): string {
    const images = {
      default: 'https://brandpillar-ai.vercel.app/og-image.jpg',
      results: 'https://brandpillar-ai.vercel.app/og-results.jpg',
      share: 'https://brandpillar-ai.vercel.app/og-share.jpg',
      article: 'https://brandpillar-ai.vercel.app/og-article.jpg'
    };
    
    return images[type] || images.default;
  }
}

export const seoService = new SEOService();
export type { SEOMetadata };