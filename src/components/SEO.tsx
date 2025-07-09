import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { seoService, SEOMetadata } from '../services/seoService';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  article?: boolean;
  customMetadata?: Partial<SEOMetadata>;
  jsonLd?: any;
}

const SEO: React.FC<SEOProps> = ({
  title,
  description,
  keywords,
  image,
  article = false,
  customMetadata,
  jsonLd
}) => {
  const location = useLocation();
  
  // Get page-specific metadata
  const metadata = seoService.getPageMetadata(location.pathname, {
    title,
    description,
    keywords,
    ogImage: image,
    twitterImage: image,
    ogType: article ? 'article' : 'website',
    ...customMetadata
  });

  // Combine any custom JSON-LD with page defaults
  const structuredData = jsonLd || metadata.jsonLd;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{metadata.title}</title>
      <meta name="description" content={metadata.description} />
      {metadata.keywords && <meta name="keywords" content={metadata.keywords} />}
      {metadata.canonical && <link rel="canonical" href={metadata.canonical} />}
      
      {/* Open Graph Tags */}
      <meta property="og:title" content={metadata.ogTitle || metadata.title} />
      <meta property="og:description" content={metadata.ogDescription || metadata.description} />
      <meta property="og:type" content={metadata.ogType || 'website'} />
      <meta property="og:url" content={metadata.ogUrl} />
      {metadata.ogImage && <meta property="og:image" content={metadata.ogImage} />}
      <meta property="og:site_name" content="BrandPillar AI" />
      <meta property="og:locale" content="en_US" />
      
      {/* Twitter Card Tags */}
      <meta name="twitter:card" content={metadata.twitterCard || 'summary_large_image'} />
      <meta name="twitter:title" content={metadata.twitterTitle || metadata.ogTitle || metadata.title} />
      <meta name="twitter:description" content={metadata.twitterDescription || metadata.ogDescription || metadata.description} />
      {(metadata.twitterImage || metadata.ogImage) && (
        <meta name="twitter:image" content={metadata.twitterImage || metadata.ogImage} />
      )}
      {metadata.twitterSite && <meta name="twitter:site" content={metadata.twitterSite} />}
      {metadata.twitterCreator && <meta name="twitter:creator" content={metadata.twitterCreator} />}
      
      {/* Additional Meta Tags */}
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
      <meta name="author" content="BrandPillar AI" />
      <meta name="generator" content="BrandPillar AI Platform" />
      
      {/* Mobile App Meta Tags */}
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content="BrandPillar" />
      <meta name="format-detection" content="telephone=no" />
      
      {/* JSON-LD Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
      
      {/* Organization Schema (on every page) */}
      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'BrandPillar AI',
          url: 'https://brandpillar-ai.vercel.app',
          logo: 'https://brandpillar-ai.vercel.app/logo.png',
          sameAs: [
            'https://twitter.com/BrandPillarAI',
            'https://linkedin.com/company/brandpillar-ai'
          ],
          contactPoint: {
            '@type': 'ContactPoint',
            email: 'support@brandpillar.ai',
            contactType: 'customer support'
          }
        })}
      </script>
    </Helmet>
  );
};

export default SEO;