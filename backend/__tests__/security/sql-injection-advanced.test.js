/**
 * Advanced SQL Injection Prevention Tests
 * Tests for various SQL injection attack vectors and prevention mechanisms
 */

const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/database');
const inputSanitizer = require('../../src/services/inputSanitizationService');
const secureQueryBuilder = require('../../src/utils/secureQueryBuilder');

// Mock database for testing
jest.mock('../../src/config/database');

describe('Advanced SQL Injection Prevention Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic SQL Injection Prevention', () => {
    test('should prevent basic OR 1=1 injection', () => {
      const maliciousInputs = [
        "admin' OR '1'='1",
        "admin' OR 1=1--",
        "admin' OR 1=1#",
        "admin' OR 1=1/*",
        "' OR '1'='1' --",
        "' OR '1'='1' /*",
        "' OR '1'='1' #"
      ];

      maliciousInputs.forEach(input => {
        expect(() => {
          inputSanitizer.sanitizeForSQL(input);
        }).toThrow('Potential SQL injection detected');
      });
    });

    test('should prevent UNION-based attacks', () => {
      const unionAttacks = [
        "' UNION SELECT * FROM users--",
        "' UNION ALL SELECT null, null, null--",
        "1' UNION SELECT 1,2,3--",
        "admin' UNION SELECT password FROM users--",
        "' UNION SELECT @@version--"
      ];

      unionAttacks.forEach(input => {
        expect(() => {
          inputSanitizer.sanitizeForSQL(input);
        }).toThrow('Potential SQL injection detected');
      });
    });

    test('should prevent DROP/DELETE statements', () => {
      const destructiveQueries = [
        "'; DROP TABLE users--",
        "'; DELETE FROM users--",
        "'; TRUNCATE TABLE users--",
        "admin'; DROP DATABASE test--",
        "'; ALTER TABLE users DROP COLUMN password--"
      ];

      destructiveQueries.forEach(input => {
        expect(() => {
          inputSanitizer.sanitizeForSQL(input);
        }).toThrow('Potential SQL injection detected');
      });
    });
  });

  describe('Parameterized Query Validation', () => {
    test('should enforce parameterized queries', async () => {
      const query = secureQueryBuilder.select('users')
        .where('username', '=', 'admin')
        .where('active', '=', true)
        .build();

      expect(query.text).toContain('$1');
      expect(query.text).toContain('$2');
      expect(query.values).toEqual(['admin', true]);
    });

    test('should prevent dynamic query construction', () => {
      expect(() => {
        const userInput = "users WHERE 1=1--";
        secureQueryBuilder.raw(`SELECT * FROM ${userInput}`);
      }).toThrow('Raw queries are not allowed');
    });

    test('should validate parameter count matches placeholders', () => {
      expect(() => {
        secureQueryBuilder.query('SELECT * FROM users WHERE id = $1 AND name = $2', [1]);
      }).toThrow('Parameter count mismatch');
    });
  });

  describe('Second-Order SQL Injection Prevention', () => {
    test('should sanitize data retrieved from database before reuse', async () => {
      // Simulate stored malicious data
      const storedMaliciousData = "admin' OR '1'='1";
      
      // Should sanitize when used in another query
      expect(() => {
        inputSanitizer.sanitizeForSQL(storedMaliciousData);
      }).toThrow('Potential SQL injection detected');
    });

    test('should prevent stored procedure injection', () => {
      const spInjections = [
        "'; EXEC sp_addsrvrolemember 'user', 'sysadmin'--",
        "'; EXEC xp_cmdshell 'net user'--",
        "admin'; EXEC master..xp_cmdshell 'dir'--"
      ];

      spInjections.forEach(input => {
        expect(() => {
          inputSanitizer.sanitizeForSQL(input);
        }).toThrow('Potential SQL injection detected');
      });
    });
  });

  describe('Blind SQL Injection Detection', () => {
    test('should detect time-based blind injection attempts', () => {
      const timeBasedAttacks = [
        "admin' AND SLEEP(5)--",
        "1' AND (SELECT * FROM (SELECT(SLEEP(5)))a)--",
        "admin' WAITFOR DELAY '00:00:05'--",
        "1'; SELECT pg_sleep(5)--",
        "admin' AND BENCHMARK(1000000,MD5('test'))--"
      ];

      timeBasedAttacks.forEach(input => {
        expect(() => {
          inputSanitizer.sanitizeForSQL(input);
        }).toThrow('Potential SQL injection detected');
      });
    });

    test('should detect boolean-based blind injection', () => {
      const booleanAttacks = [
        "admin' AND 1=1--",
        "admin' AND 1=2--",
        "1' AND ASCII(SUBSTRING((SELECT password FROM users LIMIT 1),1,1)) > 65--",
        "admin' AND (SELECT COUNT(*) FROM users) > 0--"
      ];

      booleanAttacks.forEach(input => {
        expect(() => {
          inputSanitizer.sanitizeForSQL(input);
        }).toThrow('Potential SQL injection detected');
      });
    });
  });

  describe('ORM Injection Prevention', () => {
    test('should prevent NoSQL injection in JSON queries', () => {
      const noSQLInjections = [
        '{"$where": "this.password == \'password\'"}',
        '{"username": {"$ne": null}}',
        '{"$or": [{"username": "admin"}, {"password": {"$exists": false}}]}',
        '{"username": {"$regex": ".*"}}',
        '{"$where": "sleep(5000)"}'
      ];

      noSQLInjections.forEach(input => {
        expect(() => {
          inputSanitizer.sanitizeJSON(input);
        }).not.toThrow();
        // The sanitized output should not contain dangerous operators
        const sanitized = inputSanitizer.sanitizeJSON(input);
        expect(JSON.stringify(sanitized)).not.toContain('$where');
        expect(JSON.stringify(sanitized)).not.toContain('$ne');
        expect(JSON.stringify(sanitized)).not.toContain('$or');
      });
    });

    test('should validate ORM query builders', () => {
      // Test that ORM methods are properly escaped
      const safeQuery = secureQueryBuilder
        .select('users')
        .where('email', 'LIKE', '%@example.com')
        .orderBy('created_at', 'DESC')
        .limit(10)
        .build();

      expect(safeQuery.text).toMatch(/\$\d+/); // Contains parameters
      expect(safeQuery.values).toHaveLength(1);
    });
  });

  describe('Advanced Attack Vectors', () => {
    test('should prevent hex-encoded injection', () => {
      const hexAttacks = [
        "0x61646d696e27204f522027313d31",
        "CHAR(0x61,0x64,0x6d,0x69,0x6e)",
        "0x27; DROP TABLE users--"
      ];

      hexAttacks.forEach(input => {
        expect(() => {
          inputSanitizer.sanitizeForSQL(input);
        }).toThrow('Potential SQL injection detected');
      });
    });

    test('should prevent comment-based injection', () => {
      const commentAttacks = [
        "admin'/*comment*/OR/*comment*/'1'='1",
        "admin'--comment\nOR '1'='1",
        "admin'#comment\nOR '1'='1",
        "/**/UNION/**/SELECT/**/"
      ];

      commentAttacks.forEach(input => {
        expect(() => {
          inputSanitizer.sanitizeForSQL(input);
        }).toThrow('Potential SQL injection detected');
      });
    });

    test('should prevent stacked queries', () => {
      const stackedQueries = [
        "1; INSERT INTO users VALUES ('hacker', 'password')--",
        "admin'; UPDATE users SET role='admin'--",
        "1; EXEC sp_configure 'show advanced options', 1--"
      ];

      stackedQueries.forEach(input => {
        expect(() => {
          inputSanitizer.sanitizeForSQL(input);
        }).toThrow('Potential SQL injection detected');
      });
    });
  });

  describe('Context-Aware Sanitization', () => {
    test('should properly sanitize identifiers', () => {
      const validIdentifiers = ['users', 'user_profiles', 'User123'];
      const invalidIdentifiers = ['users; DROP TABLE', 'users--', 'users/**/'];

      validIdentifiers.forEach(input => {
        expect(() => {
          inputSanitizer.sanitizeForSQL(input, 'identifier');
        }).not.toThrow();
      });

      invalidIdentifiers.forEach(input => {
        expect(() => {
          inputSanitizer.sanitizeForSQL(input, 'identifier');
        }).toThrow('Invalid identifier');
      });
    });

    test('should properly sanitize LIKE patterns', () => {
      const likeInput = "test%_pattern";
      const sanitized = inputSanitizer.sanitizeForSQL(likeInput, 'like');
      
      expect(sanitized).toContain('\\%');
      expect(sanitized).toContain('\\_');
    });

    test('should properly sanitize numeric inputs', () => {
      expect(inputSanitizer.sanitizeForSQL('123', 'number')).toBe(123);
      expect(inputSanitizer.sanitizeForSQL('123.45', 'number')).toBe(123.45);
      
      expect(() => {
        inputSanitizer.sanitizeForSQL('123 OR 1=1', 'number');
      }).toThrow('Invalid number input');
    });
  });

  describe('Query Complexity Limits', () => {
    test('should enforce maximum query depth', () => {
      expect(() => {
        let query = secureQueryBuilder.select('users');
        for (let i = 0; i < 20; i++) {
          query = query.where(`field${i}`, '=', `value${i}`);
        }
        query.build();
      }).toThrow('Query too complex');
    });

    test('should limit number of joins', () => {
      expect(() => {
        let query = secureQueryBuilder.select('users');
        for (let i = 0; i < 10; i++) {
          query = query.join(`table${i}`, `users.id`, `table${i}.user_id`);
        }
        query.build();
      }).toThrow('Too many joins');
    });
  });

  describe('Logging and Monitoring', () => {
    test('should log suspicious query attempts', () => {
      const logSpy = jest.spyOn(console, 'warn');
      
      try {
        inputSanitizer.sanitizeForSQL("admin' OR '1'='1");
      } catch (e) {
        // Expected to throw
      }
      
      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });

    test('should track query patterns for anomaly detection', () => {
      const queries = [];
      for (let i = 0; i < 100; i++) {
        queries.push(
          secureQueryBuilder
            .select('users')
            .where('id', '=', i)
            .build()
        );
      }
      
      // Should detect unusual query patterns
      const anomalousQuery = secureQueryBuilder
        .select('users')
        .where('1', '=', '1')
        .build();
      
      expect(anomalousQuery.flagged).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    test('should prevent SQL injection in API endpoints', async () => {
      const maliciousPayloads = [
        { username: "admin' OR '1'='1", password: "password" },
        { email: "test@test.com'; DROP TABLE users--" },
        { search: "' UNION SELECT * FROM passwords--" }
      ];

      for (const payload of maliciousPayloads) {
        const response = await request(app)
          .post('/api/users/search')
          .send(payload);
        
        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid input');
      }
    });

    test('should handle safe queries correctly', async () => {
      const safePayloads = [
        { username: "admin", password: "password123" },
        { email: "user@example.com" },
        { search: "John Doe" }
      ];

      for (const payload of safePayloads) {
        const response = await request(app)
          .post('/api/users/search')
          .send(payload);
        
        expect(response.status).not.toBe(400);
      }
    });
  });
});