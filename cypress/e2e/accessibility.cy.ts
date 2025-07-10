describe('Accessibility E2E Tests', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  it('should meet WCAG accessibility standards on landing page', () => {
    cy.visit('/');
    cy.injectAxe();
    
    // Check for accessibility violations
    cy.checkA11y(null, {
      rules: {
        'color-contrast': { enabled: true },
        'keyboard-access': { enabled: true },
        'focus-visible': { enabled: true },
        'aria-labels': { enabled: true }
      }
    });
    
    // Test keyboard navigation
    cy.get('body').tab();
    cy.focused().should('have.attr', 'data-testid', 'skip-to-content');
    
    // Navigate through main elements
    cy.focused().tab();
    cy.focused().should('contain', 'Start Your Brand Journey');
    
    // Test skip link functionality
    cy.get('[data-testid="skip-to-content"]').click();
    cy.focused().should('have.attr', 'data-testid', 'main-content');
  });

  it('should maintain accessibility during workshop flow', () => {
    cy.visit('/brand-house');
    cy.injectAxe();
    
    // Check accessibility on workshop start
    cy.checkA11y();
    
    // Start workshop
    cy.contains('Begin Workshop').click();
    
    // Step 1: Values Audit
    cy.checkA11y();
    
    // Test keyboard navigation for values
    cy.get('[data-testid="value-innovation"]').focus();
    cy.focused().type(' '); // Select with space
    cy.focused().should('have.attr', 'aria-pressed', 'true');
    
    // Test screen reader announcements
    cy.get('[role="status"]').should('contain', '1 value selected');
    
    // Continue selecting values with keyboard
    cy.get('[data-testid="value-integrity"]').focus().type(' ');
    cy.get('[data-testid="value-growth"]').focus().type(' ');
    cy.get('[data-testid="value-impact"]').focus().type(' ');
    cy.get('[data-testid="value-collaboration"]').focus().type(' ');
    
    // Check announcement for required count
    cy.get('[role="status"]').should('contain', '5 values selected');
    
    // Navigate to next step
    cy.get('[data-testid="continue-button"]').focus().type('{enter}');
    
    // Step 2: Tone Preferences
    cy.checkA11y();
    
    // Test slider accessibility
    cy.get('[data-testid="tone-formal-casual"]').should('have.attr', 'aria-label');
    cy.get('[data-testid="tone-formal-casual"]').focus();
    cy.focused().type('{rightarrow}{rightarrow}{rightarrow}');
    
    // Verify slider value announced
    cy.get('[aria-live="polite"]').should('contain', 'Formal');
  });

  it('should handle high contrast mode', () => {
    // Enable high contrast simulation
    cy.visit('/', {
      onBeforeLoad: (win) => {
        win.matchMedia = cy.stub().returns({
          matches: true,
          addListener: () => {},
          removeListener: () => {}
        });
      }
    });
    
    // Check that high contrast styles are applied
    cy.get('body').should('have.class', 'high-contrast');
    
    // Verify contrast ratios meet WCAG AA standards
    cy.get('[data-testid="primary-button"]').should('have.css', 'background-color')
      .then((bgColor) => {
        cy.get('[data-testid="primary-button"]').should('have.css', 'color')
          .then((textColor) => {
            // In a real implementation, you'd calculate contrast ratio
            expect(bgColor).to.not.equal(textColor);
          });
      });
  });

  it('should support screen readers', () => {
    cy.visit('/brand-house');
    
    // Test heading hierarchy
    cy.get('h1').should('exist');
    cy.get('h1').should('contain', 'Brand House');
    
    // Check that headings are properly nested
    cy.get('h1, h2, h3, h4, h5, h6').then(($headings) => {
      const headingLevels = Array.from($headings).map(el => parseInt(el.tagName.slice(1)));
      
      // Verify no heading levels are skipped
      for (let i = 1; i < headingLevels.length; i++) {
        const currentLevel = headingLevels[i];
        const prevLevel = headingLevels[i - 1];
        expect(currentLevel - prevLevel).to.be.at.most(1);
      }
    });
    
    // Test form labels
    cy.get('input, select, textarea').each(($input) => {
      const id = $input.attr('id');
      if (id) {
        cy.get(`label[for="${id}"]`).should('exist');
      } else {
        cy.wrap($input).should('have.attr', 'aria-label');
      }
    });
    
    // Test landmarks
    cy.get('[role="main"], main').should('exist');
    cy.get('[role="navigation"], nav').should('exist');
    cy.get('[role="banner"], header').should('exist');
  });

  it('should work with voice control', () => {
    cy.visit('/brand-house');
    
    // Test voice control commands (simulated)
    // "Click start workshop"
    cy.get('[data-testid="start-workshop-button"]').should('have.attr', 'aria-label')
      .then((label) => {
        expect(label).to.match(/start|begin|workshop/i);
      });
    
    cy.contains('Begin Workshop').click();
    
    // Test voice commands for values selection
    // "Click innovation"
    cy.get('[data-testid="value-innovation"]').should('have.attr', 'aria-label', 'Select innovation value');
    
    // Test numbered navigation
    cy.get('[data-testid="step-1"]').should('have.attr', 'aria-label', 'Step 1 of 5: Values Audit');
  });

  it('should support reduced motion preferences', () => {
    // Simulate reduced motion preference
    cy.visit('/', {
      onBeforeLoad: (win) => {
        Object.defineProperty(win, 'matchMedia', {
          writable: true,
          value: cy.stub().returns({
            matches: true,
            media: '(prefers-reduced-motion: reduce)',
            onchange: null,
            addListener: cy.stub(),
            removeListener: cy.stub(),
            addEventListener: cy.stub(),
            removeEventListener: cy.stub(),
            dispatchEvent: cy.stub(),
          }),
        });
      }
    });
    
    // Check that animations are disabled
    cy.get('[data-testid="animated-element"]').should('have.css', 'animation-duration', '0s');
    cy.get('[data-testid="transition-element"]').should('have.css', 'transition-duration', '0s');
  });

  it('should maintain focus management during modals', () => {
    cy.visit('/workshop/results');
    
    // Open share modal
    cy.get('[data-testid="share-results"]').click();
    
    // Focus should move to modal
    cy.focused().should('be.within', '[data-testid="share-modal"]');
    
    // Test focus trap
    cy.focused().tab();
    cy.focused().should('be.within', '[data-testid="share-modal"]');
    
    // Test escape key
    cy.get('body').type('{esc}');
    cy.get('[data-testid="share-modal"]').should('not.exist');
    
    // Focus should return to trigger
    cy.focused().should('have.attr', 'data-testid', 'share-results');
  });

  it('should provide clear error messages', () => {
    cy.visit('/brand-house');
    cy.contains('Begin Workshop').click();
    
    // Try to continue without required input
    cy.get('[data-testid="continue-button"]').click();
    
    // Error should be announced to screen readers
    cy.get('[role="alert"]').should('contain', 'Please select at least 5 values');
    cy.get('[aria-live="assertive"]').should('contain', 'Please select at least 5 values');
    
    // Error should be associated with the field
    cy.get('[data-testid="values-container"]').should('have.attr', 'aria-describedby');
  });

  it('should support zoom up to 200%', () => {
    cy.visit('/');
    
    // Simulate 200% zoom
    cy.viewport(640, 360); // Half the normal viewport width
    
    // Check that content is still accessible
    cy.get('[data-testid="navigation"]').should('be.visible');
    cy.get('[data-testid="main-content"]').should('be.visible');
    
    // Test mobile menu at zoomed in level
    cy.get('[data-testid="mobile-menu-button"]').should('be.visible');
    cy.get('[data-testid="mobile-menu-button"]').click();
    
    cy.get('[data-testid="mobile-menu"]').should('be.visible');
    
    // All menu items should be reachable
    cy.get('[data-testid="mobile-menu"] a').each(($link) => {
      cy.wrap($link).should('be.visible');
    });
  });

  it('should support alternative input methods', () => {
    cy.visit('/brand-house');
    cy.contains('Begin Workshop').click();
    
    // Test switch navigation (simulated with tab and enter)
    cy.get('body').tab();
    cy.focused().type('{enter}'); // Activate first focusable element
    
    // Test single switch scanning (simulated)
    let currentElement = 0;
    const elements = ['value-innovation', 'value-integrity', 'value-growth'];
    
    elements.forEach((elementId) => {
      cy.get(`[data-testid="${elementId}"]`).focus();
      cy.focused().type(' '); // Select with space (switch activation)
    });
    
    // Verify selections were made
    cy.get('[role="status"]').should('contain', '3 values selected');
  });

  it('should provide clear progress indicators', () => {
    cy.visit('/brand-house');
    cy.contains('Begin Workshop').click();
    
    // Test progress announcement
    cy.get('[data-testid="progress-indicator"]')
      .should('have.attr', 'aria-label', 'Workshop progress: Step 1 of 5, Values Audit');
    
    // Complete step and check progress update
    cy.get('[data-testid="value-innovation"]').click();
    cy.get('[data-testid="value-integrity"]').click();
    cy.get('[data-testid="value-growth"]').click();
    cy.get('[data-testid="value-impact"]').click();
    cy.get('[data-testid="value-collaboration"]').click();
    cy.get('[data-testid="continue-button"]').click();
    
    // Progress should update
    cy.get('[data-testid="progress-indicator"]')
      .should('have.attr', 'aria-label', 'Workshop progress: Step 2 of 5, Tone Preferences');
    
    // Live region should announce progress
    cy.get('[aria-live="polite"]').should('contain', 'Step 2 of 5');
  });
});