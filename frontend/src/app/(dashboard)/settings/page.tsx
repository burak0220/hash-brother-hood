'use client';
import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth';
import { usersAPI, authAPI } from '@/lib/api';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();

  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [totpCode, setTotpCode] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [totpUri, setTotpUri] = useState('');
  const [toggling2FA, setToggling2FA] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await usersAPI.update({ username, bio });
      setUser(data);
      toast.success('Your profile has been updated successfully.');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Unable to update your profile. Please try again.');
    }
    setSavingProfile(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match. Please make sure both fields are identical.');
      return;
    }
    setSavingPassword(true);
    try {
      await usersAPI.changePassword({ current_password: currentPassword, new_password: newPassword });
      toast.success('Your password has been changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Unable to change your password. Please check your current password and try again.');
    }
    setSavingPassword(false);
  };

  const handleEnable2FA = async () => {
    setToggling2FA(true);
    try {
      const { data } = await authAPI.enable2FA();
      setTotpSecret(data.secret);
      setTotpUri(data.uri);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Unable to initiate 2FA setup. Please try again.');
    }
    setToggling2FA(false);
  };

  const handleVerify2FA = async () => {
    setToggling2FA(true);
    try {
      await authAPI.verify2FA(totpCode);
      toast.success('Two-factor authentication has been enabled on your account.');
      setTotpSecret('');
      setTotpUri('');
      setTotpCode('');
      const { data } = await usersAPI.me();
      setUser(data);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'The code you entered is incorrect. Please try again.');
    }
    setToggling2FA(false);
  };

  const handleDisable2FA = async () => {
    setToggling2FA(true);
    try {
      await authAPI.disable2FA(totpCode);
      toast.success('Two-factor authentication has been disabled.');
      setTotpCode('');
      const { data } = await usersAPI.me();
      setUser(data);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'The code you entered is incorrect. Please try again.');
    }
    setToggling2FA(false);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-dark-400">Manage your account</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <Input label="Email" value={user?.email || ''} disabled />
            <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">Bio</label>
              <textarea
                className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 min-h-[80px]"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself"
              />
            </div>
            <Button type="submit" loading={savingProfile}>Save Profile</Button>
          </form>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <Input label="Current Password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            <Input label="Confirm New Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            <Button type="submit" loading={savingPassword}>Change Password</Button>
          </form>
        </CardContent>
      </Card>

      {/* 2FA */}
      <Card>
        <CardHeader><CardTitle>Two-Factor Authentication</CardTitle></CardHeader>
        <CardContent>
          {user?.totp_enabled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex w-2 h-2 bg-green-400 rounded-full" />
                <span className="text-sm text-green-400 font-medium">2FA is enabled</span>
              </div>
              <Input label="Enter 2FA code to disable" value={totpCode} onChange={(e) => setTotpCode(e.target.value)} placeholder="6-digit code" maxLength={6} />
              <Button variant="danger" onClick={handleDisable2FA} loading={toggling2FA}>Disable 2FA</Button>
            </div>
          ) : totpSecret ? (
            <div className="space-y-4">
              <p className="text-sm text-dark-300">Add this secret to your authenticator app:</p>
              <div className="bg-dark-800 p-3 rounded-lg">
                <code className="text-sm text-primary-400 break-all">{totpSecret}</code>
              </div>
              <Input label="Verification Code" value={totpCode} onChange={(e) => setTotpCode(e.target.value)} placeholder="Enter 6-digit code" maxLength={6} />
              <Button onClick={handleVerify2FA} loading={toggling2FA}>Verify & Enable</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-dark-400">Protect your account with two-factor authentication.</p>
              <Button onClick={handleEnable2FA} loading={toggling2FA}>Enable 2FA</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Referral */}
      <Card>
        <CardHeader><CardTitle>Referral Program</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-dark-400 mb-4">Share your referral code with friends. When they sign up using your code, both of you benefit from the platform.</p>
          {user?.referral_code ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 px-4 py-2.5 bg-dark-800/80 border border-dark-600/50 rounded-xl text-white font-mono text-sm">
                {user.referral_code}
              </div>
              <Button
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(user.referral_code || '');
                  toast.success('Referral code copied to clipboard.');
                }}
              >
                Copy
              </Button>
            </div>
          ) : (
            <p className="text-sm text-dark-500">Referral code not available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
