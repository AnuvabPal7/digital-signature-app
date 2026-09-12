import { useState, useEffect } from "react";

// Shared across Auth, Dashboard, and PublicSign so the preference is
// consistent app-wide even though these are three separate mounts (a
// recipient opening a public /sign/{token} link never goes through the
// logged-in shell). Persisted to localStorage under one key so switching
// between them (e.g. logging out, or opening a signing link in a new tab)
// keeps the same light/dark choice.
const STORAGE_KEY = "securesign-dark-mode";

export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isDark));
    } catch {
      // ignore - dark mode preference just won't persist this session
    }
  }, [isDark]);

  return [isDark, setIsDark];
}

// Only the structural/"chrome" colors are themed: page background, card
// surfaces, borders, and text. Semantic colors are left alone on purpose -
// status badges (pending/signed/rejected), the signature color picker, and
// action buttons (accept/decline) carry meaning independent of light or
// dark mode, and re-theming them would reduce clarity rather than help it.
export function getTheme(isDark) {
  return isDark
    ? {
        pageBg: "#12151a",
        surface: "#1c2128",
        surfaceAlt: "#242a33",
        border: "#333a44",
        text: "#e6e8eb",
        textMuted: "#9aa1ac",
        inputBg: "#20262f",
        inputBorder: "#3a424c",
        shadow: "0 1px 3px rgba(0,0,0,0.4)",
      }
    : {
        pageBg: "#f7f8fa",
        surface: "#ffffff",
        surfaceAlt: "#fafafa",
        border: "#e5e7eb",
        text: "#1a1a1a",
        textMuted: "#6b7280",
        inputBg: "#ffffff",
        inputBorder: "#d1d5db",
        shadow: "0 1px 3px rgba(0,0,0,0.04)",
      };
}

export function DarkModeToggle({ isDark, setIsDark, style }) {
  return (
    <button
      onClick={() => setIsDark((d) => !d)}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        padding: "6px 12px",
        fontSize: 13,
        fontWeight: 600,
        borderRadius: 6,
        cursor: "pointer",
        background: "transparent",
        color: isDark ? "#e6e8eb" : "#374151",
        border: `1px solid ${isDark ? "#3a424c" : "#d1d5db"}`,
        ...style,
      }}
    >
      {isDark ? "☀️ Light" : "🌙 Dark"}
    </button>
  );
}
