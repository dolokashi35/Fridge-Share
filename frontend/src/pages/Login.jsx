import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './login.css';
import logo from '../assets/fridgeshare-logo.png';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function Login({ onAuth }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState('login');
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(username)) {
      setError("Please enter a valid email address");
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
          <img 
            src={logo} 
            alt="FridgeShare Logo" 
            className="login-logo-img"
          />
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
            placeholder="Email address"
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
