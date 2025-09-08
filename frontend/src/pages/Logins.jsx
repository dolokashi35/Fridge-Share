import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./login.css";

export default function Logins({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");

  const nav = useNavigate();
  const isEdu = (v) => /\S+@\S+\.edu$/i.test(v);

  const submit = (e) => {
    e.preventDefault();
    if (!isEdu(email)) {
      setErr("Please use a valid .edu email address.");
      return;
    }
    setErr("");
    onLogin?.({ email });
    nav("/setup");
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="#16a34a">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 10-8 0v4M5 9h14l-1 10a2 2 0 01-2 2H8a2 2 0 01-2-2L5 9z" />
          </svg>
        </div>
        <h1 className="login-title">
          Welcome to <span className="highlight">FridgeShare</span>
        </h1>
        <p className="login-desc">Sign in to continue</p>
        <div style={{ margin: '1rem 0', width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
        </div>
        <form onSubmit={submit} className="login-form" noValidate>
          <div>
            <label className="login-label">Email</label>
            <input
              type="email"
              placeholder="you@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`login-input${err ? ' error' : ''}`}
              required
            />
          </div>
          <div>
            <label className="login-label">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              className="login-input"
            />
          </div>
          {err && <p className="login-error">{err}</p>}
          <button type="submit" className="login-btn">Sign in</button>
        </form>
        <div className="login-footer">
          <button type="button">Forgot password?</button>
          <button type="button">Need an account? <span style={{ fontWeight: 600 }}>Sign up</span></button>
        </div>
      </div>
    </div>
  );
}


import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./login.css";

export default function Logins({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");

  const nav = useNavigate();
  const isEdu = (v) => /\S+@\S+\.edu$/i.test(v);

  const submit = (e) => {
    e.preventDefault();
    if (!isEdu(email)) {
      setErr("Please use a valid .edu email address.");
      return;
    }
    setErr("");
    onLogin?.({ email });
    nav("/setup");
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="#16a34a">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 10-8 0v4M5 9h14l-1 10a2 2 0 01-2 2H8a2 2 0 01-2-2L5 9z" />
          </svg>
        </div>
        <h1 className="login-title">
          Welcome to <span className="highlight">FridgeShare</span>
        </h1>
        <p className="login-desc">Sign in to continue</p>
        <div style={{ margin: '1rem 0', width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
        </div>
        <form onSubmit={submit} className="login-form" noValidate>
          <div>
            <label className="login-label">Email</label>
            <input
              type="email"
              placeholder="you@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`login-input${err ? ' error' : ''}`}
              required
            />
          </div>
          <div>
            <label className="login-label">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              className="login-input"
            />
          </div>
          {err && <p className="login-error">{err}</p>}
          <button type="submit" className="login-btn">Sign in</button>
        </form>
        <div className="login-footer">
          <button type="button">Forgot password?</button>
          <button type="button">Need an account? <span style={{ fontWeight: 600 }}>Sign up</span></button>
        </div>
      </div>
    </div>
  );
}
