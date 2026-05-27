const dialectAdapter = require('./dialectAdapter');

const getJoinConfig = async (session, table, columnName) => {
  const adapter = dialectAdapter(session);
  let fk = null;

  const fks = await adapter.getForeignKeys(session, table);
  fk = fks.find(f => f.column_name === columnName) || null;

  if (!fk) return { isFk: false };

  const refTable = fk.referenced_table_name;
  const refCol = fk.referenced_column_name;

  const refColumns = await adapter.getTableColumns(session, refTable);

  const friendlyCol = refColumns.find(c =>
    ['name', 'title', 'label', 'email', 'username', 'key'].includes(c.column_name.toLowerCase())
  );

  return {
    isFk: true,
    referencedTable: refTable,
    referencedColumn: refCol,
    friendlyCol: friendlyCol || refCol
  };
};

module.exports = { getJoinConfig };
