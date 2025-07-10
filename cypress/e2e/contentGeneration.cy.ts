describe('Content Generation E2E Tests', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    cy.loginAsTestUser();
  });

  it('should generate LinkedIn headlines from results', () => {
    // Complete workshop first
    cy.completeWorkshopToStep(5);
    cy.get('[data-testid="complete-workshop"]').click();
    
    // Navigate to LinkedIn headlines section
    cy.get('[data-testid="linkedin-headlines-section"]').scrollIntoView();
    cy.contains('LinkedIn Headlines').should('be.visible');
    
    // Should see 5 headline variations
    cy.get('[data-testid="headline-variation"]').should('have.length', 5);
    
    // Test headline selection
    cy.get('[data-testid="headline-variation"]').first().click();
    cy.get('[data-testid="selected-headline"]').should('be.visible');
    
    // Test character count
    cy.get('[data-testid="headline-character-count"]').each(($el) => {
      const count = parseInt($el.text());
      expect(count).to.be.lessThan(221); // LinkedIn limit
    });
    
    // Test copy to clipboard
    cy.get('[data-testid="copy-headline-0"]').click();
    cy.contains('Copied!').should('be.visible');
    
    // Test keyword highlighting
    cy.get('[data-testid="headline-keywords"]').should('be.visible');
    cy.get('[data-testid="keyword-tag"]').should('have.length.greaterThan', 0);
  });

  it('should generate elevator pitches', () => {
    // Complete workshop
    cy.completeWorkshopToStep(5);
    cy.get('[data-testid="complete-workshop"]').click();
    
    // Navigate to elevator pitches
    cy.get('[data-testid="elevator-pitches-section"]').scrollIntoView();
    cy.contains('Elevator Pitches').should('be.visible');
    
    // Test pitch duration selector
    cy.get('[data-testid="pitch-duration-selector"]').select('30-second');
    cy.get('[data-testid="pitch-content"]').should('contain', '30-second pitch');
    cy.get('[data-testid="word-count"]').then(($el) => {
      const count = parseInt($el.text());
      expect(count).to.be.within(75, 85);
    });
    
    // Test 60-second pitch
    cy.get('[data-testid="pitch-duration-selector"]').select('60-second');
    cy.get('[data-testid="word-count"]').then(($el) => {
      const count = parseInt($el.text());
      expect(count).to.be.within(150, 170);
    });
    
    // Test networking pitch
    cy.get('[data-testid="pitch-duration-selector"]').select('networking');
    cy.get('[data-testid="pitch-content"]').should('contain', 'networking');
    
    // Test context variations
    cy.get('[data-testid="pitch-context"]').select('interview');
    cy.get('[data-testid="pitch-content"]').should('contain', 'interview');
  });

  it('should generate content starter pack', () => {
    // Complete workshop
    cy.completeWorkshopToStep(5);
    cy.get('[data-testid="complete-workshop"]').click();
    
    // Navigate to content starter pack
    cy.get('[data-testid="content-starter-pack"]').scrollIntoView();
    cy.contains('Content Starter Pack').should('be.visible');
    
    // Should have 10 content ideas
    cy.get('[data-testid="content-idea"]').should('have.length', 10);
    
    // Verify content pillars distribution
    const pillarCounts = { expertise: 0, experience: 0, evolution: 0 };
    cy.get('[data-testid="content-pillar-tag"]').each(($el) => {
      const pillar = $el.text().toLowerCase();
      if (pillar in pillarCounts) {
        pillarCounts[pillar as keyof typeof pillarCounts]++;
      }
    });
    
    // Should have balanced distribution
    cy.wrap(pillarCounts).should('satisfy', (counts: typeof pillarCounts) => {
      return counts.expertise >= 3 && counts.experience >= 3 && counts.evolution >= 2;
    });
    
    // Test content idea expansion
    cy.get('[data-testid="content-idea"]').first().click();
    cy.get('[data-testid="expanded-content"]').should('be.visible');
    cy.get('[data-testid="content-hook"]').should('be.visible');
    cy.get('[data-testid="content-angle"]').should('be.visible');
    
    // Test create content from idea
    cy.get('[data-testid="create-from-idea"]').click();
    cy.url().should('include', '/content/create');
    cy.get('[data-testid="content-editor"]').should('contain.value', 'hook');
  });

  it('should integrate with news monitoring for content', () => {
    // Set up RSS feeds first
    cy.visit('/news/setup');
    
    // Add technology feeds
    cy.get('[data-testid="category-technology"]').click();
    cy.get('[data-testid="feed-techcrunch"]').check();
    cy.get('[data-testid="feed-verge"]').check();
    cy.get('[data-testid="feed-wired"]').check();
    
    // Add custom keywords
    cy.get('[data-testid="keyword-input"]').type('artificial intelligence');
    cy.get('[data-testid="add-keyword"]').click();
    cy.get('[data-testid="keyword-input"]').type('product innovation');
    cy.get('[data-testid="add-keyword"]').click();
    
    cy.get('[data-testid="save-feeds"]').click();
    
    // Navigate to news monitoring
    cy.visit('/news/monitor');
    cy.contains('News Monitoring Dashboard').should('be.visible');
    
    // Wait for news items to load
    cy.get('[data-testid="news-item"]', { timeout: 15000 }).should('have.length.greaterThan', 0);
    
    // Test relevance filtering
    cy.get('[data-testid="relevance-filter"]').select('high');
    cy.get('[data-testid="relevance-score"]').each(($el) => {
      const score = parseFloat($el.text());
      expect(score).to.be.greaterThan(0.7);
    });
    
    // Create content from news
    cy.get('[data-testid="news-item"]').first().find('[data-testid="create-content"]').click();
    cy.get('[data-testid="content-modal"]').should('be.visible');
    
    // Select content angle
    cy.get('[data-testid="angle-professional"]').click();
    cy.get('[data-testid="generate-content"]').click();
    
    // Wait for AI generation
    cy.contains('Generating content', { timeout: 10000 }).should('be.visible');
    cy.contains('Generating content').should('not.exist');
    
    // Verify generated content
    cy.get('[data-testid="generated-content"]').should('not.be.empty');
    cy.get('[data-testid="voice-match-score"]').should('be.visible');
    
    // Test content editing
    cy.get('[data-testid="edit-content"]').click();
    cy.get('[data-testid="content-editor"]').type(' Additional insight.');
    
    // Post to LinkedIn
    cy.get('[data-testid="post-to-linkedin"]').click();
    cy.get('[data-testid="posting-options"]').should('be.visible');
    cy.get('[data-testid="post-now"]').click();
    cy.contains('Posted successfully').should('be.visible');
  });

  it('should handle content scheduling', () => {
    // Navigate to content calendar
    cy.visit('/content/calendar');
    
    // Create new content
    cy.get('[data-testid="create-new-content"]').click();
    cy.get('[data-testid="content-editor"]').type('Test content for scheduling');
    
    // Schedule for future
    cy.get('[data-testid="schedule-post"]').click();
    cy.get('[data-testid="schedule-date"]').type('2024-12-25');
    cy.get('[data-testid="schedule-time"]').type('10:00');
    cy.get('[data-testid="confirm-schedule"]').click();
    
    // Verify on calendar
    cy.get('[data-testid="calendar-view"]').should('be.visible');
    cy.get('[data-testid="scheduled-post-2024-12-25"]').should('be.visible');
    
    // Test bulk scheduling
    cy.get('[data-testid="bulk-schedule"]').click();
    cy.get('[data-testid="content-idea"]').first().check();
    cy.get('[data-testid="content-idea"]').eq(1).check();
    cy.get('[data-testid="content-idea"]').eq(2).check();
    
    cy.get('[data-testid="schedule-frequency"]').select('daily');
    cy.get('[data-testid="start-date"]').type('2024-12-20');
    cy.get('[data-testid="apply-bulk-schedule"]').click();
    
    // Verify scheduled posts
    cy.get('[data-testid="scheduled-post"]').should('have.length', 3);
  });

  it('should track content performance', () => {
    // Navigate to analytics
    cy.visit('/analytics');
    
    // Select content performance tab
    cy.get('[data-testid="tab-content"]').click();
    
    // Verify metrics display
    cy.get('[data-testid="engagement-rate"]').should('be.visible');
    cy.get('[data-testid="reach-metric"]').should('be.visible');
    cy.get('[data-testid="click-through-rate"]').should('be.visible');
    
    // Test content pillar performance
    cy.get('[data-testid="pillar-performance"]').should('be.visible');
    cy.get('[data-testid="expertise-performance"]').should('contain', '%');
    cy.get('[data-testid="experience-performance"]').should('contain', '%');
    cy.get('[data-testid="evolution-performance"]').should('contain', '%');
    
    // Test time period selector
    cy.get('[data-testid="time-period"]').select('30days');
    cy.contains('Last 30 days').should('be.visible');
    
    // Test export analytics
    cy.get('[data-testid="export-analytics"]').click();
    cy.get('[data-testid="export-format"]').select('csv');
    cy.get('[data-testid="download-export"]').click();
  });

  it('should provide content recommendations', () => {
    // Complete workshop with specific profile
    cy.completeWorkshopToStep(5);
    cy.get('[data-testid="complete-workshop"]').click();
    
    // Navigate to insights
    cy.visit('/analytics/insights');
    
    // Check for recommendations
    cy.get('[data-testid="content-recommendations"]').should('be.visible');
    cy.get('[data-testid="recommendation-item"]').should('have.length.greaterThan', 0);
    
    // Test recommendation categories
    cy.get('[data-testid="high-priority-recommendations"]').should('exist');
    cy.get('[data-testid="medium-priority-recommendations"]').should('exist');
    
    // Test applying recommendation
    cy.get('[data-testid="recommendation-item"]').first().find('[data-testid="apply-recommendation"]').click();
    cy.get('[data-testid="recommendation-applied"]').should('be.visible');
    
    // Verify impact prediction
    cy.get('[data-testid="expected-impact"]').should('contain', '+');
  });
});