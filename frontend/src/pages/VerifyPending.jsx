import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./login.css";

export default function VerifyPending() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("email") || "";
  }, [location.search]);

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="#0ea5e9">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="login-title">Verify your email</h1>
        <p className="login-desc" style={{ marginBottom: "1rem" }}>
          We sent a verification link to:
        </p>
        <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: "1rem" }}>{email}</div>
        <p className="login-desc" style={{ marginBottom: "1rem" }}>
          Please click the link in the email to continue. You won’t be able to use FridgeShare until your email is verified.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button className="login-btn" onClick={() => window.open("https://mail.google.com", "_blank")}>
            Open Gmail
          </button>
          <button className="login-btn-secondary" onClick={() => navigate("/login")}>
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
}


