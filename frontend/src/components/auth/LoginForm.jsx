// src/components/auth/LoginForm.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";

function LoginForm({ role }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [userid, setUserid] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!role) {
      setError("Please select a role (Admin or Teacher).");
      return;
    }

    if (!userid || !password) {
      setError("Enter both userid and password");
      return;
    }

    try {
      // ✅ SINGLE LOGIN ENDPOINT
      const res = await api.post("/auth/login", { userid, password, role });
      const userData = res.data;

      // wait for auth context to populate user info before navigating
      const me = await login(userData);

      // Navigate based on resolved role
      if ((me.role || userData.role || "").toUpperCase() === "ADMIN") {
        navigate("/admin");
      } else {
        navigate("/teacher");
      }
    } catch (err) {
      let msg = "Login failed. Please try again.";

      if (err?.response?.data?.error) {
        msg = err.response.data.error;
      } else if (err?.response?.data?.message) {
        msg = err.response.data.message;
      } else if (err?.response?.status === 401) {
        msg = "Invalid username or password.";
      } else if (err?.response?.status === 400) {
        msg = "Invalid input.";
      } else if (err?.response?.status === 500) {
        msg = "Server error. Try later.";
      }

      setError(msg);
      console.error("Login error:", err);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input
        value={userid}
        onChange={(e) => setUserid(e.target.value)}
        placeholder="User ID"
      />

      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type={showPassword ? "text" : "password"}
          style={{ paddingRight: "40px", width: "100%" }}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          style={{
            position: "absolute",
            right: "10px",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "18px"
          }}
        >
          {showPassword ? "👁️" : "👁️‍🗨️"}
        </button>
      </div>

      <button type="submit">Login</button>
      {error && <div style={{ color: "red" }}>{error}</div>}
    </form>
  );
}

export default LoginForm;
