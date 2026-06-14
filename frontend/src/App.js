import { useState, useEffect } from "react";
import Auth from "./Auth";
import Dashboard from "./Dashboard";

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const email = localStorage.getItem("email");
    if (token && email) {
      setUser({ token, email });
    }
    setCheckingAuth(false);
  }, []);

  const handleLoginSuccess = ({ token, email }) => {
    setUser({ token, email });
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    setUser(null);
  };

  if (checkingAuth) {
    return null; // avoid flash of login screen while checking localStorage
  }

  if (!user) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return <Dashboard onLogout={handleLogout} />;
}