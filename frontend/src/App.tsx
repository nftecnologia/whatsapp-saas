import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import Templates from './pages/Templates';
import Campaigns from './pages/Campaigns';
import MessageLogs from './pages/MessageLogs';

function App() {
  const { loadUser } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="templates" element={<Templates />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="logs" element={<MessageLogs />} />
        <Route path="settings" element={<div>Configurações em desenvolvimento...</div>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;