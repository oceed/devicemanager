import React, { useState, useEffect } from 'react';
import { ShieldCheck, ToggleLeft, ToggleRight, Trash2, Plus, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function VpnTab() {
  const [vpns, setVpns] = useState([]);
  const [vpnName, setVpnName] = useState('');
  const [configContent, setConfigContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const fetchVpns = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/network/vpn', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setVpns(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVpns();
  }, []);

  const handleToggleVpn = async (name, currentActive) => {
    setSubmitting(true);
    setStatusMsg({ type: 'info', text: `${currentActive ? 'Disconnecting' : 'Connecting'} VPN profile ${name}...` });
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/network/vpn/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          active: !currentActive
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to toggle VPN');
      }

      setStatusMsg({
        type: 'success',
        text: `VPN '${name}' ${!currentActive ? 'connected' : 'disconnected'} successfully!`
      });
      fetchVpns();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Error executing VPN state change.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportVpn = async (e) => {
    e.preventDefault();
    if (!vpnName || !configContent) {
      setStatusMsg({ type: 'error', text: 'Please fill in both the profile name and WireGuard config content.' });
      return;
    }

    setImporting(true);
    setStatusMsg({ type: 'info', text: 'Importing WireGuard profile...' });
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/network/vpn/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: vpnName.replace(/\s+/g, '-'), // remove spaces
          config_content: configContent
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to import config');
      }

      setStatusMsg({ type: 'success', text: `WireGuard VPN profile '${vpnName}' imported successfully!` });
      setVpnName('');
      setConfigContent('');
      fetchVpns();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Error occurred while importing configuration.' });
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteVpn = async (name) => {
    if (!confirm(`Are you sure you want to delete the VPN profile '${name}'?`)) return;

    setSubmitting(true);
    setStatusMsg({ type: 'info', text: `Deleting VPN profile '${name}'...` });
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/network/vpn/delete/${name}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to delete profile');
      }

      setStatusMsg({ type: 'success', text: `VPN profile '${name}' deleted.` });
      fetchVpns();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Error deleting VPN profile.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-brand-orange" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {statusMsg.text && (
        <div className={`p-4 rounded-xl flex items-start gap-3 border text-sm animate-in fade-in duration-200 ${
          statusMsg.type === 'error'
            ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400'
            : statusMsg.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400'
            : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/30 text-blue-600 dark:text-blue-400'
        }`}>
          {statusMsg.type === 'error' ? (
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configured VPNs List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldCheck size={20} className="text-brand-orange" />
            <span>Configured VPN Profiles</span>
          </h2>

          <div className="space-y-3">
            {vpns.map((vpn) => (
              <div
                key={vpn.name}
                className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-4 rounded-xl flex items-center justify-between shadow-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800 dark:text-zinc-200">{vpn.name}</span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded">
                      {vpn.type}
                    </span>
                  </div>
                  {vpn.active && vpn.ip && (
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold font-mono flex items-center gap-1">
                      <span>Assigned IP:</span>
                      <span>{vpn.ip}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggleVpn(vpn.name, vpn.active)}
                    disabled={submitting}
                    className={`p-1.5 rounded-lg border transition-all ${
                      vpn.active
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400'
                        : 'border-gray-200 dark:border-zinc-800 hover:border-gray-300 text-gray-400 dark:text-zinc-500'
                    }`}
                    title={vpn.active ? 'Disconnect VPN' : 'Connect VPN'}
                  >
                    {vpn.active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  </button>
                  
                  <button
                    onClick={() => handleDeleteVpn(vpn.name)}
                    disabled={submitting}
                    className="p-2 border border-red-100 hover:bg-red-50 dark:border-red-950/20 dark:hover:bg-red-950/30 text-red-500 rounded-lg transition-all"
                    title="Delete VPN Profile"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}

            {vpns.length === 0 && (
              <div className="p-8 text-center border border-dashed border-gray-200 dark:border-zinc-800 text-gray-400 rounded-xl text-sm">
                No VPN connections configured on this device.
              </div>
            )}
          </div>
        </div>

        {/* Import WireGuard Profile */}
        <div className="lg:col-span-1 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Plus size={16} className="text-brand-orange" />
            <span>Import WireGuard VPN</span>
          </h2>

          <form onSubmit={handleImportVpn} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-zinc-400 mb-1">
                Profile Connection Name
              </label>
              <input
                type="text"
                required
                value={vpnName}
                onChange={(e) => setVpnName(e.target.value)}
                placeholder="office-wg"
                className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-xl text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
                <FileText size={12} />
                <span>Configuration Text (wg0.conf)</span>
              </label>
              <textarea
                required
                rows={6}
                value={configContent}
                onChange={(e) => setConfigContent(e.target.value)}
                placeholder="[Interface]&#10;PrivateKey = ...&#10;Address = ...&#10;&#10;[Peer]&#10;PublicKey = ...&#10;Endpoint = ..."
                className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-xl text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange text-xs font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={importing}
              className="w-full py-2.5 bg-brand-orange hover:bg-brand-orange-600 text-white font-semibold rounded-xl text-sm transition-all hover:shadow-md hover:shadow-brand-orange/15 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {importing ? <Loader2 size={14} className="animate-spin" /> : null}
              <span>Import WG Profile</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
