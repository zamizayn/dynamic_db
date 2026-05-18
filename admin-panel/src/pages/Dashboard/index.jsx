import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TableView from './components/TableView';
import AnalyticsDashboard from './components/AnalyticsDashboard';

export default function Dashboard() {
  const [selectedTable, setSelectedTable] = useState('');

  return (
    <div className="app-container fade-in">
      <Sidebar onSelectTable={setSelectedTable} />

      <Routes>
        <Route path="/" element={<Navigate to="/dashboard/analytics" replace />} />
        <Route path="/analytics" element={<AnalyticsDashboard />} />
        <Route path="/:table" element={<TableView />} />
      </Routes>
    </div>
  );
}
