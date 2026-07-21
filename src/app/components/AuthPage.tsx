import { useState } from 'react';
import { Users, Mail, Lock, User, Eye, EyeOff, Loader2, AlertCircle, Download, Smartphone, Check } from 'lucide-react';
import { usePWA } from '../hooks/usePWA';

interface Props {
  onLogin: (email: string, password: string) => Promise<boolean>;
  onSignup: (email: string, password: string, name: string) => Promise<boolean>;
  onResetPassword: (email: string, password: string) => Promise<boolean>;
  error: string | null;
  clearError: () => void;
}

export default function AuthPage({ onLogin, onSignup, onResetPassword, error, clearError }: Props) {
  const { isInstallable, promptInstall } = usePWA();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot_password'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const displayError = localError || error;

  const switchMode = (m: 'login' | 'signup' | 'forgot_password') => {
    setMode(m);
    setLocalError(null);
    setSuccessMessage(null);
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);
    clearError();

    if (mode === 'signup') {
      if (!name.trim()) { setLocalError('Please enter your name.'); return; }
      if (password !== confirmPassword) { setLocalError('Passwords do not match.'); return; }
      if (password.length < 6) { setLocalError('Password must be at least 6 characters.'); return; }
    }

    if (mode === 'forgot_password') {
      if (!email.trim()) { setLocalError('Please enter your email.'); return; }
      if (password !== confirmPassword) { setLocalError('Passwords do not match.'); return; }
      if (password.length < 6) { setLocalError('Password must be at least 6 characters.'); return; }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await onLogin(email, password);
      } else if (mode === 'signup') {
        await onSignup(email, password, name);
      } else if (mode === 'forgot_password') {
        const success = await onResetPassword(email, password);
        if (success) {
          setSuccessMessage('Password reset successfully! You can now sign in with your new password.');
          setMode('login');
          setPassword('');
          setConfirmPassword('');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 shadow-lg mb-4">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Track My Day</h1>
          <p className="text-sm text-gray-500 mt-1">Your shared life, organized together</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Tab switcher */}
          {mode !== 'forgot_password' ? (
            <div className="flex border-b border-gray-100">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`flex-1 py-4 text-sm font-semibold transition-colors ${
                  mode === 'login'
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`flex-1 py-4 text-sm font-semibold transition-colors ${
                  mode === 'signup'
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Create Account
              </button>
            </div>
          ) : (
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-sm font-bold text-gray-900">Reset Your Password</h2>
              <p className="text-xs text-gray-500 mt-0.5">Enter your email and a new password below</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Error alert */}
            {displayError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{displayError}</p>
              </div>
            )}

            {/* Success alert */}
            {successMessage && (
              <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-700">{successMessage}</p>
              </div>
            )}

            {/* Name (signup only) */}
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Your name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-medium text-gray-600">
                  {mode === 'forgot_password' ? 'New Password' : 'Password'}
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot_password')}
                    className="text-xs text-indigo-600 font-medium hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'forgot_password' ? 'Enter new password' : '••••••••'}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm password (signup or forgot_password) */}
            {(mode === 'signup' || mode === 'forgot_password') && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Confirm password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
            </button>

            {/* Note */}
            {mode !== 'forgot_password' ? (
              <p className="text-xs text-center text-gray-400">
                {mode === 'login'
                  ? "Don't have an account? "
                  : 'Already have an account? '}
                <button
                  type="button"
                  onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                  className="text-indigo-600 font-medium hover:underline cursor-pointer"
                >
                  {mode === 'login' ? 'Create one' : 'Sign in'}
                </button>
              </p>
            ) : (
              <p className="text-xs text-center text-gray-400">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-indigo-600 font-medium hover:underline cursor-pointer"
                >
                  Back to Sign In
                </button>
              </p>
            )}
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Your data is private and only accessible to you.
        </p>

        {/* Install app banner */}
        {isInstallable && (
          <div className="mt-6 bg-white rounded-xl shadow-lg p-4 border border-indigo-100">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900">Install Track My Day</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Add to your home screen for quick access - works like an app!
                </p>
                <button
                  onClick={promptInstall}
                  className="mt-3 w-full py-2 px-4 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  Install Now
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
