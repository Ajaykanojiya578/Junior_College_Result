// src/pages/Admin/AdminDashboard.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const menu = [
    { key: 'teachers', label: 'Manage Teachers', to: '/admin/teachers' },
    { key: 'view-results', label: 'View Complete Result', to: '/admin/results' },
    { key: 'alloc', label: 'Allocate Subjects', to: '/admin/allocations' },
    { key: 'add-student', label: 'Add Student', to: '/admin/students/add' },
    { key: 'view-students', label: 'View Students', to: '/admin/students' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '80vh' }}>
      <aside style={{ width: 220, background: '#f8fafc', padding: 20, borderRight: '1px solid #eef2f6' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 800, color: '#2c3e50' }}>Admin </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{user?.name}</div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {menu.map(m => (
            <button key={m.key} onClick={() => navigate(m.to)} style={{ textAlign: 'left', padding: '10px 12px', background: 'white', border: '1px solid #e6eef6', borderRadius: 6, cursor: 'pointer' }}>{m.label}</button>
          ))}

          <button onClick={logout} style={{ marginTop: 12, padding: '8px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6 }}>Logout</button>
        </nav>
      </aside>

      <main style={{ flex: 1, padding: 24 }}>
        <h2 style={{ marginTop: 0 }}>Overview</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <div onClick={() => navigate('/admin/teachers')} style={{ padding: 16, background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', cursor: 'pointer' }}>
            <div style={{ fontWeight: 800 }}>Manage Teachers</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Add, edit or remove teacher accounts</div>
          </div>

          <div onClick={() => navigate('/admin/allocations')} style={{ padding: 16, background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', cursor: 'pointer' }}>
            <div style={{ fontWeight: 800 }}>Allocate Subjects</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Assign teachers to subjects and divisions</div>
          </div>

          <div onClick={() => navigate('/admin/students/add')} style={{ padding: 16, background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', cursor: 'pointer' }}>
            <div style={{ fontWeight: 800 }}>Add Student</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Create student records quickly</div>
          </div>

          <div onClick={() => navigate('/admin/students')} style={{ padding: 16, background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', cursor: 'pointer' }}>
            <div style={{ fontWeight: 800 }}>View Students</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Browse and export student lists</div>
          </div>
        </div>
      </main>
    </div>
  );
}
