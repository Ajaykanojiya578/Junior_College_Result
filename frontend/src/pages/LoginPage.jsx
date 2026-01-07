// src/pages/LoginPage.jsx
import React, { useState } from "react";
import LoginSelector from "../components/auth/LoginSelector";
import LoginForm from "../components/auth/LoginForm";

const logoUrl = "/logo.jpg"; // served from public/

export default function LoginPage() {
  const [role, setRole] = useState("");

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f7f7f7",
      padding: "20px"
    }}>
      <div style={{
        width: 420,
        background: "white",
        padding: 24,
        borderRadius: 8,
        boxShadow: "0 6px 18px rgba(0,0,0,0.06)"
      }}>
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          {/* logo - the path will be transformed to a usable URL by your environment */}
          <img src={logoUrl} alt="logo" style={{ width: 325, height: "14", marginBottom: 8 }} />
          <h2 style={{ margin: 0, fontSize: 20 }}>junior college </h2>
          <p style={{ marginTop: 6, color: "#666", fontSize: 13 }}>Login as Admin or Teacher</p>
        </div>

        <LoginSelector role={role} setRole={setRole} />

        <div style={{ marginTop: 8 }}>
          <LoginForm role={role} />
        </div>
      </div>
    </div>
  );
}
