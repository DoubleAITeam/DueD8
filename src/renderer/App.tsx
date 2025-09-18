// src/renderer/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ConnectCanvas from './pages/ConnectCanvas';
import Course from './pages/Course';
import AssignmentDetail from './pages/AssignmentDetail';

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ padding: 16 }}>
        <nav style={{ marginBottom: 12 }}>
          <NavLink to="/">Dashboard</NavLink>{' | '}
          <NavLink to="/connect">Connect</NavLink>
        </nav>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/connect" element={<ConnectCanvas />} />
          <Route path="/course/:id" element={<Course />} />
          <Route path="/assignment/:id" element={<AssignmentDetail assignment={null} onBack={() => {}} />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}