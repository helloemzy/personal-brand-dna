# Monorepo Structure Fix
**Date**: January 12, 2025
**Issue**: Build scripts pointing to wrong directory
**Status**: FIXED

## Problem Description

The project has a monorepo structure with workspaces configured, but the web app source files are in the root directory instead of `apps/web/`. This caused the npm scripts to fail because they were trying to run commands in `apps/web/` which only contained a `package.json` file.

### Directory Structure Issue:
```
Expected:
apps/
  web/
    src/
    public/
    package.json
    
Actual:
src/           (in root)
public/        (in root)
apps/
  web/
    package.json  (only this file)
```

## Solution Implemented

Updated the npm scripts in the root `package.json` to run from the root directory instead of `cd apps/web`:

### Changes Made:
1. **start:web script**:
   - Before: `"start:web": "cd apps/web && craco start"`
   - After: `"start:web": "craco start"`

2. **build:web script**:
   - Before: `"build:web": "cd apps/web && NODE_OPTIONS='--max-old-space-size=4096' ..."`
   - After: `"build:web": "NODE_OPTIONS='--max-old-space-size=4096' ..."`

## Why This Solution?

1. **Minimal Changes**: Only updated 2 lines in package.json
2. **No File Movement**: Avoided moving hundreds of files which could break imports
3. **Preserves Functionality**: All existing code continues to work
4. **Deployment Compatible**: Vercel expects build output in root/build directory

## Alternative Solution (Not Implemented)

Moving all web app files to `apps/web/` would be the "correct" monorepo structure, but would require:
- Moving src/, public/, and all config files
- Updating all import paths
- Updating deployment configurations
- Risk of breaking existing functionality

## Build Process

The build process now works as follows:
1. `npm run build` runs `npm run build:all`
2. `build:all` runs in sequence:
   - `build:shared` - Builds @brandpillar/shared package
   - `build:queue` - Builds @brandpillar/queue package  
   - `build:web` - Builds React app from root directory
   - `build:agents` - Builds AI agents in apps/agents/

## Verification

To verify the fix works:
```bash
# Install dependencies
npm install

# Build shared packages first
npm run build:shared
npm run build:queue

# Build web app
npm run build:web

# Or build everything
npm run build
```

## Deployment Impact

No changes needed for deployment:
- Vercel still reads from `vercel.json` in root
- Build output still goes to `build/` directory
- All API functions remain in `api/` directory

## Future Considerations

If a proper monorepo structure is desired in the future:
1. Create a migration script to move files
2. Update all import paths
3. Test thoroughly before deploying
4. Update CI/CD configurations

For now, the current solution maintains functionality while fixing the immediate build issue.