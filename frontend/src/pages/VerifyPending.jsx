import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "./login.css";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export default function VerifyPending() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);
  const [sentMsg, setSentMsg] = useState("");
  const email = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("email") || "";
  }, [location.search]);

  async function resend() {
    setSentMsg("");
    setSending(true);
    try {
      const stored = localStorage.getItem("fs_user");
      const token = stored ? JSON.parse(stored)?.token : null;
      if (!token) {
        setSentMsg("Please log in again to resend the email.");
        return;
      }
      await axios.post(`${BACKEND_URL}/users/verify/send`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setSentMsg("Verification email sent.");
    } catch (e) {
      const msg = e?.response?.data?.error || "Failed to resend. Try again later.";
      setSentMsg(msg);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="#0ea5e9">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="login-title">Verify your email</h1>
        <p className="login-desc" style={{ marginBottom: "0.5rem" }}>
          We sent a verification link to:
        </p>
        <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "1rem" }}>{email}</div>
        <p className="login-desc" style={{ marginBottom: "0.25rem" }}>
          Click the link in your email to continue.
        </p>
        <p className="login-desc" style={{ marginBottom: "1rem" }}>
          Check your spam folder if you don't see it.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 8, marginBottom: 12 }}>
          <button className="login-btn" onClick={() => window.open("https://mail.google.com", "_blank")}>
            Open Gmail
          </button>
          <button className="login-btn-secondary" onClick={() => navigate("/login")}>
            Back to login
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="login-desc">Didn’t get it?</span>
          <button
            className="login-link"
            type="button"
            onClick={resend}
            disabled={sending}
          >
            {sending ? "Resending…" : "Resend email"}
          </button>
        </div>
        {sentMsg && <div className="login-desc" style={{ marginTop: 8 }}>{sentMsg}</div>}
      </div>
    </div>
  );
}


