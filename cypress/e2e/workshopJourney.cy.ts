describe('Brand House Workshop E2E Journey', () => {
  beforeEach(() => {
    // Clear any existing data
    cy.clearLocalStorage();
    cy.clearCookies();
    
    // Visit the app
    cy.visit('/');
  });

  it('should complete full workshop journey from landing to results', () => {
    // Start from landing page
    cy.contains('Build Your Personal Brand').should('be.visible');
    cy.contains('Start Your Brand Journey').click();

    // Should redirect to brand house page
    cy.url().should('include', '/brand-house');
    
    // Pre-workshop assessment
    cy.contains('Quick Self-Assessment').should('be.visible');
    
    // Answer assessment questions
    cy.get('[data-testid="career-stage-select"]').select('senior');
    cy.get('[data-testid="purpose-clarity-slider"]').invoke('val', 8).trigger('change');
    cy.get('[data-testid="uniqueness-slider"]').invoke('val', 7).trigger('change');
    
    cy.contains('Begin Workshop').click();

    // Step 1: Values Audit
    cy.contains('Values Audit').should('be.visible');
    cy.contains('Select 5-7 values that resonate most').should('be.visible');
    
    // Select values
    cy.get('[data-testid="value-innovation"]').click();
    cy.get('[data-testid="value-integrity"]').click();
    cy.get('[data-testid="value-growth"]').click();
    cy.get('[data-testid="value-impact"]').click();
    cy.get('[data-testid="value-collaboration"]').click();
    
    // Add a custom value
    cy.get('[data-testid="custom-value-input"]').type('sustainability');
    cy.get('[data-testid="add-custom-value"]').click();
    cy.get('[data-testid="value-sustainability"]').should('be.visible');
    
    // Select primary values
    cy.contains('Select 2 primary values').should('be.visible');
    cy.get('[data-testid="primary-value-innovation"]').click();
    cy.get('[data-testid="primary-value-integrity"]').click();
    
    // Add value story
    cy.get('[data-testid="value-story-innovation"]').type(
      'I led the development of an AI-powered solution that transformed our customer experience'
    );
    
    cy.get('[data-testid="continue-button"]').click();

    // Step 2: Tone Preferences
    cy.contains('Tone Preferences').should('be.visible');
    
    // Adjust tone sliders
    cy.get('[data-testid="tone-formal-casual"]').invoke('val', 30).trigger('change');
    cy.get('[data-testid="tone-concise-detailed"]').invoke('val', -20).trigger('change');
    cy.get('[data-testid="tone-analytical-creative"]').invoke('val', 40).trigger('change');
    cy.get('[data-testid="tone-serious-playful"]').invoke('val', 10).trigger('change');
    
    // View examples
    cy.get('[data-testid="view-tone-examples"]').click();
    cy.contains('Your tone preview').should('be.visible');
    cy.get('[data-testid="close-examples"]').click();
    
    cy.get('[data-testid="continue-button"]').click();

    // Step 3: Audience Builder
    cy.contains('Audience Builder').should('be.visible');
    
    // Fill in audience persona
    cy.get('[data-testid="audience-title"]').type('Tech Entrepreneurs');
    cy.get('[data-testid="audience-role"]').type('Founder/CEO');
    cy.get('[data-testid="audience-industry"]').select('Technology');
    
    // Add pain points
    cy.get('[data-testid="pain-point-input"]').type('Scaling challenges');
    cy.get('[data-testid="add-pain-point"]').click();
    cy.get('[data-testid="pain-point-input"]').type('Technical debt');
    cy.get('[data-testid="add-pain-point"]').click();
    
    // Add goals
    cy.get('[data-testid="goal-input"]').type('Sustainable growth');
    cy.get('[data-testid="add-goal"]').click();
    cy.get('[data-testid="goal-input"]').type('Market leadership');
    cy.get('[data-testid="add-goal"]').click();
    
    // Add transformation
    cy.get('[data-testid="transformation-outcome"]').type('Scale from startup to unicorn');
    cy.get('[data-testid="transformation-before"]').type('Struggling with growth');
    cy.get('[data-testid="transformation-after"]').type('Leading market innovator');
    
    cy.get('[data-testid="continue-button"]').click();

    // Step 4: Writing Sample
    cy.contains('Writing Sample').should('be.visible');
    
    // Choose a prompt
    cy.get('[data-testid="writing-prompt-1"]').click();
    
    // Enter writing sample
    cy.get('[data-testid="writing-sample-textarea"]').type(
      'I help tech entrepreneurs transform their startups into scalable businesses. ' +
      'My approach combines deep technical expertise with strategic business thinking. ' +
      'Over the past decade, I\'ve guided 50+ startups through critical growth phases, ' +
      'helping them avoid common pitfalls and accelerate their path to product-market fit. ' +
      'What sets me apart is my ability to translate complex technical concepts into ' +
      'actionable business strategies that drive real results.'
    );
    
    // Wait for auto-save indicator
    cy.get('[data-testid="save-status"]').should('contain', 'Saved');
    
    cy.get('[data-testid="continue-button"]').click();

    // Step 5: Personality Quiz
    cy.contains('Personality Quiz').should('be.visible');
    
    // Answer quiz questions
    cy.get('[data-testid="quiz-answer-0"]').click(); // Working style
    cy.get('[data-testid="quiz-answer-2"]').click(); // Problem solving
    cy.get('[data-testid="quiz-answer-1"]').click(); // Energy source
    cy.get('[data-testid="quiz-answer-0"]').click(); // Communication
    cy.get('[data-testid="quiz-answer-3"]').click(); // Leadership
    
    // Professional identity questions
    cy.get('[data-testid="professional-role"]').type('Chief Technology Officer');
    cy.get('[data-testid="years-experience"]').type('15');
    cy.get('[data-testid="known-for"]').type('Building scalable tech teams, product innovation, strategic thinking');
    cy.get('[data-testid="controversial-opinion"]').type('Most startups fail because they focus on features instead of problems');
    
    cy.get('[data-testid="complete-workshop"]').click();

    // Results page
    cy.url().should('include', '/workshop/results');
    cy.contains('Your Brand House is Ready!').should('be.visible');
    
    // Verify archetype display
    cy.get('[data-testid="archetype-name"]').should('be.visible');
    cy.get('[data-testid="archetype-description"]').should('be.visible');
    cy.get('[data-testid="confidence-score"]').should('contain', '%');
    
    // Verify mission statement
    cy.contains('Your Mission Statement').should('be.visible');
    cy.get('[data-testid="mission-statement"]').should('not.be.empty');
    
    // Verify UVP section
    cy.contains('Your Unique Value Proposition').should('be.visible');
    cy.get('[data-testid="uvp-statement"]').should('not.be.empty');
    
    // Verify content pillars
    cy.contains('Your Content Pillars').should('be.visible');
    cy.get('[data-testid="content-pillar"]').should('have.length', 3);
    
    // Test download functionality
    cy.get('[data-testid="download-report"]').click();
    cy.contains('Generating your report').should('be.visible');
    
    // Test share functionality
    cy.get('[data-testid="share-results"]').click();
    cy.get('[data-testid="share-modal"]').should('be.visible');
    cy.get('[data-testid="copy-share-link"]').click();
    cy.contains('Link copied').should('be.visible');
    cy.get('[data-testid="close-share-modal"]').click();
  });

  it('should handle workshop interruption and recovery', () => {
    // Start workshop
    cy.visit('/brand-house');
    cy.contains('Begin Workshop').click();
    
    // Complete first two steps
    // Step 1: Values
    cy.get('[data-testid="value-innovation"]').click();
    cy.get('[data-testid="value-integrity"]').click();
    cy.get('[data-testid="value-growth"]').click();
    cy.get('[data-testid="value-impact"]').click();
    cy.get('[data-testid="value-collaboration"]').click();
    cy.get('[data-testid="continue-button"]').click();
    
    // Step 2: Tone (partially complete)
    cy.get('[data-testid="tone-formal-casual"]').invoke('val', 20).trigger('change');
    
    // Simulate interruption - navigate away
    cy.visit('/');
    
    // Return to workshop
    cy.visit('/brand-house');
    
    // Should see recovery modal
    cy.contains('Resume Your Workshop').should('be.visible');
    cy.get('[data-testid="resume-workshop"]').click();
    
    // Should be back at step 2 with previous data saved
    cy.contains('Tone Preferences').should('be.visible');
    cy.get('[data-testid="tone-formal-casual"]').should('have.value', '20');
    
    // Verify step 1 data is preserved
    cy.get('[data-testid="back-button"]').click();
    cy.get('[data-testid="value-innovation"]').should('have.class', 'selected');
    cy.get('[data-testid="value-integrity"]').should('have.class', 'selected');
  });

  it('should validate required fields and show errors', () => {
    cy.visit('/brand-house');
    cy.contains('Begin Workshop').click();
    
    // Try to continue without selecting values
    cy.get('[data-testid="continue-button"]').click();
    cy.contains('Please select at least 5 values').should('be.visible');
    
    // Select only 3 values
    cy.get('[data-testid="value-innovation"]').click();
    cy.get('[data-testid="value-integrity"]').click();
    cy.get('[data-testid="value-growth"]').click();
    cy.get('[data-testid="continue-button"]').click();
    cy.contains('Please select at least 5 values').should('be.visible');
    
    // Complete values selection
    cy.get('[data-testid="value-impact"]').click();
    cy.get('[data-testid="value-collaboration"]').click();
    cy.get('[data-testid="continue-button"]').click();
    
    // Should move to next step
    cy.contains('Tone Preferences').should('be.visible');
  });

  it('should handle mobile viewport', () => {
    // Set mobile viewport
    cy.viewport('iphone-x');
    
    cy.visit('/brand-house');
    
    // Mobile menu should be visible
    cy.get('[data-testid="mobile-menu-button"]').should('be.visible');
    
    // Start workshop
    cy.contains('Begin Workshop').click();
    
    // Progress indicator should be compact
    cy.get('[data-testid="progress-indicator"]').should('have.class', 'mobile');
    
    // Values should be in grid layout
    cy.get('[data-testid="values-grid"]').should('have.class', 'mobile-grid');
    
    // Complete a step to test mobile navigation
    cy.get('[data-testid="value-innovation"]').click();
    cy.get('[data-testid="value-integrity"]').click();
    cy.get('[data-testid="value-growth"]').click();
    cy.get('[data-testid="value-impact"]').click();
    cy.get('[data-testid="value-collaboration"]').click();
    cy.get('[data-testid="continue-button"]').click();
    
    // Mobile-specific interactions should work
    cy.contains('Tone Preferences').should('be.visible');
  });

  it('should test accessibility features', () => {
    cy.visit('/brand-house');
    
    // Test keyboard navigation
    cy.get('body').tab();
    cy.focused().should('have.attr', 'data-testid', 'skip-to-content');
    
    // Start workshop with keyboard
    cy.get('[data-testid="start-workshop-button"]').focus();
    cy.focused().type('{enter}');
    
    // Navigate values with keyboard
    cy.get('[data-testid="value-innovation"]').focus();
    cy.focused().type(' '); // Space to select
    cy.focused().tab();
    cy.focused().type(' '); // Select next value
    
    // Test screen reader announcements
    cy.get('[role="status"]').should('contain', '2 values selected');
    
    // Test ARIA labels
    cy.get('[data-testid="continue-button"]').should('have.attr', 'aria-label');
    cy.get('[data-testid="progress-indicator"]').should('have.attr', 'aria-label', 'Workshop progress');
  });

  it('should handle API errors gracefully', () => {
    // Intercept API calls and force errors
    cy.intercept('POST', '/api/workshop/save-progress', {
      statusCode: 500,
      body: { error: 'Server error' }
    }).as('saveError');
    
    cy.visit('/brand-house');
    cy.contains('Begin Workshop').click();
    
    // Complete a step
    cy.get('[data-testid="value-innovation"]').click();
    cy.get('[data-testid="value-integrity"]').click();
    cy.get('[data-testid="value-growth"]').click();
    cy.get('[data-testid="value-impact"]').click();
    cy.get('[data-testid="value-collaboration"]').click();
    cy.get('[data-testid="continue-button"]').click();
    
    // Wait for save attempt
    cy.wait('@saveError');
    
    // Should show error but allow continuation
    cy.contains('Failed to save progress').should('be.visible');
    cy.contains('Your progress is saved locally').should('be.visible');
    
    // Should still be able to continue
    cy.contains('Tone Preferences').should('be.visible');
  });

  it('should test performance with large data', () => {
    cy.visit('/brand-house');
    cy.contains('Begin Workshop').click();
    
    // Add many custom values
    for (let i = 0; i < 10; i++) {
      cy.get('[data-testid="custom-value-input"]').type(`custom-value-${i}`);
      cy.get('[data-testid="add-custom-value"]').click();
    }
    
    // Select values
    cy.get('[data-testid^="value-"]').each(($el, index) => {
      if (index < 7) {
        cy.wrap($el).click();
      }
    });
    
    cy.get('[data-testid="continue-button"]').click();
    
    // Complete remaining steps quickly
    cy.get('[data-testid="continue-button"]').click(); // Skip tone
    
    // Add multiple audience personas
    for (let i = 0; i < 3; i++) {
      cy.get('[data-testid="audience-title"]').type(`Audience ${i}`);
      cy.get('[data-testid="audience-role"]').type(`Role ${i}`);
      cy.get('[data-testid="add-audience"]').click();
    }
    
    cy.get('[data-testid="continue-button"]').click();
    
    // Add long writing sample
    const longText = 'Lorem ipsum dolor sit amet. '.repeat(100);
    cy.get('[data-testid="writing-sample-textarea"]').type(longText, { delay: 0 });
    
    cy.get('[data-testid="continue-button"]').click();
    
    // Complete quiz
    cy.get('[data-testid^="quiz-answer-"]').first().click();
    cy.get('[data-testid="complete-workshop"]').click();
    
    // Results should load without performance issues
    cy.contains('Your Brand House is Ready!', { timeout: 10000 }).should('be.visible');
  });
});