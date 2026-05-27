function getType(session) {
  return session.type === 'postgres' ? 'pg' : session.type;
}

function ident(session, name) {
  return getType(session) === 'mysql' ? `\`${name}\`` : `"${name}"`;
}

function param(session, index) {
  return getType(session) === 'mysql' ? '?' : `$${index}`;
}

function adapter(session) {
  const isMySQL = getType(session) === 'mysql';

  return {
    ident: (name) => ident(session, name),
    param: (index) => param(session, index),

    async query(text, params = []) {
      if (isMySQL) {
        const [rows] = await session.client.query(text, params);
        return rows;
      }
      const result = await session.client.query(text, params);
      return result.rows;
    },

    async beginTransaction() {
      await session.client.query('BEGIN');
    },

    async commit() {
      await session.client.query('COMMIT');
    },

    async rollback() {
      await session.client.query('ROLLBACK');
    },

    async getTables() {
      if (isMySQL) {
        const [rows] = await session.client.query('SHOW TABLES');
        return rows.map(row => Object.values(row)[0]);
      }
      const result = await session.client.query(`
        SELECT tablename
        FROM pg_catalog.pg_tables
        WHERE schemaname = 'public'
      `);
      return result.rows.map(row => row.tablename);
    },

    async getTableData(table, limit, offset) {
      const q = `SELECT * FROM ${ident(session, table)}`;
      if (limit) {
        if (isMySQL) {
          const [rows] = await session.client.query(`${q} LIMIT ? OFFSET ?`, [limit, offset]);
          return rows;
        }
        const result = await session.client.query(`${q} LIMIT $1 OFFSET $2`, [limit, offset]);
        return result.rows;
      }
      if (isMySQL) {
        const [rows] = await session.client.query(q);
        return rows;
      }
      const result = await session.client.query(q);
      return result.rows;
    },

    async insertRecord(table, columns, values) {
      const colNames = columns.map(c => ident(session, c)).join(', ');
      const placeholders = values.map((_, i) => param(session, i + 1)).join(', ');
      if (isMySQL) {
        const q = `INSERT INTO ${ident(session, table)} (${colNames}) VALUES (${placeholders})`;
        const [result] = await session.client.query(q, values);
        return { insertId: result.insertId, affectedRows: result.affectedRows };
      }
      const q = `INSERT INTO ${ident(session, table)} (${colNames}) VALUES (${placeholders}) RETURNING *`;
      const result = await session.client.query(q, values);
      return { rows: result.rows, rowCount: result.rowCount };
    },

    async updateRecord(table, setCols, setVals, condCols, condVals) {
      const allVals = [...setVals, ...condVals];
      if (isMySQL) {
        const setClause = setCols.map(col => `${ident(session, col)} = ?`).join(', ');
        const whereClause = condCols.map(col => `${ident(session, col)} = ?`).join(' AND ');
        const q = `UPDATE ${ident(session, table)} SET ${setClause} WHERE ${whereClause}`;
        const [result] = await session.client.query(q, allVals);
        return { affectedRows: result.affectedRows };
      }
      let idx = 1;
      const setClause = setCols.map(col => `${ident(session, col)} = $${idx++}`).join(', ');
      const whereClause = condCols.map(col => `${ident(session, col)} = $${idx++}`).join(' AND ');
      const q = `UPDATE ${ident(session, table)} SET ${setClause} WHERE ${whereClause} RETURNING *`;
      const result = await session.client.query(q, allVals);
      return { rows: result.rows, rowCount: result.rowCount };
    },

    async deleteRecord(table, conditions) {
      const condCols = Object.keys(conditions);
      const condVals = Object.values(conditions).map(val =>
        (val !== null && typeof val === 'object') ? JSON.stringify(val) : val
      );
      if (isMySQL) {
        const whereClause = condCols.map(col => `${ident(session, col)} = ?`).join(' AND ');
        const q = `DELETE FROM ${ident(session, table)} WHERE ${whereClause}`;
        const [result] = await session.client.query(q, condVals);
        return { affectedRows: result.affectedRows };
      }
      let idx = 1;
      const whereClause = condCols.map(col => `${ident(session, col)} = $${idx++}`).join(' AND ');
      const q = `DELETE FROM ${ident(session, table)} WHERE ${whereClause} RETURNING *`;
      const result = await session.client.query(q, condVals);
      return { rows: result.rows, rowCount: result.rowCount };
    },

    async getForeignKeys(session, table) {
      if (isMySQL) {
        const [rows] = await session.client.query(`
          SELECT
            COLUMN_NAME AS column_name,
            REFERENCED_TABLE_NAME AS referenced_table_name,
            REFERENCED_COLUMN_NAME AS referenced_column_name
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
            AND REFERENCED_TABLE_NAME IS NOT NULL
        `, [table]);
        return rows;
      }
      const result = await session.client.query(`
        SELECT
            kcu.column_name,
            ccu.table_name AS referenced_table_name,
            ccu.column_name AS referenced_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = $1
          AND tc.table_schema = 'public'
      `, [table]);
      return result.rows;
    },

    async getTableColumns(session, table) {
      if (isMySQL) {
        const [rows] = await session.client.query(`
          SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        `, [table]);
        return rows.map(c => ({ column_name: c.column_name, data_type: c.data_type }));
      }
      const result = await session.client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
      `, [table]);
      return result.rows.map(c => ({ column_name: c.column_name, data_type: c.data_type }));
    },

    async aggregateGroupBy(table, groupBy, aggregateCol, func, joinCfg, filterCol, filterVal, limit = 20) {
      let selectCol = `${ident(session, groupBy)} AS group_key`;
      let joinClause = '';
      let groupByCol = `${ident(session, groupBy)}`;

      if (joinCfg.isFk) {
        const friendly = ident(session, joinCfg.friendlyCol);
        const groupById = ident(session, groupBy);
        if (isMySQL) {
          selectCol = `COALESCE(t2.${friendly}, CAST(t1.${groupById} AS CHAR)) AS group_key`;
          joinClause = `LEFT JOIN ${ident(session, joinCfg.referencedTable)} t2 ON t1.${groupById} = t2.${ident(session, joinCfg.referencedColumn)}`;
          groupByCol = `t2.${friendly}, t1.${groupById}`;
        } else {
          selectCol = `COALESCE(t2.${friendly}, CAST(t1.${groupById} AS VARCHAR)) AS group_key`;
          joinClause = `LEFT JOIN ${ident(session, joinCfg.referencedTable)} t2 ON t1.${groupById} = t2.${ident(session, joinCfg.referencedColumn)}`;
          groupByCol = `t2.${friendly}, t1.${groupById}`;
        }
      }

      let q = `
        SELECT ${selectCol}, ${func}(t1.${ident(session, aggregateCol)}) AS val
        FROM ${ident(session, table)} t1 ${joinClause}
      `;
      const params = [];
      if (filterCol && filterVal !== undefined) {
        q += ` WHERE t1.${ident(session, filterCol)} = ${param(session, 1)} `;
        params.push(filterVal);
      }
      q += ` GROUP BY ${groupByCol} ORDER BY val DESC LIMIT ${limit}`;

      if (isMySQL) {
        const [rows] = await session.client.query(q, params);
        return rows;
      }
      const result = await session.client.query(q, params);
      return result.rows;
    },

    async pivotAggregate(table, rowCol, colCol, aggregateCol, func, rowJoinCfg, colJoinCfg, filterCol, filterVal, limit = 50) {
      let selectRow = `t1.${ident(session, rowCol)} AS row_key`;
      let selectCol = `t1.${ident(session, colCol)} AS col_key`;
      const joins = [];
      const groupBys = [`t1.${ident(session, rowCol)}`, `t1.${ident(session, colCol)}`];

      if (rowJoinCfg.isFk) {
        const friendly = ident(session, rowJoinCfg.friendlyCol);
        if (isMySQL) {
          selectRow = `COALESCE(t_row.${friendly}, CAST(t1.${ident(session, rowCol)} AS CHAR)) AS row_key`;
          joins.push(`LEFT JOIN ${ident(session, rowJoinCfg.referencedTable)} t_row ON t1.${ident(session, rowCol)} = t_row.${ident(session, rowJoinCfg.referencedColumn)}`);
        } else {
          selectRow = `COALESCE(t_row.${friendly}, CAST(t1.${ident(session, rowCol)} AS VARCHAR)) AS row_key`;
          joins.push(`LEFT JOIN ${ident(session, rowJoinCfg.referencedTable)} t_row ON t1.${ident(session, rowCol)} = t_row.${ident(session, rowJoinCfg.referencedColumn)}`);
        }
        groupBys.push(`t_row.${friendly}`);
      }
      if (colJoinCfg.isFk) {
        const friendly = ident(session, colJoinCfg.friendlyCol);
        if (isMySQL) {
          selectCol = `COALESCE(t_col.${friendly}, CAST(t1.${ident(session, colCol)} AS CHAR)) AS col_key`;
          joins.push(`LEFT JOIN ${ident(session, colJoinCfg.referencedTable)} t_col ON t1.${ident(session, colCol)} = t_col.${ident(session, colJoinCfg.referencedColumn)}`);
        } else {
          selectCol = `COALESCE(t_col.${friendly}, CAST(t1.${ident(session, colCol)} AS VARCHAR)) AS col_key`;
          joins.push(`LEFT JOIN ${ident(session, colJoinCfg.referencedTable)} t_col ON t1.${ident(session, colCol)} = t_col.${ident(session, colJoinCfg.referencedColumn)}`);
        }
        groupBys.push(`t_col.${friendly}`);
      }

      let q = `
        SELECT ${selectRow}, ${selectCol}, ${func}(t1.${ident(session, aggregateCol)}) AS val
        FROM ${ident(session, table)} t1 ${joins.join(' ')}
      `;
      const params = [];
      if (filterCol && filterVal !== undefined) {
        q += ` WHERE t1.${ident(session, filterCol)} = ${param(session, 1)} `;
        params.push(filterVal);
      }
      q += ` GROUP BY ${groupBys.join(', ')} ORDER BY val DESC LIMIT ${limit}`;

      if (isMySQL) {
        const [rows] = await session.client.query(q, params);
        return rows;
      }
      const result = await session.client.query(q, params);
      return result.rows;
    },

    async getTableHealth(table) {
      let totalRows = 0;
      let sizeBytes = 0;
      let indexCount = 0;

      if (isMySQL) {
        const [countResult] = await session.client.query(`SELECT COUNT(*) AS total FROM ${ident(session, table)}`);
        totalRows = countResult[0].total;

        const [sizeResult] = await session.client.query(`
          SELECT (data_length + index_length) AS size
          FROM information_schema.tables
          WHERE table_schema = DATABASE() AND table_name = ?
        `, [table]);
        sizeBytes = sizeResult[0]?.size || 1024 * 8;

        const [indexResult] = await session.client.query(`SHOW INDEX FROM ${ident(session, table)}`);
        indexCount = indexResult.length;
      } else {
        const countResult = await session.client.query(`SELECT COUNT(*) AS total FROM ${ident(session, table)}`);
        totalRows = Number(countResult.rows[0].total);

        const sizeResult = await session.client.query(`SELECT pg_total_relation_size($1::regclass) AS size`, [table]);
        sizeBytes = Number(sizeResult.rows[0]?.size || 1024 * 8);

        const indexResult = await session.client.query(`
          SELECT COUNT(*) AS count FROM pg_index WHERE indrelid = $1::regclass
        `, [table]);
        indexCount = Number(indexResult.rows[0]?.count || 0);
      }

      const integrityScore = Math.min(100, Math.round((indexCount > 0 ? 70 : 30) + (totalRows > 0 ? 20 : 0)));
      const completenessScore = totalRows > 0
        ? Math.min(100, Math.round(85 + Math.min(totalRows / 1000, 1) * 10))
        : 0;

      return {
        totalRows,
        sizeBytes,
        indexCount,
        integrityScore,
        completenessScore
      };
    }
  };
}

module.exports = adapter;
