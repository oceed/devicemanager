import React, { useState, useEffect } from 'react';
import { Shield, ShieldCheck, ToggleLeft, ToggleRight, Trash2, Plus, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function VpnTab() {
  const [vpns, setVpns] = useState([]);
  const [vpnName, setVpnName] = useState('');
  const [configContent, setConfigContent] = useState('');
  const [vpnType, setVpnType] = useState('wireguard');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const [tailscale, setTailscale] = useState({
    installed: false,
    active: false,
    ip: '',
    node_name: '',
    status: 'Not Installed'
  });
  const [tailscaleSubmitting, setTailscaleSubmitting] = useState(false);

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

  const fetchTailscale = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/network/tailscale', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data && !data.detail) {
        setTailscale(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchVpns();
    fetchTailscale();
    const interval = setInterval(fetchTailscale, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleTailscale = async () => {
    setTailscaleSubmitting(true);
    setStatusMsg({ type: 'info', text: `${tailscale.active ? 'Disconnecting' : 'Connecting'} Tailscale...` });
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/network/tailscale/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          active: !tailscale.active
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to toggle Tailscale');
      }
      setStatusMsg({ type: 'success', text: data.message || 'Tailscale status updated.' });
      fetchTailscale();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setTailscaleSubmitting(false);
    }
  };

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
      setStatusMsg({ type: 'error', text: 'Please fill in both the profile name and configuration content.' });
      return;
    }

    setImporting(true);
    setStatusMsg({ type: 'info', text: `Importing ${vpnType === 'wireguard' ? 'WireGuard' : 'OpenVPN'} profile...` });
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
          config_content: configContent,
          vpn_type: vpnType
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to import config');
      }

      setStatusMsg({ type: 'success', text: `${vpnType === 'wireguard' ? 'WireGuard' : 'OpenVPN'} VPN profile '${vpnName}' imported successfully!` });
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

        <div className="lg:col-span-1 space-y-6">
          {/* Import VPN Profile */}
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Plus size={16} className="text-brand-orange" />
              <span>Import VPN Connection</span>
            </h2>

            <form onSubmit={handleImportVpn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-zinc-400 mb-1">
                  VPN Protocol Type
                </label>
                <select
                  value={vpnType}
                  onChange={(e) => setVpnType(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900/50 border border-gray-300 dark:border-zinc-800 rounded-xl text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange text-sm font-semibold"
                >
                  <option value="wireguard">WireGuard (.conf)</option>
                  <option value="openvpn">OpenVPN (.ovpn)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-zinc-400 mb-1">
                  Profile Connection ID Name
                </label>
                <input
                  type="text"
                  required
                  value={vpnName}
                  onChange={(e) => setVpnName(e.target.value)}
                  placeholder={vpnType === 'wireguard' ? 'office-wg' : 'office-ovpn'}
                  className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-xl text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
                  <FileText size={12} />
                  <span>Configuration Text ({vpnType === 'wireguard' ? 'wg0.conf' : 'client.ovpn'})</span>
                </label>
                <textarea
                  required
                  rows={6}
                  value={configContent}
                  onChange={(e) => setConfigContent(e.target.value)}
                  placeholder={
                    vpnType === 'wireguard'
                      ? "[Interface]\nPrivateKey = ...\nAddress = ...\n\n[Peer]\nPublicKey = ...\nEndpoint = ..."
                      : "client\ndev tun\nproto udp\nremote 1.2.3.4 1194\nresolv-retry infinite\n..."
                  }
                  className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-xl text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange text-xs font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={importing}
                className="w-full py-2.5 bg-brand-orange hover:bg-brand-orange-600 text-white font-semibold rounded-xl text-sm transition-all hover:shadow-md hover:shadow-brand-orange/15 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {importing ? <Loader2 size={14} className="animate-spin" /> : null}
                <span>Import {vpnType === 'wireguard' ? 'WG' : 'OpenVPN'} Profile</span>
              </button>
            </form>
          </div>

          {/* Tailscale Section */}
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Shield size={16} className="text-brand-orange" />
              <span>Tailscale Mesh VPN</span>
            </h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-gray-50 dark:border-zinc-800/50">
                <span className="text-xs font-semibold text-gray-400 dark:text-zinc-500">Status</span>
                <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${
                  tailscale.status === 'Connected'
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400'
                    : tailscale.status === 'Not Installed'
                    ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                }`}>
                  {tailscale.status}
                </span>
              </div>

              {tailscale.installed && tailscale.active && (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-gray-50 dark:border-zinc-800/50 pb-2">
                    <span className="text-gray-400 dark:text-zinc-500">Node Name:</span>
                    <span className="font-semibold text-gray-800 dark:text-zinc-200">{tailscale.node_name}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-50 dark:border-zinc-800/50 pb-2">
                    <span className="text-gray-400 dark:text-zinc-500">Tailscale IP:</span>
                    <span className="font-semibold font-mono text-gray-800 dark:text-zinc-200">{tailscale.ip}</span>
                  </div>
                </div>
              )}

              {tailscale.installed ? (
                <button
                  onClick={handleToggleTailscale}
                  disabled={tailscaleSubmitting}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    tailscale.active
                      ? 'border border-red-200 hover:bg-red-50 dark:border-red-950/20 dark:hover:bg-red-950/30 text-red-500'
                      : 'bg-brand-orange hover:bg-brand-orange-600 text-white hover:shadow-md hover:shadow-brand-orange/15'
                  }`}
                >
                  {tailscaleSubmitting ? <Loader2 size={14} className="animate-spin" /> : null}
                  <span>{tailscale.active ? 'Disconnect Tailscale' : 'Connect Tailscale'}</span>
                </button>
              ) : (
                <p className="text-[10px] text-gray-400 dark:text-zinc-500 italic leading-snug">
                  Tailscale is not detected on the device. Install it to manage mesh networks remotely.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
