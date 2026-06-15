import React, { useState, useEffect } from 'react';
import { Radio, ShieldAlert, Key, User, ToggleLeft, ToggleRight, Loader2, CheckCircle2 } from 'lucide-react';

export default function ApTab() {
  const [apStatus, setApStatus] = useState(null);
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const fetchApStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/network/ap/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setApStatus(data);
      if (data) {
        setSsid(data.ssid || 'OrangePi-Hotspot');
        setPassword(data.password || 'password123');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApStatus();
  }, []);

  const handleToggleAp = async (targetActive) => {
    setSubmitting(true);
    setStatusMsg({ type: 'info', text: `${targetActive ? 'Starting' : 'Stopping'} Access Point...` });
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/network/ap/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          active: targetActive,
          ssid,
          password,
          interface: apStatus?.interface || 'wlan0'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to toggle Hotspot');
      }

      setStatusMsg({
        type: 'success',
        text: `Access Point ${targetActive ? 'activated' : 'deactivated'} successfully!`
      });
      fetchApStatus();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Error occurred during Hotspot toggle.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!ssid || password.length < 8) {
      setStatusMsg({ type: 'error', text: 'Password must be at least 8 characters long.' });
      return;
    }
    // Save settings by pushing active status to current active status
    handleToggleAp(apStatus?.active ?? false);
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-brand-orange" />
      </div>
    );
  }

  const isActive = apStatus?.active ?? false;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Settings Panel */}
      <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <Radio size={20} className="text-brand-orange" />
          <span>Access Point (AP) Settings</span>
        </h2>

        {statusMsg.text && (
          <div className={`p-4 mb-6 rounded-xl flex items-start gap-3 border text-sm ${
            statusMsg.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400'
              : statusMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/30 text-blue-600 dark:text-blue-400'
          }`}>
            {statusMsg.type === 'error' ? (
              <ShieldAlert size={18} className="flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1">
              <User size={14} className="text-gray-400 dark:text-zinc-500" />
              <span>Hotspot SSID (Network Name)</span>
            </label>
            <input
              type="text"
              required
              value={ssid}
              onChange={(e) => setSsid(e.target.value)}
              placeholder="OrangePi-Hotspot"
              className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-xl text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange text-sm font-semibold"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1">
              <Key size={14} className="text-gray-400 dark:text-zinc-500" />
              <span>WPA2 Security Key (Password)</span>
            </label>
            <input
              type="text"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password123"
              className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-xl text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange text-sm font-mono"
            />
          </div>

          <div className="border-t border-gray-100 dark:border-zinc-800 pt-6 flex justify-between items-center gap-3">
            <div className="text-xs text-gray-400 dark:text-zinc-500 max-w-sm">
              Updating these parameters will restart the AP connection profile if it is currently running.
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 border border-gray-300 dark:border-zinc-800 rounded-xl text-sm font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all"
            >
              Update Config
            </button>
          </div>
        </form>
      </div>

      {/* AP Control Panel */}
      <div className="lg:col-span-1 space-y-6">
        {/* Status card */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">Hotspot Control</h3>
            
            <div className="space-y-4 text-sm mb-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-zinc-400 font-medium">Status</span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                  isActive
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 animate-pulse-slow'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400'
                }`}>
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              {isActive && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-zinc-400">Gateway IP</span>
                    <span className="font-semibold font-mono text-gray-700 dark:text-zinc-300">{apStatus.ip}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-zinc-400">Interface</span>
                    <span className="font-semibold font-mono text-gray-700 dark:text-zinc-300">{apStatus.interface}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-zinc-800 pt-6">
            <button
              onClick={() => handleToggleAp(!isActive)}
              disabled={submitting}
              className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                isActive
                  ? 'bg-red-500 hover:bg-red-600 text-white hover:shadow-lg hover:shadow-red-500/20'
                  : 'bg-brand-orange hover:bg-brand-orange-600 text-white hover:shadow-lg hover:shadow-brand-orange/20'
              }`}
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : isActive ? (
                <ToggleRight size={20} />
              ) : (
                <ToggleLeft size={20} />
              )}
              <span>{isActive ? 'Deactivate Hotspot' : 'Activate Hotspot'}</span>
            </button>
          </div>
        </div>

        {/* Warning card */}
        <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/20 rounded-2xl p-5 flex gap-3 text-amber-700 dark:text-amber-400 text-xs leading-relaxed">
          <ShieldAlert size={20} className="flex-shrink-0 text-amber-500 dark:text-amber-400 mt-0.5" />
          <div>
            <h4 className="font-bold mb-1">Coexistence Notice</h4>
            Activating Wi-Fi Hotspot (AP Mode) forces the Orange Pi's wireless card to broadcast signals. Depending on the single-channel limitation of your device's Wi-Fi adapter, this **may disconnect the Wi-Fi Client connection** to your local internet. Wire connection via `eth0` is recommended during AP operations.
          </div>
        </div>
      </div>
    </div>
  );
}
