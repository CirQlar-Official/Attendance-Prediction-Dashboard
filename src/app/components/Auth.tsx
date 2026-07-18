import { useState } from 'react';
import { signUp, signIn, signOut, getCurrentUser, saveUserProfile } from '../../lib/supabase';
import { Button } from './ui/button';
import { SmoothInput } from './ui/input';
import { Card } from './ui/card';
import { Alert } from './ui/alert';
import { Sparkles } from 'lucide-react';

interface AuthProps {
  user: any;
  onAuthChange: (user: any) => void;
}

export function Auth({ user, onAuthChange }: AuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error: err } = await signUp(email, password, fullName);
        if (err) throw err;
        const candidateUser = data.user ?? data.session?.user;
        if (candidateUser?.id && fullName.trim()) {
          await saveUserProfile(fullName, candidateUser.id);
        }
        alert('Check your email to confirm signup!');
      } else {
        const { error: err } = await signIn(email, password);
        if (err) throw err;
        const currentUser = await getCurrentUser();
        onAuthChange(currentUser);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    onAuthChange(null);
  };

  if (user) {
    return (
      <div className="app-shell-card-strong w-full max-w-xl p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="app-section-label">Signed in</p>
            <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{user.email}</p>
          </div>
          <Button onClick={handleSignOut} variant="outline" size="sm">
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="app-shell-card-strong flex flex-col justify-between overflow-hidden p-8">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-sm font-medium text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/40 dark:text-cyan-300">
            <Sparkles className="size-4" />
            Welcome to CAST
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl">Keep attendance simple, clear, and connected.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">Track every service, spot trends, and keep each group aligned with one polished workspace.</p>
          </div>
        </div>
        <div className="mt-8 flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-400 text-white shadow-lg shadow-cyan-500/20">
            <img src='src/app/context/Logo.png' className="h-auto w-3/4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">CAST</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Church Attendance Statistical Tracker</p>
          </div>
        </div>
      </div>

      <Card className="app-shell-card-strong border-0 p-6 shadow-none">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{isSignUp ? 'Create account' : 'Sign in'}</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{isSignUp ? 'Set up your workspace and start tracking attendance.' : 'Welcome back. Sign in to continue.'}</p>

        {error && (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {isSignUp && (
            <SmoothInput type="text" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          )}
          <SmoothInput type="text" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <SmoothInput type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:from-blue-500 hover:to-cyan-400">
            {loading ? 'Loading...' : isSignUp ? 'Create account' : 'Sign in'}
          </Button>
        </form>

        <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="mt-4 w-full text-center text-sm font-medium text-blue-600 hover:text-cyan-600 dark:text-cyan-300">
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
        </button>
      </Card>
    </div>
  );
}