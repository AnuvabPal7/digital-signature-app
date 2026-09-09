import { useState, useEffect } from "react";
import axios from "axios";
import Auth from "./Auth";
import Dashboard from "./Dashboard";
import PublicSign from "./PublicSign";

// FIX: nothing in the original app ever attached the JWT to outgoing
// requests. It was stored in localStorage but never read again after
// login, which is why the backend had to fall back on trusting whatever
// userId the client sent instead. Setting it here as an axios default
// header means every axios call in the app (Dashboard, Auth) now
// authenticates itself automatically.
function setAuthHeader(token) {
  if (token) {
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common["Authorization"];
  }
}

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
      setAuthHeader(token);
      setUser({ token, email, userId, name });
    }
    setCheckingAuth(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoginSuccess = ({ token, email, userId, name }) => {
    localStorage.setItem("userId", userId);
    localStorage.setItem("name", name);
    setAuthHeader(token);
    setUser({ token, email, userId, name });
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    localStorage.removeItem("userId");
    localStorage.removeItem("name");
    setAuthHeader(null);
    setUser(null);
  };

  // Public signing link - no login required
  if (signMatch) {
    return <PublicSign token={signMatch[1]} />;
  }

  if (checkingAuth) {
    return null; // avoid flash of login screen while checking localStorage
  }

  if (!user) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <Dashboard
      onLogout={handleLogout}
      userId={user.userId}
      userName={user.name}
      token={user.token}
    />
  );
}
