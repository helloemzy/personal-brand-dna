describe('Results Sharing E2E Tests', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  it('should generate and access shareable results link', () => {
    // Complete workshop first
    cy.completeWorkshopToStep(5);
    cy.get('[data-testid="complete-workshop"]').click();
    
    // Wait for results
    cy.url().should('include', '/workshop/results');
    cy.contains('Your Brand House is Ready!').should('be.visible');
    
    // Open share modal
    cy.get('[data-testid="share-results"]').click();
    cy.get('[data-testid="share-modal"]').should('be.visible');
    
    // Get share link
    cy.get('[data-testid="share-link-input"]')
      .invoke('val')
      .then((shareLink) => {
        // Extract share code from URL
        const shareCode = shareLink.toString().split('/share/')[1];
        expect(shareCode).to.have.length(8);
        
        // Visit share link in new session
        cy.clearLocalStorage();
        cy.visit(`/share/${shareCode}`);
        
        // Verify public view
        cy.contains('Brand House').should('be.visible');
        cy.get('[data-testid="archetype-public"]').should('be.visible');
        cy.get('[data-testid="mission-public"]').should('be.visible');
        cy.get('[data-testid="values-public"]').should('be.visible');
        
        // Verify no edit capabilities
        cy.get('[data-testid="edit-button"]').should('not.exist');
        cy.get('[data-testid="regenerate-button"]').should('not.exist');
        
        // Test CTA
        cy.contains('Create Your Own Brand House').click();
        cy.url().should('include', '/brand-house');
      });
  });

  it('should handle social sharing', () => {
    // Complete workshop
    cy.completeWorkshopToStep(5);
    cy.get('[data-testid="complete-workshop"]').click();
    
    // Open share modal
    cy.get('[data-testid="share-results"]').click();
    
    // Test LinkedIn sharing
    cy.get('[data-testid="share-linkedin"]').click();
    cy.get('[data-testid="linkedin-preview"]').should('be.visible');
    cy.get('[data-testid="linkedin-text"]').should('contain', 'Just discovered my Brand Archetype');
    
    // Test copy functionality
    cy.get('[data-testid="copy-linkedin-text"]').click();
    cy.contains('Copied to clipboard').should('be.visible');
    
    // Test Twitter sharing
    cy.get('[data-testid="share-twitter"]').click();
    cy.get('[data-testid="twitter-preview"]').should('be.visible');
    cy.get('[data-testid="twitter-text"]').invoke('val').should('have.length.lessThan', 280);
    
    // Test email sharing
    cy.get('[data-testid="share-email"]').click();
    cy.get('[data-testid="email-subject"]').should('contain', 'My Brand House Results');
    cy.get('[data-testid="email-body"]').should('contain', 'Brand Archetype');
  });

  it('should maintain results history', () => {
    // Complete multiple workshops with different data
    const workshopData = [
      { values: ['innovation', 'growth'], archetype: 'Innovative Leader' },
      { values: ['empathy', 'collaboration'], archetype: 'Empathetic Expert' },
      { values: ['strategy', 'vision'], archetype: 'Strategic Visionary' }
    ];
    
    workshopData.forEach((data, index) => {
      cy.visit('/brand-house');
      cy.contains('Begin Workshop').click();
      
      // Quick completion with minimal data
      data.values.forEach(value => {
        cy.get(`[data-testid="value-${value}"]`).click();
      });
      cy.get('[data-testid="value-integrity"]').click();
      cy.get('[data-testid="value-impact"]').click();
      cy.get('[data-testid="value-excellence"]').click();
      
      // Skip through remaining steps
      for (let i = 0; i < 4; i++) {
        cy.get('[data-testid="continue-button"]').click();
        cy.wait(500); // Brief wait for navigation
      }
      
      cy.get('[data-testid="complete-workshop"]').click();
      cy.wait(2000); // Wait for results to save
    });
    
    // Visit results history
    cy.visit('/results-history');
    
    // Should see all 3 results
    cy.get('[data-testid="result-item"]').should('have.length', 3);
    
    // Verify results are in reverse chronological order
    cy.get('[data-testid="result-item"]').first().should('contain', 'Strategic Visionary');
    cy.get('[data-testid="result-item"]').last().should('contain', 'Innovative Leader');
    
    // Test filtering
    cy.get('[data-testid="filter-archetype"]').select('Empathetic Expert');
    cy.get('[data-testid="result-item"]').should('have.length', 1);
    cy.get('[data-testid="result-item"]').should('contain', 'Empathetic Expert');
    
    // Test date range filtering
    cy.get('[data-testid="filter-archetype"]').select('all');
    cy.get('[data-testid="filter-date-range"]').select('today');
    cy.get('[data-testid="result-item"]').should('have.length', 3);
    
    // Test result deletion
    cy.get('[data-testid="result-item"]').first().find('[data-testid="delete-result"]').click();
    cy.get('[data-testid="confirm-delete"]').click();
    cy.get('[data-testid="result-item"]').should('have.length', 2);
  });

  it('should export results in multiple formats', () => {
    // Complete workshop
    cy.completeWorkshopToStep(5);
    cy.get('[data-testid="complete-workshop"]').click();
    
    // Test PDF export
    cy.get('[data-testid="download-report"]').click();
    cy.get('[data-testid="export-pdf"]').click();
    cy.contains('Generating PDF').should('be.visible');
    
    // Test JSON export
    cy.get('[data-testid="export-menu"]').click();
    cy.get('[data-testid="export-json"]').click();
    
    // Verify JSON download (check that no error occurred)
    cy.contains('Export failed').should('not.exist');
    
    // Test CSV export
    cy.get('[data-testid="export-menu"]').click();
    cy.get('[data-testid="export-csv"]').click();
    
    // Verify CSV download
    cy.contains('Export failed').should('not.exist');
  });

  it('should handle result regeneration', () => {
    // Complete workshop
    cy.completeWorkshopToStep(5);
    cy.get('[data-testid="complete-workshop"]').click();
    
    // Wait for initial results
    cy.contains('Your Brand House is Ready!').should('be.visible');
    
    // Capture initial mission statement
    cy.get('[data-testid="mission-statement"]')
      .invoke('text')
      .then((initialMission) => {
        // Regenerate with AI enhancement
        cy.get('[data-testid="regenerate-analysis"]').click();
        cy.get('[data-testid="enhance-with-ai"]').check();
        cy.get('[data-testid="confirm-regenerate"]').click();
        
        // Wait for regeneration
        cy.contains('Regenerating analysis').should('be.visible');
        cy.contains('Regenerating analysis').should('not.exist');
        
        // Verify mission changed
        cy.get('[data-testid="mission-statement"]')
          .invoke('text')
          .should('not.equal', initialMission);
        
        // Verify regeneration indicator
        cy.get('[data-testid="regenerated-badge"]').should('be.visible');
      });
  });

  it('should load results from URL parameters', () => {
    // Complete workshop and get result ID
    cy.completeWorkshopToStep(5);
    cy.get('[data-testid="complete-workshop"]').click();
    
    // Get result ID from URL
    cy.url().then((url) => {
      const resultId = new URL(url).searchParams.get('id');
      expect(resultId).to.exist;
      
      // Clear session and visit results directly
      cy.clearLocalStorage();
      cy.visit(`/workshop/results?id=${resultId}`);
      
      // Should load the specific result
      cy.contains('Your Brand House is Ready!').should('be.visible');
      cy.get('[data-testid="result-id"]').should('contain', resultId);
    });
  });

  it('should handle expired results gracefully', () => {
    // Simulate visiting an expired result
    cy.visit('/workshop/results?id=expired-result-123');
    
    // Should show appropriate error
    cy.contains('Result not found or expired').should('be.visible');
    cy.contains('Start New Workshop').should('be.visible');
    
    // Click to start new workshop
    cy.get('[data-testid="start-new-workshop"]').click();
    cy.url().should('include', '/brand-house');
  });
});