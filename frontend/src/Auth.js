import { useState } from "react";
import axios from "axios";
import { useDarkMode, getTheme, DarkModeToggle } from "./theme";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

export default function Auth({ onLoginSuccess }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDark, setIsDark] = useDarkMode();
  const theme = getTheme(isDark);

  const resetMessages = () => setError("");

  const handleLogin = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/auth/login`, { email, password });
      const { token, email: userEmail, userId, name } = res.data;
      localStorage.setItem("token", token);
      localStorage.setItem("email", userEmail);
      onLoginSuccess({ token, email: userEmail, userId, name });
    } catch (err) {
      setError(err.response?.data?.error || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/register`, { name, email, password });
      // After successful registration, switch to login with prefilled email
      setMode("login");
      setPassword("");
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: theme.pageBg,
        fontFamily: "Segoe UI, Arial, sans-serif",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          background: theme.surface,
          borderRadius: 12,
          border: `1px solid ${theme.border}`,
          padding: "32px 28px",
          boxShadow: theme.shadow,
        }}
      >
        {/* Brand + dark mode toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "#e6f1fb",
                color: "#185fa5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                fontSize: 16,
              }}
            >
              S
            </div>
            <span style={{ fontSize: 17, fontWeight: 600, color: theme.text }}>SecureSign</span>
          </div>
          <DarkModeToggle isDark={isDark} setIsDark={setIsDark} />
        </div>

        {mode === "login" ? (
          <>
            <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 600, color: theme.text }}>Welcome back</h2>
            <p style={{ fontSize: 13, color: theme.textMuted, margin: "0 0 20px" }}>
              Sign in to manage and sign your documents
            </p>

            <form onSubmit={handleLogin}>
              <label style={labelStyle(theme)}>Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputStyle(theme)}
              />

              <label style={labelStyle(theme)}>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={inputStyle(theme)}
              />

              {error && <p style={errorStyle}>{error}</p>}

              <button type="submit" disabled={loading} style={buttonStyle(loading)}>
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <p style={switchTextStyle(theme)}>
              No account?{" "}
              <span
                style={linkStyle}
                onClick={() => {
                  setMode("register");
                  resetMessages();
                }}
              >
                Create one
              </span>
            </p>
          </>
        ) : (
          <>
            <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 600, color: theme.text }}>Create your account</h2>
            <p style={{ fontSize: 13, color: theme.textMuted, margin: "0 0 20px" }}>
              Get started with SecureSign in seconds
            </p>

            <form onSubmit={handleRegister}>
              <label style={labelStyle(theme)}>Full name</label>
              <input
                type="text"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={inputStyle(theme)}
              />

              <label style={labelStyle(theme)}>Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputStyle(theme)}
              />

              <label style={labelStyle(theme)}>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={inputStyle(theme)}
              />

              {error && <p style={errorStyle}>{error}</p>}

              <button type="submit" disabled={loading} style={buttonStyle(loading)}>
                {loading ? "Creating account..." : "Create account"}
              </button>
            </form>

            <p style={switchTextStyle(theme)}>
              Already have an account?{" "}
              <span
                style={linkStyle}
                onClick={() => {
                  setMode("login");
                  resetMessages();
                }}
              >
                Sign in
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const labelStyle = (theme) => ({
  display: "block",
  fontSize: 13,
  color: theme.textMuted,
  marginBottom: 4,
  marginTop: 12,
});

const inputStyle = (theme) => ({
  width: "100%",
  padding: "9px 12px",
  fontSize: 14,
  border: `1px solid ${theme.inputBorder}`,
  borderRadius: 6,
  outline: "none",
  boxSizing: "border-box",
  background: theme.inputBg,
  color: theme.text,
});

const buttonStyle = (loading) => ({
  width: "100%",
  marginTop: 20,
  padding: "10px",
  fontSize: 14,
  fontWeight: 600,
  color: "#fff",
  background: loading ? "#9ca3af" : "#185fa5",
  border: "none",
  borderRadius: 6,
  cursor: loading ? "not-allowed" : "pointer",
});

const switchTextStyle = (theme) => ({
  textAlign: "center",
  fontSize: 13,
  color: theme.textMuted,
  marginTop: 16,
  marginBottom: 0,
});

const linkStyle = {
  color: "#185fa5",
  fontWeight: 600,
  cursor: "pointer",
};

const errorStyle = {
  color: "#c62828",
  fontSize: 13,
  marginTop: 10,
  marginBottom: 0,
};
