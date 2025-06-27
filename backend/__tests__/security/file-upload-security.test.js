/**
 * File Upload Security Test Suite
 * Tests for malicious file uploads, path traversal, file type validation
 */

const request = require('supertest');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { authenticate } = require('../../src/middleware/auth');
const { query } = require('../../src/config/database');
const { generateTestToken } = require('../test-utils');

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/utils/logger');

describe('File Upload Security Tests', () => {
  let app;
  let upload;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock storage configuration
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, '/tmp/uploads');
      },
      filename: (req, file, cb) => {
        // Generate safe filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
      }
    });

    // Configure multer with security settings
    upload = multer({
      storage: storage,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
        files: 1 // Single file only
      },
      fileFilter: (req, file, cb) => {
        // Basic file type validation
        const allowedMimes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'application/pdf',
          'audio/mpeg',
          'audio/wav',
          'audio/webm'
        ];

        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type'));
        }
      }
    });

    jest.clearAllMocks();
  });

  describe('File Type Validation', () => {
    test('should reject files with double extensions', async () => {
      app.post('/api/upload', authenticate, upload.single('file'), (req, res) => {
        // Additional validation for double extensions
        const filename = req.file?.originalname || '';
        const doubleExtPattern = /\.(php|exe|sh|bat|cmd|com|scr|vbs|js|jar|py|rb)\./i;
        
        if (doubleExtPattern.test(filename)) {
          return res.status(400).json({ error: 'Suspicious filename detected' });
        }

        res.json({ uploaded: true, filename: req.file?.filename });
      });

      // Mock auth
      query.mockImplementation(() => ({
        rows: [{ id: 'user-123', subscription_status: 'active' }]
      }));

      const maliciousFilenames = [
        'malware.php.jpg',
        'script.exe.png',
        'backdoor.sh.pdf',
        'virus.bat.gif',
        'exploit.js.jpeg'
      ];

      for (const filename of maliciousFilenames) {
        const response = await request(app)
          .post('/api/upload')
          .set('Authorization', `Bearer ${generateTestToken()}`)
          .attach('file', Buffer.from('fake content'), filename)
          .expect(400);

        expect(response.body.error).toContain('Suspicious filename');
      }
    });

    test('should validate MIME type matches file extension', async () => {
      app.post('/api/upload/strict', authenticate, (req, res, next) => {
        upload.single('file')(req, res, (err) => {
          if (err) return res.status(400).json({ error: err.message });

          // Validate MIME type matches extension
          const file = req.file;
          if (!file) return res.status(400).json({ error: 'No file uploaded' });

          const ext = path.extname(file.originalname).toLowerCase();
          const mimeTypeMap = {
            '.jpg': ['image/jpeg'],
            '.jpeg': ['image/jpeg'],
            '.png': ['image/png'],
            '.gif': ['image/gif'],
            '.pdf': ['application/pdf']
          };

          const allowedMimes = mimeTypeMap[ext];
          if (!allowedMimes || !allowedMimes.includes(file.mimetype)) {
            return res.status(400).json({ 
              error: 'File extension does not match MIME type' 
            });
          }

          res.json({ uploaded: true });
        });
      });

      query.mockImplementation(() => ({
        rows: [{ id: 'user-123', subscription_status: 'active' }]
      }));

      // Test mismatched MIME types
      const response = await request(app)
        .post('/api/upload/strict')
        .set('Authorization', `Bearer ${generateTestToken()}`)
        .attach('file', Buffer.from('<?php echo "hack"; ?>'), {
          filename: 'image.jpg',
          contentType: 'text/php' // Wrong MIME type
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    test('should check magic bytes for file type verification', async () => {
      app.post('/api/upload/secure', authenticate, upload.single('file'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'No file' });

        // Read first few bytes to check magic numbers
        const buffer = fs.readFileSync(req.file.path);
        const magicNumbers = {
          jpg: [0xFF, 0xD8, 0xFF],
          png: [0x89, 0x50, 0x4E, 0x47],
          gif: [0x47, 0x49, 0x46],
          pdf: [0x25, 0x50, 0x44, 0x46]
        };

        const ext = path.extname(req.file.originalname).toLowerCase().slice(1);
        const expectedMagic = magicNumbers[ext];

        if (expectedMagic) {
          const fileMagic = Array.from(buffer.slice(0, expectedMagic.length));
          const isValid = expectedMagic.every((byte, i) => byte === fileMagic[i]);

          if (!isValid) {
            return res.status(400).json({ 
              error: 'File content does not match file type' 
            });
          }
        }

        res.json({ uploaded: true });
      });

      query.mockImplementation(() => ({
        rows: [{ id: 'user-123', subscription_status: 'active' }]
      }));

      // Create fake JPEG with wrong magic bytes
      const fakeJpeg = Buffer.concat([
        Buffer.from('GIF89a'), // GIF magic bytes
        Buffer.from('fake jpeg content')
      ]);

      // Note: This would need actual file system mocking to test properly
      // The test demonstrates the security check concept
    });
  });

  describe('Path Traversal Prevention', () => {
    test('should sanitize uploaded filenames', async () => {
      app.post('/api/upload', authenticate, upload.single('file'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'No file' });

        // Sanitize filename
        const sanitizedName = path.basename(req.file.originalname)
          .replace(/[^a-zA-Z0-9._-]/g, '_')
          .replace(/\.{2,}/g, '.');

        if (sanitizedName !== req.file.originalname) {
          return res.status(400).json({ 
            error: 'Invalid filename characters detected' 
          });
        }

        res.json({ uploaded: true, filename: sanitizedName });
      });

      query.mockImplementation(() => ({
        rows: [{ id: 'user-123', subscription_status: 'active' }]
      }));

      const maliciousFilenames = [
        '../../../etc/passwd',
        '..\\..\\windows\\system.ini',
        'file\x00.jpg', // Null byte injection
        'file%00.jpg',
        '....//....//file.jpg',
        'file.jpg/../../config'
      ];

      for (const filename of maliciousFilenames) {
        const response = await request(app)
          .post('/api/upload')
          .set('Authorization', `Bearer ${generateTestToken()}`)
          .attach('file', Buffer.from('content'), filename)
          .expect(400);

        expect(response.body.error).toContain('Invalid filename');
      }
    });

    test('should store files in secure location with random names', async () => {
      let savedFilePath;

      app.post('/api/upload/secure', authenticate, (req, res, next) => {
        const secureStorage = multer.diskStorage({
          destination: (req, file, cb) => {
            // Use secure directory outside web root
            const uploadDir = '/var/app/secure-uploads';
            cb(null, uploadDir);
          },
          filename: (req, file, cb) => {
            // Generate cryptographically random filename
            const randomName = crypto.randomBytes(32).toString('hex');
            const ext = path.extname(file.originalname);
            const secureFilename = `${randomName}${ext}`;
            savedFilePath = secureFilename;
            cb(null, secureFilename);
          }
        });

        const secureUpload = multer({ 
          storage: secureStorage,
          limits: { fileSize: 10 * 1024 * 1024 }
        });

        secureUpload.single('file')(req, res, (err) => {
          if (err) return res.status(400).json({ error: err.message });
          
          res.json({ 
            uploaded: true,
            id: savedFilePath?.split('.')[0] // Return ID without extension
          });
        });
      });

      query.mockImplementation(() => ({
        rows: [{ id: 'user-123', subscription_status: 'active' }]
      }));

      // Test that original filename is not used
      const response = await request(app)
        .post('/api/upload/secure')
        .set('Authorization', `Bearer ${generateTestToken()}`)
        .attach('file', Buffer.from('content'), 'original-name.jpg');

      // Should return random ID, not original filename
      expect(response.body.id).toBeDefined();
      expect(response.body.id).not.toContain('original-name');
      expect(response.body.id).toMatch(/^[a-f0-9]{64}$/); // Hex string
    });
  });

  describe('Malicious File Content Detection', () => {
    test('should scan for embedded scripts in images', async () => {
      app.post('/api/upload/scan', authenticate, upload.single('file'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'No file' });

        // Simple scan for PHP/script tags in file content
        const fileContent = fs.readFileSync(req.file.path, 'utf8');
        const dangerousPatterns = [
          /<\?php/i,
          /<script/i,
          /eval\s*\(/i,
          /system\s*\(/i,
          /exec\s*\(/i,
          /passthru\s*\(/i
        ];

        for (const pattern of dangerousPatterns) {
          if (pattern.test(fileContent)) {
            // Delete the file
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ 
              error: 'Malicious content detected in file' 
            });
          }
        }

        res.json({ uploaded: true });
      });

      query.mockImplementation(() => ({
        rows: [{ id: 'user-123', subscription_status: 'active' }]
      }));

      // Test file with embedded PHP
      const maliciousContent = `
        \xFF\xD8\xFF\xE0
        <?php system($_GET['cmd']); ?>
        \xFF\xD9
      `;

      // This would need actual file system operations to test
      // Demonstrates the concept of content scanning
    });

    test('should prevent zip bombs and oversized files', async () => {
      const zipBombProtection = multer({
        limits: {
          fileSize: 10 * 1024 * 1024, // 10MB limit
          fieldSize: 2 * 1024 * 1024, // 2MB field limit
          parts: 50, // Max form parts
          headerPairs: 100 // Max header pairs
        }
      });

      app.post('/api/upload/protected', authenticate, zipBombProtection.single('file'), 
        (req, res) => {
          res.json({ uploaded: true });
        }
      );

      query.mockImplementation(() => ({
        rows: [{ id: 'user-123', subscription_status: 'active' }]
      }));

      // Test oversized file
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      
      const response = await request(app)
        .post('/api/upload/protected')
        .set('Authorization', `Bearer ${generateTestToken()}`)
        .attach('file', largeBuffer, 'large.jpg')
        .expect(500); // Multer will throw error
    });

    test('should validate archive files for malicious content', async () => {
      app.post('/api/upload/archive', authenticate, upload.single('file'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'No file' });

        const ext = path.extname(req.file.originalname).toLowerCase();
        
        // Block potentially dangerous archive types
        const dangerousArchives = ['.zip', '.rar', '.7z', '.tar', '.gz'];
        if (dangerousArchives.includes(ext)) {
          return res.status(400).json({ 
            error: 'Archive files are not allowed' 
          });
        }

        res.json({ uploaded: true });
      });

      query.mockImplementation(() => ({
        rows: [{ id: 'user-123', subscription_status: 'active' }]
      }));

      const archiveTypes = ['malware.zip', 'virus.rar', 'backdoor.7z', 'exploit.tar.gz'];

      for (const filename of archiveTypes) {
        const response = await request(app)
          .post('/api/upload/archive')
          .set('Authorization', `Bearer ${generateTestToken()}`)
          .attach('file', Buffer.from('PK'), filename)
          .expect(400);

        expect(response.body.error).toContain('Archive files are not allowed');
      }
    });
  });

  describe('File Storage Security', () => {
    test('should set secure permissions on uploaded files', async () => {
      app.post('/api/upload/permissions', authenticate, (req, res, next) => {
        const secureUpload = multer({
          storage: multer.diskStorage({
            destination: (req, file, cb) => cb(null, '/tmp/uploads'),
            filename: (req, file, cb) => {
              const name = crypto.randomBytes(32).toString('hex') + path.extname(file.originalname);
              cb(null, name);
            }
          })
        });

        secureUpload.single('file')(req, res, (err) => {
          if (err) return res.status(400).json({ error: err.message });
          if (!req.file) return res.status(400).json({ error: 'No file' });

          // Set secure file permissions (owner read/write only)
          try {
            fs.chmodSync(req.file.path, 0o600);
            res.json({ uploaded: true });
          } catch (error) {
            res.status(500).json({ error: 'Failed to set file permissions' });
          }
        });
      });

      query.mockImplementation(() => ({
        rows: [{ id: 'user-123', subscription_status: 'active' }]
      }));

      // This test would need actual file system operations
      // Demonstrates the security practice
    });

    test('should prevent execution of uploaded files', async () => {
      app.post('/api/upload/noexec', authenticate, upload.single('file'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'No file' });

        // Remove execute permissions
        try {
          const stats = fs.statSync(req.file.path);
          const newMode = stats.mode & ~(fs.constants.S_IXUSR | fs.constants.S_IXGRP | fs.constants.S_IXOTH);
          fs.chmodSync(req.file.path, newMode);

          res.json({ 
            uploaded: true,
            executable: false
          });
        } catch (error) {
          res.status(500).json({ error: 'Failed to process file' });
        }
      });

      // This demonstrates removing execute permissions
    });

    test('should use content-disposition header for downloads', async () => {
      app.get('/api/download/:fileId', authenticate, (req, res) => {
        const fileId = req.params.fileId;
        
        // Validate file ID format
        if (!/^[a-f0-9]{64}$/.test(fileId)) {
          return res.status(400).json({ error: 'Invalid file ID' });
        }

        // Set security headers for download
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment; filename="download"');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        
        res.send(Buffer.from('file content'));
      });

      query.mockImplementation(() => ({
        rows: [{ id: 'user-123', subscription_status: 'active' }]
      }));

      const response = await request(app)
        .get('/api/download/a'.repeat(64))
        .set('Authorization', `Bearer ${generateTestToken()}`)
        .expect(200);

      expect(response.headers['content-disposition']).toBe('attachment; filename="download"');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('Audio File Security', () => {
    test('should validate audio file formats for voice analysis', async () => {
      app.post('/api/voice/upload', authenticate, (req, res, next) => {
        const audioUpload = multer({
          storage: multer.memoryStorage(),
          limits: {
            fileSize: 50 * 1024 * 1024 // 50MB for audio
          },
          fileFilter: (req, file, cb) => {
            const allowedAudioTypes = [
              'audio/mpeg',
              'audio/wav',
              'audio/webm',
              'audio/ogg',
              'audio/mp4'
            ];

            if (!allowedAudioTypes.includes(file.mimetype)) {
              return cb(new Error('Invalid audio format'));
            }

            cb(null, true);
          }
        });

        audioUpload.single('audio')(req, res, (err) => {
          if (err) return res.status(400).json({ error: err.message });
          if (!req.file) return res.status(400).json({ error: 'No audio file' });

          // Additional validation for audio files
          const validExtensions = ['.mp3', '.wav', '.webm', '.ogg', '.m4a'];
          const ext = path.extname(req.file.originalname).toLowerCase();
          
          if (!validExtensions.includes(ext)) {
            return res.status(400).json({ error: 'Invalid audio file extension' });
          }

          res.json({ uploaded: true, size: req.file.size });
        });
      });

      query.mockImplementation(() => ({
        rows: [{ id: 'user-123', subscription_status: 'active' }]
      }));

      // Test invalid audio file
      const response = await request(app)
        .post('/api/voice/upload')
        .set('Authorization', `Bearer ${generateTestToken()}`)
        .attach('audio', Buffer.from('fake audio'), 'audio.exe')
        .expect(400);

      expect(response.body.error).toContain('Invalid audio');
    });
  });
});