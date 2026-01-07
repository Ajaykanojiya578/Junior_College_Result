// src/pages/Teacher/TeacherDashboard.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function TeacherDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("impersonate_token");
      if (token) {
        // store impersonation token in sessionStorage so api requests use it
        sessionStorage.setItem("impersonateToken", token);
        // save teacher id/name for UI
        const teacherId = params.get("teacher_id");
        if (teacherId) sessionStorage.setItem("impersonateTeacherId", teacherId);
        const teacherName = params.get("teacher_name");
        if (teacherName) sessionStorage.setItem("impersonateTeacherName", teacherName);

        // capture admin backup token/user and the exact return URL (if provided)
        const adminBackupToken = params.get('admin_backup_token');
        const adminBackupUser = params.get('admin_backup_user');
        const adminReturnUrl = params.get('admin_return_url');
        if (adminBackupToken) sessionStorage.setItem('adminBackupAuthToken', adminBackupToken);
        if (adminBackupUser) sessionStorage.setItem('adminBackupUser', adminBackupUser);
        if (adminReturnUrl) sessionStorage.setItem('adminReturnUrl', adminReturnUrl);

        // cleanup the url so tokens aren't visible in address bar
        params.delete("impersonate_token");
        params.delete("teacher_id");
        params.delete("teacher_name");
        params.delete('admin_backup_token');
        params.delete('admin_backup_user');
        params.delete('admin_return_url');
        const newUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : "");
        window.history.replaceState({}, document.title, newUrl);
      }
    } catch (err) {
      // ignore
    }
  }, []);

  const impersonatedName = sessionStorage.getItem("impersonateTeacherName");

  const isImpersonating = Boolean(sessionStorage.getItem('impersonateToken'));

  function backToAdmin() {
    // Restore backed-up admin session (if available) then navigate to Manage Teachers
    try {
      const adminToken = sessionStorage.getItem('adminBackupAuthToken');
      const adminUser = sessionStorage.getItem('adminBackupUser');
      if (adminToken) localStorage.setItem('authToken', adminToken);
      if (adminUser) localStorage.setItem('user', adminUser);
    } catch (e) {
      // ignore
    }
    // Navigate back to the saved admin return URL (if present) or Manage Teachers
    let returnUrl = sessionStorage.getItem('adminReturnUrl') || '/admin/teachers';

    // Clear impersonation keys for this tab (single cleanup)
    try {
      sessionStorage.removeItem('impersonateToken');
      sessionStorage.removeItem('impersonateTeacherId');
      sessionStorage.removeItem('impersonateTeacherName');
      sessionStorage.removeItem('adminBackupAuthToken');
      sessionStorage.removeItem('adminBackupUser');
      sessionStorage.removeItem('adminReturnUrl');
    } catch (e) {}

    // If the saved return URL is relative, make it absolute so navigation is reliable
    try {
      if (!/^https?:\/\//i.test(returnUrl)) {
        returnUrl = window.location.origin + returnUrl;
      }
    } catch (e) {
      // fallback: leave as-is
    }

    // Navigate to the admin return URL
    window.location.href = returnUrl;
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2>Teacher Dashboard</h2>

      <p style={{ marginBottom: 8 }}>Welcome, <strong>{user?.userid}</strong></p>
      {sessionStorage.getItem("impersonateToken") && (
        <div style={{ marginBottom: 12, color: '#b91c1c', fontWeight: 600 }}>
          Logged in as: {impersonatedName || user?.name} (Opened by Admin)
        </div>
      )}

      <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <button
          onClick={() => navigate('/teacher/add-marks')}
          style={{ padding: "12px 16px", width: "260px", fontWeight: 600 }}
        >
          Add Marks
        </button>

        <button
          onClick={() => navigate('/teacher/subject-result')}
          style={{ padding: "12px 16px", width: "260px" }}
        >
          View Results (Subject-wise)
        </button>

        <button
          onClick={logout}
          style={{
            padding: "12px 16px",
            width: "260px",
            background: "#c0392b",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontWeight: 600
          }}
        >
          Logout
        </button>
        {isImpersonating && (
          <button
            onClick={backToAdmin}
            style={{
              padding: "12px 16px",
              width: "260px",
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: 700
            }}
          >
            Back to Admin / Manage Teachers
          </button>
        )}
      </div>
    </div>
  );
}
