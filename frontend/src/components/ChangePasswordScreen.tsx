import React, { useState } from 'react';
import { Lock, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { UserSession } from '../App';

interface ChangePasswordScreenProps {
  session: UserSession;
  onPasswordChanged: () => void;
  onLogout: () => void;
}

export default function ChangePasswordScreen({ session, onPasswordChanged, onLogout }: ChangePasswordScreenProps) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Password strength check
  const hasMinLength = newPassword.length >= 8;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
  const isStrong = hasMinLength && hasUpperCase && hasNumber && hasSpecial;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (!isStrong) {
      setError('Password does not meet all security requirements');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5001/api/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to change password');

      onPasswordChanged();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-6 bg-amber-50 border-b border-amber-100 flex items-start gap-4">
          <div className="bg-amber-100 p-2 rounded-full text-amber-600 mt-1">
            <Lock size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Action Required</h2>
            <p className="text-sm text-gray-600 mt-1">
              For security reasons, you must change your default password before accessing the system.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex gap-2 items-start">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            
            {/* Password Strength Indicator */}
            <div className="mt-3 bg-gray-50 p-3 rounded-lg border border-gray-100 text-xs space-y-2">
              <p className="font-semibold text-gray-700">Password Requirements:</p>
              <ul className="space-y-1">
                <li className={`flex items-center gap-2 ${hasMinLength ? 'text-green-600' : 'text-gray-500'}`}>
                  {hasMinLength ? <CheckCircle size={14} /> : <div className="w-3.5 h-3.5 border rounded-full" />}
                  At least 8 characters
                </li>
                <li className={`flex items-center gap-2 ${hasUpperCase ? 'text-green-600' : 'text-gray-500'}`}>
                  {hasUpperCase ? <CheckCircle size={14} /> : <div className="w-3.5 h-3.5 border rounded-full" />}
                  One uppercase letter
                </li>
                <li className={`flex items-center gap-2 ${hasNumber ? 'text-green-600' : 'text-gray-500'}`}>
                  {hasNumber ? <CheckCircle size={14} /> : <div className="w-3.5 h-3.5 border rounded-full" />}
                  One number
                </li>
                <li className={`flex items-center gap-2 ${hasSpecial ? 'text-green-600' : 'text-gray-500'}`}>
                  {hasSpecial ? <CheckCircle size={14} /> : <div className="w-3.5 h-3.5 border rounded-full" />}
                  One special character
                </li>
              </ul>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onLogout}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
            >
              Cancel & Logout
            </button>
            <button
              type="submit"
              disabled={loading || !isStrong || !oldPassword || !confirmPassword}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? 'Updating...' : 'Update Password'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
