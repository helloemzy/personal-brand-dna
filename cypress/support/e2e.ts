// ***********************************************************
// This file is processed and loaded automatically before your test files.
// You can change the location of this file or turn off processing it
// by setting the "supportFile" config option to false.
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands';

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Add custom TypeScript types
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to login as a test user
       * @example cy.loginAsTestUser()
       */
      loginAsTestUser(): Chainable<void>;
      
      /**
       * Custom command to clear all workshop data
       * @example cy.clearWorkshopData()
       */
      clearWorkshopData(): Chainable<void>;
      
      /**
       * Custom command to complete workshop up to a specific step
       * @example cy.completeWorkshopToStep(3)
       */
      completeWorkshopToStep(step: number): Chainable<void>;
    }
  }
}

// Prevent TypeScript from reading file as legacy script
export {};