// src/pages/Admin/AdminTeacherList.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

export default function AdminTeacherList() {
  const [teachers, setTeachers] = useState([]);
  const navigate = useNavigate();

  const loadTeachers = useCallback(async () => {
    try {
      const res = await api.get("/admin/teachers");
      setTeachers(res.data);
    } catch (err) {
      alert("Failed to load teachers");
    }
  }, []);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  const deleteTeacher = async (id) => {
    if (!window.confirm("Are you sure you want to delete this teacher?")) return;

    try {
      await api.delete(`/admin/teachers/${id}`);
      loadTeachers();
    } catch (err) {
      alert("Failed to delete teacher");
    }
  };

  const openAsTeacher = async (id) => {
    try {
      const res = await api.post(`/admin/teachers/${id}/impersonate`);
      const { token, teacher } = res.data;
      if (!token) return alert('Failed to impersonate teacher');

      // Capture current admin page (return URL) and backup admin auth/user
      // Use the full current URL as the admin return URL so the teacher tab
      // can reliably redirect back to the exact admin page it was opened from.
      const currentReturn = window.location.href;
      const adminBackupToken = localStorage.getItem('authToken') || '';
      const adminBackupUser = localStorage.getItem('user') || '';

      // Open teacher panel in a new tab using the token as query params
      const url = `${window.location.origin}/teacher?impersonate_token=${encodeURIComponent(token)}&teacher_id=${encodeURIComponent(teacher.teacher_id)}&teacher_name=${encodeURIComponent(teacher.name)}&admin_backup_token=${encodeURIComponent(adminBackupToken)}&admin_backup_user=${encodeURIComponent(adminBackupUser)}&admin_return_url=${encodeURIComponent(currentReturn)}`;
      window.open(url, '_blank');
    } catch (err) {
      alert('Failed to open teacher panel');
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={() => navigate('/admin')} style={{ padding: '6px 10px' }}>Go Back</button>
        <h2 style={{ margin: 0 }}>Teachers</h2>
        <div style={{ width: 80 }} />
      </div>

      <button onClick={() => navigate("/admin/teachers/add")}>Add Teacher</button>

      <table border="1" cellPadding="8" style={{ marginTop: "15px" }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>User ID</th>
            <th>Email</th>
            <th>Active</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {teachers.map((t) => (
            <tr key={t.teacher_id}>
              <td>{t.name}</td>
              <td>{t.userid}</td>
              <td>{t.email || "-"}</td>
              <td>{t.active ? "Yes" : "No"}</td>
              <td>
                <button onClick={() => navigate(`/admin/teachers/edit/${t.teacher_id}`)}>
                  Edit
                </button>{" "}
                <button onClick={() => deleteTeacher(t.teacher_id)}>
                  Delete
                </button>{" "}
                <button onClick={() => openAsTeacher(t.teacher_id)}>
                  Open as Teacher
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
