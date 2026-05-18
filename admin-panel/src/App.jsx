import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import ConnectDB from './pages/ConnectDB';
import Dashboard from './pages/Dashboard';

const ProtectedRoute = ({ children }) => {
  const { token } = useContext(AuthContext);
  return token ? children : <Navigate to="/" />;
};

const ConnectedRoute = ({ children }) => {
  const { token, sessionId } = useContext(AuthContext);
  if (!token) return <Navigate to="/" />;
  if (!sessionId) return <Navigate to="/connect" />;
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/analytics" element={<Navigate to="/dashboard/analytics" replace />} />
        <Route 
          path="/connect" 
          element={
            <ProtectedRoute>
              <ConnectDB />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard/*" 
          element={
            <ConnectedRoute>
              <Dashboard />
            </ConnectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;
