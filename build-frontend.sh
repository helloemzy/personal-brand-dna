#!/bin/bash

# Build script for Vercel deployment
echo "Building Personal Brand DNA Frontend for Vercel..."

# Move to frontend directory
cd _frontend-disabled

# Install dependencies
echo "Installing dependencies..."
npm install

# Set production environment variables
export REACT_APP_API_URL="/api"
export REACT_APP_AI_PIPELINE_URL="/api"
export NODE_ENV=production

# Build the React app
echo "Building React application..."
npm run build

# Move build files to root for Vercel static hosting
echo "Moving build files..."
cd ..
rm -rf build
mv _frontend-disabled/build ./build

echo "Frontend build complete!"
echo "Build directory created at: ./build"