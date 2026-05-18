// src/context/AuthContext.jsx
import { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [sessionId, setSessionId] = useState(localStorage.getItem('sessionId') || null);

  useEffect(() => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  }, [token]);

  useEffect(() => {
    if (sessionId) localStorage.setItem('sessionId', sessionId);
    else localStorage.removeItem('sessionId');
  }, [sessionId]);

  const login = (newToken) => setToken(newToken);
  const connectDb = (newSessionId) => setSessionId(newSessionId);
  
  const logout = () => {
    setToken(null);
    setSessionId(null);
  };

  return (
    <AuthContext.Provider value={{ token, sessionId, login, connectDb, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
