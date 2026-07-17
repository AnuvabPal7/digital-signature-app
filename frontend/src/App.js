import { useState, useEffect } from "react";
import Auth from "./Auth";
import Dashboard from "./Dashboard";
import PublicSign from "./PublicSign";

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check if this is a public signing link: /sign/{token}
  const path = window.location.pathname;
  const signMatch = path.match(/^\/sign\/(.+)$/);

  useEffect(() => {
    if (signMatch) {
      setCheckingAuth(false);
      return;
    }
    const token = localStorage.getItem("token");
    const email = localStorage.getItem("email");
    const userId = localStorage.getItem("userId");
    const name = localStorage.getItem("name");
    if (token && email) {
      setUser({ token, email, userId, name });
    }
    setCheckingAuth(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoginSuccess = ({ token, email, userId, name }) => {
    localStorage.setItem("userId", userId);
    localStorage.setItem("name", name);
    setUser({ token, email, userId, name });
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    localStorage.removeItem("userId");
    localStorage.removeItem("name");
    setUser(null);
  };

  // Public signing link â€” no login required
  if (signMatch) {
    return <PublicSign token={signMatch[1]} />;
  }

  if (checkingAuth) {
    return null; // avoid flash of login screen while checking localStorage
  }

  if (!user) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return <Dashboard onLogout={handleLogout} userId={user.userId} userName={user.name} />;
}