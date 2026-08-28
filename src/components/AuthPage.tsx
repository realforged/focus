import React, { useState } from 'react';
import { api } from '../api';
import { Zap, Shield, AlertCircle, ArrowUpRight, Lock, Mail, UserPlus, LogIn } from 'lucide-react';

interface AuthPageProps {
  onAuthSuccess: (token: string, user: any) => void;
}

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email || !password) {
      setError('Please fill in both email and password fields.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        const data = await api.login(email, password);
        onAuthSuccess(data.token, data.user);
      } else {
        const data = await api.register(email, password);
        onAuthSuccess(data.token, data.user);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected authentication failure occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex font-sans min-h-screen items-center justify-center bg-[#06070a] px-4 py-12 relative overflow-hidden">
      {/* Dynamic graphic lighting glow in background */}
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-tr from-sky-500/10 to-transparent blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-bl from-teal-500/10 to-transparent blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-[#0F111A] border border-[#1F2335] rounded-2xl shadow-2xl p-8 md:p-10 relative z-10">
        
        {/* Title branding header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white shadow-lg shadow-indigo-500/15 mb-3">
            <Zap className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white mb-1 flex items-center justify-center gap-2">
            FOCUS NOW
          </h2>
          <p className="text-xs text-gray-400 max-w-xs mx-auto uppercase tracking-wider font-mono">
            90-Day Lock-In Summit Tracker
          </p>
        </div>

        {/* Tab Selector: Sign In vs Create Account */}
        <div className="flex rounded-xl bg-[#161925] p-1 mb-6 border border-[#242A3D]">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              isLogin
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              !isLogin
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Register</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-rose-500/15 border border-rose-500/30 rounded-xl flex gap-3 text-rose-200 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
            <div>
              <p className="font-semibold text-rose-100">{isLogin ? 'Sign In Failed' : 'Registration Failed'}</p>
              <p className="text-xs text-rose-300/90 leading-tight mt-0.5">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              <span>Email Address</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-[#161925] border border-[#242A3D] text-white rounded-xl py-3 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>Password</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#161925] border border-[#242A3D] text-white rounded-xl py-3 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
              required
              minLength={6}
            />
            {!isLogin && (
              <p className="text-[11px] text-gray-500 mt-1.5 ml-1 font-mono">
                Must be at least 6 characters
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white font-medium py-3 rounded-xl transition shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-2 cursor-pointer mt-6"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>{isLogin ? 'Sign In to Tracker' : 'Create Account & Start'}</span>
                <ArrowUpRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            className="text-gray-400 hover:text-white transition text-xs cursor-pointer"
          >
            {isLogin ? (
              <>New to Focus Now? <span className="text-indigo-400 font-bold hover:underline">Create a free account</span></>
            ) : (
              <>Already have an account? <span className="text-indigo-400 font-bold hover:underline">Sign in here</span></>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
