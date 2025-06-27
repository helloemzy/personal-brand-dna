/**
 * Secure Express Application Configuration
 * Example of integrating SQL injection and XSS prevention tools
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const inputSanitizer = require('./services/inputSanitizationService');
const xssPrevention = require('./middleware/xssPrevention');
const secureQueryBuilder = require('./utils/secureQueryBuilder');

// Initialize Express app
const app = express();

// Basic security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: false // We'll use our custom CSP
}));

// Apply XSS prevention middleware
app.use(xssPrevention.prevent());

// Content type validation for POST/PUT requests
app.use(xssPrevention.contentTypeValidation(['application/json', 'multipart/form-data']));

// Rate limiting
app.use('/api/', xssPrevention.rateLimiting({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// File upload protection
app.use(xssPrevention.fileUploadProtection());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Compression
app.use(compression());

// Sanitize JSON responses
app.use(xssPrevention.sanitizeJsonResponse());

// Example route with input sanitization
app.post('/api/users/search', async (req, res, next) => {
  try {
    // Sanitize input using the service
    const sanitizedInput = inputSanitizer.sanitizeObject(req.body, {
      username: { type: 'sql', context: 'string', required: false },
      email: { type: 'email', required: false },
      role: { type: 'sql', context: 'string', required: false },
      limit: { type: 'integer', options: { min: 1, max: 100 } }
    });

    // Build secure query
    const query = secureQueryBuilder
      .select('users', ['id', 'username', 'email', 'role', 'created_at'])
      .limit(sanitizedInput.limit || 10);

    // Add conditions if provided
    if (sanitizedInput.username) {
      query.where('username', 'ILIKE', `%${sanitizedInput.username}%`);
    }
    if (sanitizedInput.email) {
      query.where('email', '=', sanitizedInput.email);
    }
    if (sanitizedInput.role) {
      query.where('role', '=', sanitizedInput.role);
    }

    // Execute query
    const users = await query.execute(req.db);

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    next(error);
  }
});

// Example route with XSS prevention
app.post('/api/posts', async (req, res, next) => {
  try {
    // Sanitize HTML content
    const sanitizedPost = inputSanitizer.sanitizeObject(req.body, {
      title: { type: 'string', required: true },
      content: { type: 'string', context: 'html', required: true },
      tags: { 
        type: 'array',
        validate: (tags) => Array.isArray(tags) && tags.length <= 10
      }
    });

    // Additional validation for tags
    if (sanitizedPost.tags) {
      sanitizedPost.tags = sanitizedPost.tags.map(tag => 
        inputSanitizer.sanitizeForHTML(tag, 'text')
      );
    }

    // Build secure insert query
    const query = secureQueryBuilder.insert('posts', {
      user_id: req.user.id, // Assuming authenticated user
      title: sanitizedPost.title,
      content: sanitizedPost.content,
      tags: JSON.stringify(sanitizedPost.tags || []),
      created_at: new Date()
    });

    const result = await query.execute(req.db);

    res.json({
      success: true,
      data: result[0]
    });
  } catch (error) {
    next(error);
  }
});

// Example route with file upload
const multer = require('multer');
const upload = multer({ 
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

app.post('/api/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // File is already sanitized by xssPrevention middleware
    const sanitizedFilename = inputSanitizer.sanitizeFilename(req.file.originalname);

    // Store file info in database
    const query = secureQueryBuilder.insert('files', {
      user_id: req.user.id,
      filename: sanitizedFilename,
      mime_type: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      uploaded_at: new Date()
    });

    const result = await query.execute(req.db);

    res.json({
      success: true,
      data: {
        id: result[0].id,
        filename: sanitizedFilename,
        size: req.file.size
      }
    });
  } catch (error) {
    next(error);
  }
});

// Example of preventing SQL injection in complex queries
app.get('/api/analytics/users', async (req, res, next) => {
  try {
    // Sanitize and validate input parameters
    const params = inputSanitizer.sanitizeObject(req.query, {
      startDate: { 
        type: 'string', 
        validate: (date) => !isNaN(Date.parse(date))
      },
      endDate: { 
        type: 'string', 
        validate: (date) => !isNaN(Date.parse(date))
      },
      groupBy: { 
        type: 'string',
        validate: (value) => ['day', 'week', 'month'].includes(value)
      }
    });

    // Build secure aggregation query
    let query = secureQueryBuilder
      .select('users', ['COUNT(*) as count', 'DATE_TRUNC($1, created_at) as period'])
      .groupBy('period')
      .orderBy('period', 'ASC');

    // Add date filters
    if (params.startDate) {
      query.where('created_at', '>=', new Date(params.startDate));
    }
    if (params.endDate) {
      query.where('created_at', '<=', new Date(params.endDate));
    }

    // The $1 parameter for DATE_TRUNC is handled separately
    const queryObj = query.build();
    queryObj.values.unshift(params.groupBy || 'day');

    const results = await req.db.query(queryObj);

    res.json({
      success: true,
      data: results.rows
    });
  } catch (error) {
    next(error);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Sanitize error messages to prevent information leakage
  let message = 'Internal server error';
  let status = 500;

  if (err.message.includes('Invalid input')) {
    message = 'Invalid input provided';
    status = 400;
  } else if (err.message.includes('SQL injection')) {
    message = 'Invalid request';
    status = 400;
  } else if (err.message.includes('XSS')) {
    message = 'Invalid content';
    status = 400;
  }

  res.status(status).json({
    error: message
  });
});

// Health check endpoint with security info
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    security: {
      xssProtection: true,
      sqlInjectionProtection: true,
      csrfProtection: true,
      rateLimiting: true,
      inputSanitization: true
    },
    timestamp: new Date().toISOString()
  });
});

// Example of secure template rendering with CSP nonce
app.get('/', (req, res) => {
  const nonce = res.locals.nonce;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Personal Brand DNA - Secure</title>
      <script nonce="${nonce}">
        ${xssPrevention.trustedTypesPolicy()}
      </script>
    </head>
    <body>
      <h1>Welcome to Personal Brand DNA</h1>
      <p>This application is protected against SQL injection and XSS attacks.</p>
      ${xssPrevention.createInlineScript(`
        console.log('This script is allowed with nonce');
      `, nonce)}
    </body>
    </html>
  `);
});

module.exports = app;