// ***********************************************
// Custom commands for Brand House workshop testing
// ***********************************************

// Login as test user
Cypress.Commands.add('loginAsTestUser', () => {
  cy.window().then((win) => {
    // Set auth token in localStorage
    win.localStorage.setItem('auth-token', 'test-user-token');
    win.localStorage.setItem('user', JSON.stringify({
      id: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User'
    }));
  });
});

// Clear workshop data
Cypress.Commands.add('clearWorkshopData', () => {
  cy.window().then((win) => {
    // Clear workshop-related localStorage keys
    const keysToRemove = [
      'workshop-state',
      'workshop-results',
      'workshop-session',
      'persist:workshop'
    ];
    
    keysToRemove.forEach(key => {
      win.localStorage.removeItem(key);
    });
  });
  
  // Clear IndexedDB if used
  cy.window().then((win) => {
    if (win.indexedDB) {
      win.indexedDB.deleteDatabase('BrandPillarDB');
    }
  });
});

// Complete workshop up to a specific step
Cypress.Commands.add('completeWorkshopToStep', (targetStep: number) => {
  cy.visit('/brand-house');
  cy.contains('Begin Workshop').click();
  
  // Step 1: Values
  if (targetStep >= 1) {
    cy.get('[data-testid="value-innovation"]').click();
    cy.get('[data-testid="value-integrity"]').click();
    cy.get('[data-testid="value-growth"]').click();
    cy.get('[data-testid="value-impact"]').click();
    cy.get('[data-testid="value-collaboration"]').click();
    
    if (targetStep > 1) {
      cy.get('[data-testid="continue-button"]').click();
    }
  }
  
  // Step 2: Tone
  if (targetStep >= 2) {
    cy.get('[data-testid="tone-formal-casual"]').invoke('val', 20).trigger('change');
    cy.get('[data-testid="tone-concise-detailed"]').invoke('val', -10).trigger('change');
    cy.get('[data-testid="tone-analytical-creative"]').invoke('val', 30).trigger('change');
    cy.get('[data-testid="tone-serious-playful"]').invoke('val', 0).trigger('change');
    
    if (targetStep > 2) {
      cy.get('[data-testid="continue-button"]').click();
    }
  }
  
  // Step 3: Audience
  if (targetStep >= 3) {
    cy.get('[data-testid="audience-title"]').type('Tech Entrepreneurs');
    cy.get('[data-testid="audience-role"]').type('Founder/CEO');
    cy.get('[data-testid="audience-industry"]').select('Technology');
    cy.get('[data-testid="pain-point-input"]').type('Scaling challenges');
    cy.get('[data-testid="add-pain-point"]').click();
    cy.get('[data-testid="goal-input"]').type('Sustainable growth');
    cy.get('[data-testid="add-goal"]').click();
    
    if (targetStep > 3) {
      cy.get('[data-testid="continue-button"]').click();
    }
  }
  
  // Step 4: Writing Sample
  if (targetStep >= 4) {
    cy.get('[data-testid="writing-sample-textarea"]').type(
      'I help tech entrepreneurs build scalable businesses through innovative strategies.'
    );
    
    if (targetStep > 4) {
      cy.get('[data-testid="continue-button"]').click();
    }
  }
  
  // Step 5: Personality Quiz
  if (targetStep >= 5) {
    cy.get('[data-testid="quiz-answer-0"]').click();
    cy.get('[data-testid="professional-role"]').type('Chief Technology Officer');
    cy.get('[data-testid="known-for"]').type('Building scalable tech teams');
  }
});

// Export to satisfy TypeScript
export {};