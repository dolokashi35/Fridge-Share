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
    try {
      const res = await axios.post(`${BACKEND_URL}/${mode}`, { username, password });
      onAuth(res.data.token, res.data.username);
      navigate('/setup');
    } catch (err) {
      setError(err.response?.data?.error || 'Error');
    }
  }

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-icon">
          <span role="img" aria-label="fridge" style={{ fontSize: 32 }}>🧊</span>
        </div>
        <div className="login-title">
          Fridge<span className="highlight">Share</span>
        </div>
        <div className="login-desc">
          {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
        </div>
        <form className="login-form" onSubmit={handleSubmit} style={{ width: '100%' }}>
          <input
            className="login-input"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Username"
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
          <button className="login-btn" type="submit">{mode === 'login' ? 'Login' : 'Sign Up'}</button>
        </form>
        <div className="login-switch">
          {mode === 'login' ? (
            <span>New? <button className="login-link" type="button" onClick={() => setMode('register')}>Sign Up</button></span>
          ) : (
            <span>Have an account? <button className="login-link" type="button" onClick={() => setMode('login')}>Login</button></span>
          )}
        </div>
      </div>
    </div>
  );
}
