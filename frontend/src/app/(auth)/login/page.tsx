'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needs2FA, setNeeds2FA] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password, totpCode || undefined);
      toast.success('Welcome back!');
      window.location.href = '/dashboard';
    } catch (err: any) {
      console.error('Login error:', err);
      const detail = err.response?.data?.detail || err.message || 'Login failed';
      if (detail === '2FA code required') {
        setNeeds2FA(true);
        toast('Enter your 2FA code');
      } else {
        setError(detail);
        toast.error(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Welcome Back</h1>
      <p className="text-dark-400 mb-6">Sign in to your account</p>

      {error && (
        <div className="mb-4 p-3 bg-neon-red/10 border border-neon-red/30 rounded-lg text-sm text-neon-red">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {needs2FA && (
          <Input
            label="2FA Code"
            type="text"
            placeholder="Enter 6-digit code"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            maxLength={6}
          />
        )}
        <Button type="submit" className="w-full" loading={loading}>
          Sign In
        </Button>
      </form>

      <p className="text-center text-dark-400 text-sm mt-6">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-primary-400 hover:text-primary-300 font-medium">
          Sign Up
        </Link>
      </p>
    </div>
  );
}
