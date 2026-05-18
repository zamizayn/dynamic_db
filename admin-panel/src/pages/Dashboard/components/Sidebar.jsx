import { useEffect, useState, useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Database, Table, LogOut, BarChart2 } from 'lucide-react';
import { fetchWithAuth } from '../../../utils/api';
import { AuthContext } from '../../../context/AuthContext';

export default function Sidebar({ onSelectTable }) {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const { sessionId, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const data = await fetchWithAuth(`/tables/${sessionId}`);
        if (data.success) {
          setTables(data.tables);
        }
      } catch (err) {
        console.error('Failed to fetch tables:', err);
      } finally {
        setLoading(false);
      }
    };
    if (sessionId) fetchTables();
  }, [sessionId]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div style={{
      width: '260px',
      background: 'var(--bg-glass)',
      borderRight: '1px solid var(--border-glass)',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 0',
      overflowY: 'auto'
    }}>
      <div style={{ padding: '0 24px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <Database size={24} color="var(--accent-primary)" />
        <h2 style={{ fontSize: '1.2rem', margin: 0 }}>DynamicDB</h2>
      </div>

      <div style={{ padding: '0 12px', marginBottom: '20px' }}>
        <NavLink
          to="/dashboard/analytics"
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 16px',
            borderRadius: '8px',
            color: isActive ? 'white' : 'var(--text-secondary)',
            background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
            textDecoration: 'none',
            fontWeight: 600,
            transition: 'all 0.2s'
          })}
          onClick={() => onSelectTable('')}
        >
          <BarChart2 size={16} color="var(--accent-primary)" />
          Analytics Dashboard
        </NavLink>
      </div>

      <div style={{ padding: '0 24px', marginBottom: '12px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', fontWeight: 600 }}>
        Tables
      </div>

      <div style={{ padding: '0 12px' }}>
        {loading ? (
          <div style={{ padding: '0 12px', color: 'var(--text-secondary)' }}>Loading...</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {tables.map(table => (
              <li key={table}>
                <NavLink
                  to={`/dashboard/${table}`}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    color: isActive ? 'white' : 'var(--text-secondary)',
                    background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
                    textDecoration: 'none',
                    marginBottom: '4px',
                    transition: 'all 0.2s'
                  })}
                  onClick={() => onSelectTable(table)}
                >
                  <Table size={16} />
                  {table}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ padding: '0 12px', marginTop: '16px' }}>
        <div
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 16px',
            borderRadius: '8px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ef4444';
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <LogOut size={16} color="#ef4444" style={{ flexShrink: 0 }} />
          Logout
        </div>
      </div>
    </div>
  );
}
