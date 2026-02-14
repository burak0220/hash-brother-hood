'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import toast from 'react-hot-toast';
import { authAPI } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passwords do not match. Please make sure both password fields are identical.');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters long for your account security.');
      return;
    }

    setLoading(true);

    try {
      const response = await authAPI.register({ email, username, password });
      console.log('Registration success:', response);
      toast.success('Your account has been created successfully. You can now sign in.');
      setTimeout(() => router.push('/login'), 1000);
    } catch (err: any) {
      console.error('Registration error:', err);

      // Handle different error formats
      let errorMsg = 'Registration could not be completed. Please try again.';

      if (err?.response?.data?.detail) {
        const detail = err.response.data.detail;
        // Check if detail is array of validation errors
        if (Array.isArray(detail)) {
          errorMsg = detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(', ');
        } else if (typeof detail === 'string') {
          errorMsg = detail;
        } else if (typeof detail === 'object') {
          errorMsg = detail.msg || detail.message || JSON.stringify(detail);
        }
      } else if (err?.message) {
        errorMsg = err.message;
      }

      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Create Account</h1>
      <p className="text-dark-400 mb-6">Join the mining community</p>

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
          label="Username"
          type="text"
          placeholder="Choose a username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          placeholder="Create a strong password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Input
          label="Confirm Password"
          type="password"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <Button type="submit" className="w-full" loading={loading}>
          Create Account
        </Button>
      </form>

      <p className="text-center text-dark-400 text-sm mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-primary-400 hover:text-primary-300 font-medium">
          Sign In
        </Link>
      </p>
    </div>
  );
}
