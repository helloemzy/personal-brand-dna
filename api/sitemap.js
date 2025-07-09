/**
 * Dynamic Sitemap Generator API
 * Generates sitemap.xml dynamically to include user-generated content
 */

export default function handler(req, res) {
  // Set proper content type for XML
  res.setHeader('Content-Type', 'text/xml');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate');

  const baseUrl = 'https://brandpillar-ai.vercel.app';
  const currentDate = new Date().toISOString().split('T')[0];

  // Static pages with their priorities and change frequencies
  const staticPages = [
    { path: '/', priority: 1.0, changefreq: 'daily' },
    { path: '/brand-house', priority: 0.9, changefreq: 'weekly' },
    { path: '/pricing', priority: 0.8, changefreq: 'weekly' },
    { path: '/get-started', priority: 0.8, changefreq: 'weekly' },
    { path: '/dashboard', priority: 0.7, changefreq: 'daily' },
    { path: '/content-calendar', priority: 0.7, changefreq: 'daily' },
    { path: '/analytics', priority: 0.7, changefreq: 'daily' },
    { path: '/news-monitoring', priority: 0.7, changefreq: 'daily' },
    { path: '/workshop/results', priority: 0.6, changefreq: 'weekly' },
    { path: '/auth/login', priority: 0.5, changefreq: 'monthly' },
    { path: '/auth/register', priority: 0.5, changefreq: 'monthly' },
    { path: '/auth/forgot-password', priority: 0.4, changefreq: 'monthly' },
    { path: '/profile', priority: 0.6, changefreq: 'weekly' },
    { path: '/subscription', priority: 0.6, changefreq: 'weekly' },
    { path: '/content-generation', priority: 0.7, changefreq: 'daily' },
    { path: '/content-history', priority: 0.6, changefreq: 'daily' },
    { path: '/news-setup', priority: 0.6, changefreq: 'weekly' },
    { path: '/linkedin-settings', priority: 0.5, changefreq: 'weekly' }
  ];

  // In production, you would fetch dynamic pages from database
  // const dynamicPages = await fetchDynamicPages();
  // For now, we'll add some example share pages
  const dynamicPages = [
    { path: '/share/ABC12345', priority: 0.5, changefreq: 'monthly' },
    { path: '/share/XYZ67890', priority: 0.5, changefreq: 'monthly' }
  ];

  // Combine all pages
  const allPages = [...staticPages, ...dynamicPages];

  // Generate XML
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(page => `  <url>
    <loc>${baseUrl}${page.path}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  res.status(200).send(sitemap);
}