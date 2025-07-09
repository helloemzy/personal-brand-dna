const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const glob = require('glob');

// Configuration
const config = {
  srcDir: path.join(__dirname, '../public/images'),
  outputDir: path.join(__dirname, '../public/images/optimized'),
  formats: ['webp', 'avif'],
  sizes: [640, 750, 828, 1080, 1200, 1920, 2048],
  quality: {
    jpeg: 85,
    webp: 85,
    avif: 80,
    png: 90,
  },
};

// Ensure output directory exists
if (!fs.existsSync(config.outputDir)) {
  fs.mkdirSync(config.outputDir, { recursive: true });
}

// Get all image files
const imageFiles = glob.sync(`${config.srcDir}/**/*.{jpg,jpeg,png,gif}`, {
  ignore: [`${config.outputDir}/**/*`],
});

console.log(`Found ${imageFiles.length} images to optimize...`);

// Process each image
async function processImage(imagePath) {
  const relativePath = path.relative(config.srcDir, imagePath);
  const parsedPath = path.parse(relativePath);
  const outputSubDir = path.join(config.outputDir, parsedPath.dir);

  // Ensure subdirectory exists
  if (!fs.existsSync(outputSubDir)) {
    fs.mkdirSync(outputSubDir, { recursive: true });
  }

  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    console.log(`Processing: ${relativePath}`);
    
    // Generate multiple sizes for each format
    const promises = [];

    // Original format optimization
    const originalExt = parsedPath.ext.toLowerCase().replace('.', '');
    const quality = config.quality[originalExt] || 85;

    for (const width of config.sizes) {
      if (width <= metadata.width) {
        const outputPath = path.join(
          outputSubDir,
          `${parsedPath.name}-${width}w${parsedPath.ext}`
        );

        promises.push(
          image
            .clone()
            .resize(width, null, {
              withoutEnlargement: true,
              fit: 'inside',
            })
            .jpeg({ quality: config.quality.jpeg })
            .png({ quality: config.quality.png })
            .toFile(outputPath)
            .then(() => {
              console.log(`  ✓ Generated ${width}w version`);
            })
        );
      }
    }

    // Generate WebP versions
    for (const width of config.sizes) {
      if (width <= metadata.width) {
        const outputPath = path.join(
          outputSubDir,
          `${parsedPath.name}-${width}w.webp`
        );

        promises.push(
          image
            .clone()
            .resize(width, null, {
              withoutEnlargement: true,
              fit: 'inside',
            })
            .webp({ quality: config.quality.webp })
            .toFile(outputPath)
            .then(() => {
              console.log(`  ✓ Generated ${width}w WebP version`);
            })
        );
      }
    }

    // Generate AVIF versions (smaller but better quality)
    for (const width of config.sizes) {
      if (width <= metadata.width) {
        const outputPath = path.join(
          outputSubDir,
          `${parsedPath.name}-${width}w.avif`
        );

        promises.push(
          image
            .clone()
            .resize(width, null, {
              withoutEnlargement: true,
              fit: 'inside',
            })
            .avif({ quality: config.quality.avif })
            .toFile(outputPath)
            .then(() => {
              console.log(`  ✓ Generated ${width}w AVIF version`);
            })
        );
      }
    }

    // Generate blur placeholder
    const placeholderPath = path.join(
      outputSubDir,
      `${parsedPath.name}-placeholder.jpg`
    );

    promises.push(
      image
        .clone()
        .resize(20)
        .blur(10)
        .jpeg({ quality: 20 })
        .toFile(placeholderPath)
        .then(() => {
          console.log('  ✓ Generated blur placeholder');
        })
    );

    await Promise.all(promises);
    
    // Calculate size savings
    const originalSize = fs.statSync(imagePath).size;
    let optimizedSize = 0;
    
    const optimizedFiles = glob.sync(`${outputSubDir}/${parsedPath.name}-*`);
    optimizedFiles.forEach(file => {
      optimizedSize += fs.statSync(file).size;
    });
    
    const savings = ((originalSize - optimizedSize) / originalSize * 100).toFixed(2);
    console.log(`  ✅ Completed! Size savings: ${savings}%\n`);
    
  } catch (error) {
    console.error(`  ❌ Error processing ${relativePath}:`, error.message);
  }
}

// Process all images
async function optimizeAllImages() {
  console.log('Starting image optimization...\n');
  
  for (const imagePath of imageFiles) {
    await processImage(imagePath);
  }
  
  console.log('✅ Image optimization complete!');
  
  // Generate image manifest
  generateImageManifest();
}

// Generate manifest file for optimized images
function generateImageManifest() {
  const manifest = {};
  
  imageFiles.forEach(imagePath => {
    const relativePath = path.relative(config.srcDir, imagePath);
    const parsedPath = path.parse(relativePath);
    const key = relativePath.replace(/\\/g, '/');
    
    manifest[key] = {
      original: `/images/${key}`,
      optimized: {
        sizes: {},
        webp: {},
        avif: {},
        placeholder: `/images/optimized/${parsedPath.dir}/${parsedPath.name}-placeholder.jpg`,
      },
    };
    
    // Add size variants
    config.sizes.forEach(width => {
      manifest[key].optimized.sizes[width] = `/images/optimized/${parsedPath.dir}/${parsedPath.name}-${width}w${parsedPath.ext}`;
      manifest[key].optimized.webp[width] = `/images/optimized/${parsedPath.dir}/${parsedPath.name}-${width}w.webp`;
      manifest[key].optimized.avif[width] = `/images/optimized/${parsedPath.dir}/${parsedPath.name}-${width}w.avif`;
    });
  });
  
  const manifestPath = path.join(config.outputDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n📄 Image manifest generated at: ${manifestPath}`);
}

// Check if sharp is installed
try {
  require.resolve('sharp');
  optimizeAllImages().catch(console.error);
} catch (e) {
  console.error('❌ Sharp is not installed. Please run: npm install --save-dev sharp glob');
  process.exit(1);
}