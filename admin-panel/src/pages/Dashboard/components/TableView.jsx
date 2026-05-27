import { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { fetchWithAuth } from '../../../utils/api';
import { AuthContext } from '../../../context/AuthContext';
import { useToast } from '../../../components/Toast';
import { Save, Plus, Edit2, Check, X } from 'lucide-react';

export default function TableView() {
  const { table } = useParams();
  const { sessionId } = useContext(AuthContext);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState([]);

  const [isInserting, setIsInserting] = useState(false);
  const [insertData, setInsertData] = useState({});

  const [editingIndex, setEditingIndex] = useState(null);
  const [editingData, setEditingData] = useState({});

  const [foreignKeys, setForeignKeys] = useState([]);
  const [referencedOptions, setReferencedOptions] = useState({});

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const toast = useToast();

  useEffect(() => {
    setCurrentPage(1);
  }, [table]);

  const getFkForCol = (colName) => {
    return foreignKeys.find(fk => fk.column_name === colName);
  };

  const getOptionLabel = (row, refCol) => {
    const descCol = Object.keys(row).find(k =>
      ['name', 'title', 'label', 'email', 'username', 'key'].includes(k.toLowerCase())
    );
    return descCol ? `${row[descCol]} (${row[refCol]})` : `${row[refCol]}`;
  };

  const renderColInput = (col, value, onChange, placeholder = '') => {
    const fk = getFkForCol(col);

    if (fk) {
      const options = referencedOptions[fk.referenced_table_name] || [];
      return (
        <select
          className="form-input"
          style={{ padding: '8px', width: '100%', minHeight: '38px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)' }}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" style={{ background: '#111222' }}>-- Select --</option>
          {options.map((row, idx) => {
            const val = row[fk.referenced_column_name];
            const label = getOptionLabel(row, fk.referenced_column_name);
            return (
              <option key={idx} value={val} style={{ background: '#111222' }}>
                {label}
              </option>
            );
          })}
        </select>
      );
    }

    return (
      <input
        type="text"
        className="form-input"
        style={{ padding: '8px', width: '100%' }}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    );
  };

  const startEditing = (index, row) => {
    setEditingIndex(index);
    const copy = { ...row };
    Object.keys(copy).forEach(key => {
      if (copy[key] && typeof copy[key] === 'object') {
        copy[key] = JSON.stringify(copy[key]);
      }
    });
    setEditingData(copy);
  };

  const handleUpdate = async (index) => {
    try {
      const originalRow = data[index];

      let conditions = {};
      const idKey = Object.keys(originalRow).find(k => k.toLowerCase() === 'id' || k.toLowerCase() === 'uuid');
      if (idKey && originalRow[idKey] !== undefined && originalRow[idKey] !== null) {
        conditions[idKey] = originalRow[idKey];
      } else {
        conditions = { ...originalRow };
      }

      const updateData = {};
      Object.keys(editingData).forEach(key => {
        const val = editingData[key];
        if (originalRow[key] && typeof originalRow[key] === 'object') {
          try {
            updateData[key] = JSON.parse(val);
          } catch (e) {
            updateData[key] = val;
          }
        } else if (typeof originalRow[key] === 'boolean') {
          updateData[key] = val === 'true' || val === true;
        } else if (typeof originalRow[key] === 'number') {
          updateData[key] = Number(val);
        } else {
          updateData[key] = val;
        }
      });

      const res = await fetchWithAuth(`/table/${sessionId}/${table}`, {
        method: 'PUT',
        body: JSON.stringify({ conditions, data: updateData })
      });

      if (res.success) {
        const newData = [...data];
        const updatedRow = { ...originalRow };
        Object.keys(updateData).forEach(key => {
          updatedRow[key] = updateData[key];
        });
        newData[index] = updatedRow;
        setData(newData);
        setEditingIndex(null);
        setEditingData({});
        toast('Record updated successfully', 'success');
      } else {
        toast(res.message || 'Update failed');
      }
    } catch (err) {
      toast(err.message);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetchWithAuth(`/table/${sessionId}/${table}`);
        if (res.success) {
          setData(res.data);
          if (res.data.length > 0) {
            setColumns(Object.keys(res.data[0]));
          } else {
            setColumns([]);
          }
        }

        const fksRes = await fetchWithAuth(`/table/${sessionId}/${table}/fks`);
        if (fksRes.success) {
          setForeignKeys(fksRes.fks);

          const uniqueTables = [...new Set(fksRes.fks.map(fk => fk.referenced_table_name))];
          const optionsMap = {};

          await Promise.all(
            uniqueTables.map(async (refTable) => {
              try {
                const refData = await fetchWithAuth(`/table/${sessionId}/${refTable}`);
                if (refData.success) {
                  optionsMap[refTable] = refData.data;
                }
              } catch (e) {
                console.error(`Failed to load options for referenced table ${refTable}:`, e);
              }
            })
          );
          setReferencedOptions(optionsMap);
        }
      } catch (error) {
        console.error("Failed to load data", error);
      } finally {
        setLoading(false);
      }
    };

    if (table) fetchData();
  }, [table, sessionId]);

  const handleInsert = async () => {
    try {
      const res = await fetchWithAuth(`/table/${sessionId}/${table}`, {
        method: 'POST',
        body: JSON.stringify(insertData)
      });
      if (res.success) {
        setData([...data, insertData]);
        setIsInserting(false);
        setInsertData({});
        toast('Record inserted successfully', 'success');
      }
    } catch (err) {
      toast(err.message);
    }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = data.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>Table: <span style={{ color: 'var(--accent-primary)' }}>{table}</span></h2>
        <button className="btn btn-primary" onClick={() => setIsInserting(true)}>
          <Plus size={16} /> New Record
        </button>
      </div>

      <div className="glass-panel data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map(col => <th key={col}>{col}</th>)}
              <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isInserting && (
              <tr style={{ background: 'rgba(99, 102, 241, 0.1)' }}>
                {columns.map(col => (
                  <td key={col}>
                    {renderColInput(
                      col,
                      insertData[col],
                      (val) => setInsertData({ ...insertData, [col]: val }),
                      col
                    )}
                  </td>
                ))}
                <td style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button className="btn btn-primary" onClick={handleInsert} style={{ padding: '8px 12px' }} title="Save">
                      <Save size={14} />
                    </button>
                    <button className="btn btn-secondary" onClick={() => setIsInserting(false)} style={{ padding: '8px 12px' }} title="Cancel">
                      <X size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {loading ? (
              <tr><td colSpan={columns.length + 1} style={{ textAlign: 'center' }}>Loading...</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={columns.length + 1} style={{ textAlign: 'center' }}>No records found.</td></tr>
            ) : (
              currentItems.map((row, relativeIndex) => {
                const absoluteIndex = indexOfFirstItem + relativeIndex;
                return (
                  <tr
                    key={absoluteIndex}
                    onClick={() => startEditing(absoluteIndex, row)}
                    style={{ cursor: 'pointer', transition: 'background 0.2s ease' }}
                    className="table-row-hover"
                  >
                    {columns.map(col => {
                      const val = row[col];

                      let renderedVal = '';
                      if (val === null || val === undefined) {
                        renderedVal = <em style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>null</em>;
                      } else if (typeof val === 'object') {
                        renderedVal = (
                          <div
                            title={JSON.stringify(val, null, 2)}
                            style={{
                              maxWidth: '220px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontFamily: 'monospace',
                              fontSize: '0.8rem',
                              color: 'var(--text-secondary)',
                              background: 'rgba(255, 255, 255, 0.05)',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              cursor: 'help'
                            }}
                          >
                            {JSON.stringify(val)}
                          </div>
                        );
                      } else if (typeof val === 'boolean') {
                        renderedVal = val ? 'true' : 'false';
                      } else {
                        renderedVal = String(val);
                      }
                      return <td key={col}>{renderedVal}</td>;
                    })}

                    <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => startEditing(absoluteIndex, row)}
                        style={{ padding: '6px 10px' }}
                        title="Edit Record"
                      >
                        <Edit2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {data.length > itemsPerPage && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '20px',
          padding: '16px 24px',
          background: 'var(--bg-glass)',
          border: '1px solid var(--border-glass)',
          borderRadius: '12px',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Showing <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{indexOfFirstItem + 1}</span> to{' '}
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {Math.min(indexOfLastItem, data.length)}
            </span> of <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{data.length}</span> entries
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="btn btn-secondary"
              style={{
                padding: '6px 12px', fontSize: '0.85rem',
                opacity: currentPage === 1 ? 0.4 : 1,
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
              }}
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              First
            </button>
            <button
              className="btn btn-secondary"
              style={{
                padding: '6px 12px', fontSize: '0.85rem',
                opacity: currentPage === 1 ? 0.4 : 1,
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
              }}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>

            {(() => {
              const totalPages = Math.ceil(data.length / itemsPerPage);
              const maxPagePills = 5;
              let startPage = Math.max(1, currentPage - 2);
              let endPage = Math.min(totalPages, startPage + maxPagePills - 1);

              if (endPage - startPage < maxPagePills - 1) {
                startPage = Math.max(1, endPage - maxPagePills + 1);
              }

              const pills = [];
              for (let page = startPage; page <= endPage; page++) {
                const isActive = page === currentPage;
                pills.push(
                  <button
                    key={page}
                    className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      padding: '6px 12px', fontSize: '0.85rem', minWidth: '32px',
                      boxShadow: isActive ? '0 2px 8px var(--accent-glow)' : 'none',
                      background: isActive ? 'var(--accent-primary)' : 'transparent',
                      borderColor: isActive ? 'var(--accent-primary)' : 'var(--border-glass)'
                    }}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                );
              }
              return pills;
            })()}

            <button
              className="btn btn-secondary"
              style={{
                padding: '6px 12px', fontSize: '0.85rem',
                opacity: currentPage === Math.ceil(data.length / itemsPerPage) ? 0.4 : 1,
                cursor: currentPage === Math.ceil(data.length / itemsPerPage) ? 'not-allowed' : 'pointer'
              }}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(data.length / itemsPerPage)))}
              disabled={currentPage === Math.ceil(data.length / itemsPerPage)}
            >
              Next
            </button>
            <button
              className="btn btn-secondary"
              style={{
                padding: '6px 12px', fontSize: '0.85rem',
                opacity: currentPage === Math.ceil(data.length / itemsPerPage) ? 0.4 : 1,
                cursor: currentPage === Math.ceil(data.length / itemsPerPage) ? 'not-allowed' : 'pointer'
              }}
              onClick={() => setCurrentPage(Math.ceil(data.length / itemsPerPage))}
              disabled={currentPage === Math.ceil(data.length / itemsPerPage)}
            >
              Last
            </button>
          </div>
        </div>
      )}

      {editingIndex !== null && (
        <div
          className="modal-overlay active"
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(10, 11, 26, 0.8)', backdropFilter: 'blur(8px)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.25s ease'
          }}
          onClick={() => { setEditingIndex(null); setEditingData({}); }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto',
              padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px',
              position: 'relative', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.12)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Edit Record</h3>
              <button
                className="btn btn-secondary"
                style={{ padding: '6px', border: 'none', background: 'transparent' }}
                onClick={() => { setEditingIndex(null); setEditingData({}); }}
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdate(editingIndex);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '55vh', overflowY: 'auto', paddingRight: '8px' }}>
                {columns.map(col => {
                  const originalVal = data[editingIndex][col];
                  const isObject = originalVal !== null && typeof originalVal === 'object';

                  return (
                    <div className="form-group" key={col} style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{col}</label>
                      {isObject ? (
                        <textarea
                          className="form-input"
                          style={{
                            fontFamily: 'monospace', fontSize: '0.85rem', minHeight: '120px',
                            resize: 'vertical', background: 'rgba(255, 255, 255, 0.02)'
                          }}
                          value={editingData[col] || ''}
                          onChange={(e) => setEditingData({ ...editingData, [col]: e.target.value })}
                        />
                      ) : (
                        renderColInput(
                          col,
                          editingData[col],
                          (val) => setEditingData({ ...editingData, [col]: val })
                        )
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setEditingIndex(null); setEditingData({}); }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Save size={16} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
