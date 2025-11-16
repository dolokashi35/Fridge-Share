import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "./login.css";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export default function Verify() {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [message, setMessage] = useState("");

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const token = params.get("token") || "";
  const email = params.get("email") || "";

  useEffect(() => {
    const go = async () => {
      try {
        if (!token || !email) {
          setStatus("error");
          setMessage("Invalid verification link.");
          return;
        }
        await axios.post(`${BACKEND_URL}/users/verify`, { token, email });
        setStatus("success");
        // Mark local user as verified and send to profile setup
        try {
          const saved = localStorage.getItem("fs_user");
          const u = saved ? JSON.parse(saved) : null;
          if (u && u.username) {
            const next = { ...u, isVerified: true };
            localStorage.setItem("fs_user", JSON.stringify(next));
            setTimeout(() => window.location.replace("/setup"), 800);
          } else {
            // Fallback if no pending user found
            setTimeout(() => navigate("/login"), 800);
          }
        } catch {
          setTimeout(() => navigate("/login"), 800);
        }
      } catch (e) {
        setStatus("error");
        setMessage(e?.response?.data?.error || "Verification failed. The link may have expired.");
      }
    };
    go();
  }, [token, email, navigate]);

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke={status === "success" ? "#16a34a" : status === "error" ? "#ef4444" : "#0ea5e9"}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        {status === "verifying" && (
          <>
            <h1 className="login-title">Verifying…</h1>
            <p className="login-desc">Please wait while we confirm your email.</p>
          </>
        )}
        {status === "success" && (
          <>
            <h1 className="login-title">Email verified!</h1>
            <p className="login-desc">Redirecting you to login…</p>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="login-title">Verification failed</h1>
            <p className="login-desc" style={{ color: "#ef4444" }}>{message}</p>
            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <button className="login-btn-secondary" onClick={() => navigate("/login")}>
                Back to login
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


