import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './login.css';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function Login({ onAuth }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState('login');
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const eduRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.edu$/i;
    if (!eduRegex.test(username)) {
      setError("Please use a valid .edu email address");
      return;
    }

    try {
      const endpoint = `${BACKEND_URL}/users/${mode}`;
      const res = await axios.post(endpoint, { username, password });
      const { token, username: userName, profile } = res.data;

      onAuth(token, userName, profile);

      if (profile && profile.name && profile.college) {
        navigate('/marketplace');
      } else {
        navigate('/setup');
      }
    } catch (err) {
      console.error('Login/Register error:', err);
      setError(err.response?.data?.error || 'Error');
    }
  }


  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-icon">
          <span role="img" aria-label="fridge" style={{ fontSize: 28 }}>🧊</span>
        </div>

        <div className="login-title">
          Fridge<span className="highlight">Share</span>
        </div>

        <div className="login-desc">
          {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <input
            className="login-input"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Email address (.edu)"
            autoFocus
            autoComplete="username"
            required
          />
          <input
            className="login-input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
          />
          {error && <div className="login-error">{error}</div>}
          <button className="login-btn" type="submit">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="login-switch">
          {mode === 'login' ? (
            <span>
              Don't have an account?{' '}
              <button
                className="login-link"
                type="button"
                onClick={() => setMode('register')}
              >
                Create Account
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button
                className="login-link"
                type="button"
                onClick={() => setMode('login')}
              >
                Sign In
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
