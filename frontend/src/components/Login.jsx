import React, { useState } from 'react';
import { Shield, Lock, User, AlertCircle, Loader, Sun, Moon } from 'lucide-react';

export default function Login({ onLogin, darkMode, setDarkMode }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Invalid username or password');
      }

      // Store JWT token
      localStorage.setItem('token', data.access_token);
      onLogin(data.access_token);
    } catch (err) {
      setError(err.message || 'Failed to connect to backend');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gray-50 dark:bg-[#09090b] p-4 transition-colors duration-200">
      {/* Background Glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-brand-orange-500/10 dark:bg-brand-orange-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-brand-orange-500/15 dark:bg-brand-orange-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Floating Theme Toggle */}
      <button
        onClick={() => setDarkMode(!darkMode)}
        className="absolute top-6 right-6 p-2 rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-gray-400 hover:text-brand-orange dark:hover:text-brand-orange transition-all duration-200 shadow-sm"
      >
        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      {/* Login Card */}
      <div className="w-full max-w-md glass-card rounded-2xl p-8 shadow-xl glow-orange transition-all-200">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-orange/10 text-brand-orange mb-4">
            <span className="text-3xl">🍊</span>
          </div>
          <h1 className="text-3xl font-bold font-sans tracking-tight text-gray-900 dark:text-white">
            Orange Pi <span className="text-brand-orange">Edge</span>
          </h1>
          <p className="text-gray-500 dark:text-zinc-400 mt-2 text-sm">
            Device Configuration & Monitoring Dashboard
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 mb-6 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 text-sm">
            <AlertCircle size={18} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 dark:text-zinc-500">
                <User size={18} />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900/50 border border-gray-300 dark:border-zinc-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange transition-all-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 dark:text-zinc-500">
                <Lock size={18} />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900/50 border border-gray-300 dark:border-zinc-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange transition-all-200"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-orange hover:bg-brand-orange-600 text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-brand-orange/20 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? (
              <>
                <Loader size={18} className="animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <Shield size={18} />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-gray-200 dark:border-zinc-800 pt-6">
          <p className="text-xs text-gray-400 dark:text-zinc-500 flex items-center justify-center gap-1.5">
            <span>Secured local edge connection</span>
            <span>•</span>
            <span>v1.0.0</span>
          </p>
        </div>
      </div>
    </div>
  );
}
