'use client';
import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth';
import { usersAPI, authAPI, algorithmsAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import type { PoolProfile, Algorithm } from '@/types';

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

  // Pool Profiles
  const [poolProfiles, setPoolProfiles] = useState<PoolProfile[]>([]);
  const [algorithms, setAlgorithms] = useState<Algorithm[]>([]);
  const [showAddPool, setShowAddPool] = useState(false);
  const [editingProfile, setEditingProfile] = useState<PoolProfile | null>(null);
  const [poolForm, setPoolForm] = useState({
    name: '', pool_url: '', pool_user: '', pool_password: 'x', algorithm_id: '', is_default: false,
    pool2_url: '', pool2_user: '', pool2_password: 'x',
    pool3_url: '', pool3_user: '', pool3_password: 'x',
    pool4_url: '', pool4_user: '', pool4_password: 'x',
    pool5_url: '', pool5_user: '', pool5_password: 'x',
  });
  const [savingPool, setSavingPool] = useState(false);

  useEffect(() => {
    usersAPI.poolProfiles().then(({ data }) => setPoolProfiles(data)).catch(() => {});
    algorithmsAPI.list().then(({ data }) => setAlgorithms(data)).catch(() => {});
  }, []);

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

  const resetPoolForm = () => {
    setPoolForm({
      name: '', pool_url: '', pool_user: '', pool_password: 'x', algorithm_id: '', is_default: false,
      pool2_url: '', pool2_user: '', pool2_password: 'x',
      pool3_url: '', pool3_user: '', pool3_password: 'x',
      pool4_url: '', pool4_user: '', pool4_password: 'x',
      pool5_url: '', pool5_user: '', pool5_password: 'x',
    });
    setEditingProfile(null);
    setShowAddPool(false);
  };

  const handleSavePool = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPool(true);
    try {
      const payload: any = {
        name: poolForm.name,
        pool_url: poolForm.pool_url,
        pool_user: poolForm.pool_user,
        pool_password: poolForm.pool_password || 'x',
        algorithm_id: poolForm.algorithm_id ? parseInt(poolForm.algorithm_id) : undefined,
        is_default: poolForm.is_default,
        pool2_url: poolForm.pool2_url || undefined,
        pool2_user: poolForm.pool2_user || undefined,
        pool2_password: poolForm.pool2_password || undefined,
        pool3_url: poolForm.pool3_url || undefined,
        pool3_user: poolForm.pool3_user || undefined,
        pool3_password: poolForm.pool3_password || undefined,
        pool4_url: poolForm.pool4_url || undefined,
        pool4_user: poolForm.pool4_user || undefined,
        pool4_password: poolForm.pool4_password || undefined,
        pool5_url: poolForm.pool5_url || undefined,
        pool5_user: poolForm.pool5_user || undefined,
        pool5_password: poolForm.pool5_password || undefined,
      };
      if (editingProfile) {
        const { data } = await usersAPI.updatePoolProfile(editingProfile.id, payload);
        setPoolProfiles(prev => prev.map(p => p.id === editingProfile.id ? data : p));
        toast.success('Pool profile updated.');
      } else {
        const { data } = await usersAPI.createPoolProfile(payload);
        setPoolProfiles(prev => [...prev, data]);
        toast.success('Pool profile saved.');
      }
      resetPoolForm();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save pool profile.');
    }
    setSavingPool(false);
  };

  const handleEditPool = (profile: PoolProfile) => {
    setEditingProfile(profile);
    setPoolForm({
      name: profile.name,
      pool_url: profile.pool_url,
      pool_user: profile.pool_user,
      pool_password: profile.pool_password,
      algorithm_id: profile.algorithm_id?.toString() || '',
      is_default: profile.is_default,
      pool2_url: profile.pool2_url || '',
      pool2_user: profile.pool2_user || '',
      pool2_password: profile.pool2_password || 'x',
      pool3_url: profile.pool3_url || '',
      pool3_user: profile.pool3_user || '',
      pool3_password: profile.pool3_password || 'x',
      pool4_url: profile.pool4_url || '',
      pool4_user: profile.pool4_user || '',
      pool4_password: profile.pool4_password || 'x',
      pool5_url: profile.pool5_url || '',
      pool5_user: profile.pool5_user || '',
      pool5_password: profile.pool5_password || 'x',
    });
    setShowAddPool(true);
  };

  const handleDeletePool = async (id: number) => {
    if (!confirm('Delete this pool profile?')) return;
    try {
      await usersAPI.deletePoolProfile(id);
      setPoolProfiles(prev => prev.filter(p => p.id !== id));
      toast.success('Pool profile deleted.');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete pool profile.');
    }
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

      {/* Pool Profiles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Pool Profiles</CardTitle>
            {!showAddPool && (
              <Button size="sm" onClick={() => setShowAddPool(true)}>+ Add Profile</Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-dark-400 mb-4">
            Save your frequently used mining pool configurations. Select them quickly when renting a rig.
          </p>

          {/* Add / Edit form */}
          {showAddPool && (
            <form onSubmit={handleSavePool} className="bg-dark-800 rounded-xl p-4 mb-4 space-y-3">
              <h3 className="text-sm font-semibold text-white">{editingProfile ? 'Edit Profile' : 'New Profile'}</h3>
              <Input
                label="Profile Name"
                placeholder="e.g. My BTC Pool"
                value={poolForm.name}
                onChange={(e) => setPoolForm(f => ({ ...f, name: e.target.value }))}
                required
              />
              <div>
                <label className="block text-xs text-dark-400 mb-1">Algorithm (optional)</label>
                <select
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  value={poolForm.algorithm_id}
                  onChange={(e) => setPoolForm(f => ({ ...f, algorithm_id: e.target.value }))}
                >
                  <option value="">All Algorithms</option>
                  {algorithms.map(a => (
                    <option key={a.id} value={a.id}>{a.display_name}</option>
                  ))}
                </select>
              </div>
              <Input
                label="Pool URL (Primary)"
                placeholder="stratum+tcp://pool.example.com:3333"
                value={poolForm.pool_url}
                onChange={(e) => setPoolForm(f => ({ ...f, pool_url: e.target.value }))}
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Username / Wallet"
                  placeholder="wallet_address.worker"
                  value={poolForm.pool_user}
                  onChange={(e) => setPoolForm(f => ({ ...f, pool_user: e.target.value }))}
                  required
                />
                <Input
                  label="Password"
                  placeholder="x"
                  value={poolForm.pool_password}
                  onChange={(e) => setPoolForm(f => ({ ...f, pool_password: e.target.value }))}
                />
              </div>

              {/* Backup Pools 2-5 */}
              <details className="border border-dark-700 rounded-lg p-3">
                <summary className="text-xs text-primary-400 cursor-pointer font-medium">Backup Pools (2-5) — Failover</summary>
                <div className="space-y-3 mt-3">
                  {[2, 3, 4, 5].map(n => (
                    <div key={n} className="space-y-1">
                      <p className="text-xs text-dark-400 font-medium">Backup Pool {n}</p>
                      <Input
                        placeholder={`stratum+tcp://backup${n}:port`}
                        value={(poolForm as any)[`pool${n}_url`]}
                        onChange={(e) => setPoolForm(f => ({ ...f, [`pool${n}_url`]: e.target.value }))}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Wallet / Worker"
                          value={(poolForm as any)[`pool${n}_user`]}
                          onChange={(e) => setPoolForm(f => ({ ...f, [`pool${n}_user`]: e.target.value }))}
                        />
                        <Input
                          placeholder="Password (x)"
                          value={(poolForm as any)[`pool${n}_password`]}
                          onChange={(e) => setPoolForm(f => ({ ...f, [`pool${n}_password`]: e.target.value }))}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </details>
              <label className="flex items-center gap-2 text-sm text-dark-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={poolForm.is_default}
                  onChange={(e) => setPoolForm(f => ({ ...f, is_default: e.target.checked }))}
                  className="rounded"
                />
                Set as default
              </label>
              <div className="flex gap-2">
                <Button variant="secondary" type="button" size="sm" onClick={resetPoolForm}>Cancel</Button>
                <Button type="submit" size="sm" loading={savingPool}>
                  {editingProfile ? 'Update' : 'Save'}
                </Button>
              </div>
            </form>
          )}

          {/* Profile list */}
          {poolProfiles.length === 0 ? (
            <p className="text-sm text-dark-500 text-center py-4">No pool profiles saved yet.</p>
          ) : (
            <div className="space-y-2">
              {poolProfiles.map(profile => (
                <div key={profile.id} className="flex items-center justify-between bg-dark-800 rounded-lg p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">{profile.name}</span>
                      {profile.is_default && (
                        <span className="px-1.5 py-0.5 bg-primary-900/50 border border-primary-500/30 text-primary-400 text-xs rounded">default</span>
                      )}
                      {profile.algorithm_name && (
                        <span className="text-xs text-dark-400">{profile.algorithm_name}</span>
                      )}
                    </div>
                    <p className="text-xs text-dark-500 truncate mt-0.5">{profile.pool_url}</p>
                    <p className="text-xs text-dark-600 mt-0.5">
                      {[profile.pool2_url, profile.pool3_url, profile.pool4_url, profile.pool5_url].filter(Boolean).length + 1} pool(s)
                    </p>
                    <p className="text-xs text-dark-500 truncate">{profile.pool_user}</p>
                  </div>
                  <div className="flex gap-1 ml-3 shrink-0">
                    <button
                      onClick={() => handleEditPool(profile)}
                      className="px-2 py-1 text-xs text-dark-400 hover:text-white border border-dark-600 rounded hover:border-dark-400 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeletePool(profile.id)}
                      className="px-2 py-1 text-xs text-red-400 hover:text-red-300 border border-dark-600 rounded hover:border-red-800 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
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
