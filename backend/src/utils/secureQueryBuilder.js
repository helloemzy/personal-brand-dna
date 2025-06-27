/**
 * Secure Query Builder
 * Enforces parameterized queries and prevents SQL injection
 */

const { Pool } = require('pg');
const inputSanitizer = require('../services/inputSanitizationService');

class SecureQueryBuilder {
  constructor() {
    this.reset();
    this.queryLog = [];
    this.maxComplexity = {
      conditions: 15,
      joins: 5,
      subqueries: 3,
      unions: 2
    };
  }

  reset() {
    this.type = null;
    this.table = null;
    this.columns = ['*'];
    this.conditions = [];
    this.joins = [];
    this.orderBy = null;
    this.groupBy = null;
    this.having = null;
    this.limitValue = null;
    this.offsetValue = null;
    this.values = [];
    this.paramCounter = 0;
    this.subqueries = 0;
    this.unions = 0;
  }

  /**
   * Start a SELECT query
   * @param {string} table - Table name
   * @param {string[]} columns - Columns to select
   */
  select(table, columns = ['*']) {
    this.reset();
    this.type = 'SELECT';
    this.table = this.validateIdentifier(table);
    this.columns = columns.map(col => this.validateColumnName(col));
    return this;
  }

  /**
   * Start an INSERT query
   * @param {string} table - Table name
   * @param {object} data - Data to insert
   */
  insert(table, data) {
    this.reset();
    this.type = 'INSERT';
    this.table = this.validateIdentifier(table);
    this.insertData = data;
    return this;
  }

  /**
   * Start an UPDATE query
   * @param {string} table - Table name
   * @param {object} data - Data to update
   */
  update(table, data) {
    this.reset();
    this.type = 'UPDATE';
    this.table = this.validateIdentifier(table);
    this.updateData = data;
    return this;
  }

  /**
   * Start a DELETE query
   * @param {string} table - Table name
   */
  delete(table) {
    this.reset();
    this.type = 'DELETE';
    this.table = this.validateIdentifier(table);
    return this;
  }

  /**
   * Add WHERE condition
   * @param {string} column - Column name
   * @param {string} operator - Comparison operator
   * @param {any} value - Value to compare
   */
  where(column, operator, value) {
    if (this.conditions.length >= this.maxComplexity.conditions) {
      throw new Error('Query too complex: too many conditions');
    }

    const validOperators = ['=', '!=', '<>', '<', '>', '<=', '>=', 'LIKE', 'ILIKE', 'IN', 'NOT IN', 'IS', 'IS NOT', 'BETWEEN'];
    if (!validOperators.includes(operator.toUpperCase())) {
      throw new Error(`Invalid operator: ${operator}`);
    }

    const sanitizedColumn = this.validateColumnName(column);
    this.paramCounter++;
    
    if (operator.toUpperCase() === 'IN' || operator.toUpperCase() === 'NOT IN') {
      if (!Array.isArray(value)) {
        throw new Error('IN/NOT IN operator requires array value');
      }
      const placeholders = value.map((_, index) => `$${this.paramCounter + index}`).join(', ');
      this.paramCounter += value.length - 1;
      this.conditions.push(`${sanitizedColumn} ${operator} (${placeholders})`);
      this.values.push(...value);
    } else if (operator.toUpperCase() === 'BETWEEN') {
      if (!Array.isArray(value) || value.length !== 2) {
        throw new Error('BETWEEN operator requires array with 2 values');
      }
      this.conditions.push(`${sanitizedColumn} BETWEEN $${this.paramCounter} AND $${this.paramCounter + 1}`);
      this.paramCounter++;
      this.values.push(...value);
    } else if (operator.toUpperCase() === 'IS' || operator.toUpperCase() === 'IS NOT') {
      if (value !== null && value !== true && value !== false) {
        throw new Error('IS/IS NOT operator only accepts NULL or boolean values');
      }
      this.conditions.push(`${sanitizedColumn} ${operator} ${value === null ? 'NULL' : value}`);
    } else {
      this.conditions.push(`${sanitizedColumn} ${operator} $${this.paramCounter}`);
      this.values.push(value);
    }

    return this;
  }

  /**
   * Add AND condition
   * @param {string} column - Column name
   * @param {string} operator - Comparison operator
   * @param {any} value - Value to compare
   */
  and(column, operator, value) {
    return this.where(column, operator, value);
  }

  /**
   * Add OR condition
   * @param {function} callback - Callback to build OR conditions
   */
  or(callback) {
    const orBuilder = new SecureQueryBuilder();
    callback(orBuilder);
    
    if (orBuilder.conditions.length > 0) {
      const orConditions = orBuilder.conditions.join(' OR ');
      this.conditions.push(`(${orConditions})`);
      this.values.push(...orBuilder.values);
      this.paramCounter += orBuilder.values.length;
    }
    
    return this;
  }

  /**
   * Add JOIN
   * @param {string} table - Table to join
   * @param {string} column1 - First column
   * @param {string} column2 - Second column
   * @param {string} type - Join type (INNER, LEFT, RIGHT, FULL)
   */
  join(table, column1, column2, type = 'INNER') {
    if (this.joins.length >= this.maxComplexity.joins) {
      throw new Error('Too many joins');
    }

    const validJoinTypes = ['INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS'];
    if (!validJoinTypes.includes(type.toUpperCase())) {
      throw new Error(`Invalid join type: ${type}`);
    }

    const sanitizedTable = this.validateIdentifier(table);
    const sanitizedColumn1 = this.validateColumnName(column1);
    const sanitizedColumn2 = this.validateColumnName(column2);

    this.joins.push(`${type.toUpperCase()} JOIN ${sanitizedTable} ON ${sanitizedColumn1} = ${sanitizedColumn2}`);
    return this;
  }

  /**
   * Add ORDER BY
   * @param {string} column - Column to order by
   * @param {string} direction - Sort direction (ASC/DESC)
   */
  orderBy(column, direction = 'ASC') {
    const validDirections = ['ASC', 'DESC'];
    if (!validDirections.includes(direction.toUpperCase())) {
      throw new Error(`Invalid sort direction: ${direction}`);
    }

    const sanitizedColumn = this.validateColumnName(column);
    this.orderByClause = `${sanitizedColumn} ${direction.toUpperCase()}`;
    return this;
  }

  /**
   * Add GROUP BY
   * @param {string[]} columns - Columns to group by
   */
  groupBy(...columns) {
    this.groupByClause = columns.map(col => this.validateColumnName(col)).join(', ');
    return this;
  }

  /**
   * Add HAVING clause
   * @param {string} column - Column name
   * @param {string} operator - Comparison operator
   * @param {any} value - Value to compare
   */
  having(column, operator, value) {
    const sanitizedColumn = this.validateColumnName(column);
    this.paramCounter++;
    this.havingClause = `${sanitizedColumn} ${operator} $${this.paramCounter}`;
    this.values.push(value);
    return this;
  }

  /**
   * Add LIMIT
   * @param {number} limit - Number of rows to limit
   */
  limit(limit) {
    if (!Number.isInteger(limit) || limit < 0) {
      throw new Error('Invalid limit value');
    }
    this.limitValue = limit;
    return this;
  }

  /**
   * Add OFFSET
   * @param {number} offset - Number of rows to offset
   */
  offset(offset) {
    if (!Number.isInteger(offset) || offset < 0) {
      throw new Error('Invalid offset value');
    }
    this.offsetValue = offset;
    return this;
  }

  /**
   * Validate identifier (table/column name)
   * @param {string} identifier - Identifier to validate
   * @returns {string} Validated identifier
   */
  validateIdentifier(identifier) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
      throw new Error(`Invalid identifier: ${identifier}`);
    }
    return identifier;
  }

  /**
   * Validate column name (can include table prefix)
   * @param {string} column - Column name to validate
   * @returns {string} Validated column name
   */
  validateColumnName(column) {
    if (column === '*') return column;
    
    // Handle table.column format
    const parts = column.split('.');
    if (parts.length > 2) {
      throw new Error(`Invalid column name: ${column}`);
    }
    
    return parts.map(part => this.validateIdentifier(part)).join('.');
  }

  /**
   * Build the final query
   * @returns {object} Query object with text and values
   */
  build() {
    let query = '';
    
    switch (this.type) {
      case 'SELECT':
        query = this.buildSelectQuery();
        break;
      case 'INSERT':
        query = this.buildInsertQuery();
        break;
      case 'UPDATE':
        query = this.buildUpdateQuery();
        break;
      case 'DELETE':
        query = this.buildDeleteQuery();
        break;
      default:
        throw new Error('No query type specified');
    }

    // Log query for monitoring
    this.logQuery(query, this.values);

    // Check for anomalies
    const flagged = this.detectAnomalies(query, this.values);

    return {
      text: query,
      values: this.values,
      flagged: flagged
    };
  }

  /**
   * Build SELECT query
   */
  buildSelectQuery() {
    let query = `SELECT ${this.columns.join(', ')} FROM ${this.table}`;
    
    if (this.joins.length > 0) {
      query += ' ' + this.joins.join(' ');
    }
    
    if (this.conditions.length > 0) {
      query += ' WHERE ' + this.conditions.join(' AND ');
    }
    
    if (this.groupByClause) {
      query += ' GROUP BY ' + this.groupByClause;
    }
    
    if (this.havingClause) {
      query += ' HAVING ' + this.havingClause;
    }
    
    if (this.orderByClause) {
      query += ' ORDER BY ' + this.orderByClause;
    }
    
    if (this.limitValue !== null) {
      query += ` LIMIT ${this.limitValue}`;
    }
    
    if (this.offsetValue !== null) {
      query += ` OFFSET ${this.offsetValue}`;
    }
    
    return query;
  }

  /**
   * Build INSERT query
   */
  buildInsertQuery() {
    const columns = Object.keys(this.insertData);
    const values = Object.values(this.insertData);
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    
    const query = `INSERT INTO ${this.table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    this.values = values;
    
    return query;
  }

  /**
   * Build UPDATE query
   */
  buildUpdateQuery() {
    const columns = Object.keys(this.updateData);
    const values = Object.values(this.updateData);
    
    let setClause = columns.map((col, index) => {
      const sanitizedCol = this.validateColumnName(col);
      return `${sanitizedCol} = $${index + 1}`;
    }).join(', ');
    
    this.paramCounter = columns.length;
    
    let query = `UPDATE ${this.table} SET ${setClause}`;
    
    if (this.conditions.length > 0) {
      // Adjust parameter numbers for WHERE conditions
      const adjustedConditions = this.conditions.map(condition => {
        return condition.replace(/\$(\d+)/g, (match, num) => {
          return `$${parseInt(num) + this.paramCounter}`;
        });
      });
      query += ' WHERE ' + adjustedConditions.join(' AND ');
    }
    
    query += ' RETURNING *';
    this.values = [...values, ...this.values];
    
    return query;
  }

  /**
   * Build DELETE query
   */
  buildDeleteQuery() {
    let query = `DELETE FROM ${this.table}`;
    
    if (this.conditions.length > 0) {
      query += ' WHERE ' + this.conditions.join(' AND ');
    } else {
      throw new Error('DELETE without WHERE clause is not allowed');
    }
    
    query += ' RETURNING *';
    
    return query;
  }

  /**
   * Log query for monitoring
   */
  logQuery(query, values) {
    const logEntry = {
      timestamp: new Date(),
      query: query,
      paramCount: values.length,
      complexity: {
        conditions: this.conditions.length,
        joins: this.joins.length,
        subqueries: this.subqueries,
        unions: this.unions
      }
    };
    
    this.queryLog.push(logEntry);
    
    // Keep only last 1000 queries
    if (this.queryLog.length > 1000) {
      this.queryLog.shift();
    }
  }

  /**
   * Detect query anomalies
   */
  detectAnomalies(query, values) {
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /WHERE\s+1\s*=\s*1/i,
      /WHERE\s+true/i,
      /WHERE\s+\d+\s*=\s*\d+/i,
      /OR\s+1\s*=\s*1/i,
      /OR\s+true/i
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(query)) {
        console.warn(`Suspicious query pattern detected: ${query}`);
        return true;
      }
    }
    
    // Check for unusual parameter patterns
    if (values.length === 0 && this.type !== 'SELECT') {
      console.warn('Modification query without parameters');
      return true;
    }
    
    return false;
  }

  /**
   * Execute query with a connection pool
   * @param {Pool} pool - PostgreSQL connection pool
   */
  async execute(pool) {
    const query = this.build();
    
    try {
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Query execution error:', error);
      throw error;
    }
  }

  /**
   * Prevent raw queries
   */
  raw(queryString) {
    throw new Error('Raw queries are not allowed. Use parameterized query methods instead.');
  }

  /**
   * Safe query execution with parameter validation
   */
  query(queryText, params = []) {
    // Count placeholders in query
    const placeholderCount = (queryText.match(/\$\d+/g) || []).length;
    
    if (placeholderCount !== params.length) {
      throw new Error(`Parameter count mismatch: expected ${placeholderCount}, got ${params.length}`);
    }
    
    // Validate query doesn't contain dangerous keywords without parameters
    const dangerousPatterns = [
      /DELETE\s+FROM/i,
      /DROP\s+TABLE/i,
      /TRUNCATE/i,
      /UPDATE.*SET/i
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(queryText) && placeholderCount === 0) {
        throw new Error('Dangerous operation without parameters');
      }
    }
    
    return {
      text: queryText,
      values: params
    };
  }
}

// Export singleton instance
module.exports = new SecureQueryBuilder();