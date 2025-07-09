/**
 * Redux Persist Migrations
 * Central export for all migration-related utilities
 */

export * from './workshopMigrations';
export * from './migrationUtils';

// Re-export commonly used functions for convenience
export {
  workshopMigrate,
  WORKSHOP_MIGRATION_VERSION,
  manuallyMigrateWorkshopState,
  cleanCorruptedWorkshopState,
} from './workshopMigrations';

export {
  forcePurgeAndReload,
  recoverWorkshopState,
  inspectPersistedState,
  checkWorkshopMigrationNeeded,
  handlePersistenceError,
} from './migrationUtils';