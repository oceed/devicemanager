import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  ToggleLeft, 
  ToggleRight, 
  Trash2, 
  Plus, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Server,
  Globe,
  ExternalLink,
  Key,
  Eye,
  EyeOff,
  UserCheck,
  Smartphone,
  Laptop,
  Monitor,
  Activity,
  Power
} from 'lucide-react';

export default function VpnTab() {
  const [activeSubTab, setActiveSubTab] = useState('vpn'); // 'vpn' or 'tailscale'
  const [vpns, setVpns] = useState([]);
  const [vpnName, setVpnName] = useState('');
  const [configContent, setConfigContent] = useState('');
  const [vpnType, setVpnType] = useState('wireguard');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  // Tailscale State
  const [tailscale, setTailscale] = useState({
    installed: false,
    service_active: false,
    active: false,
    ip: '',
    ip6: '',
    node_name: '',
    login_name: '',
    login_url: '',
    status: 'Not Installed',
    peers: []
  });
  const [tailscaleSubmitting, setTailscaleSubmitting] = useState(false);
  
  // Tailscale Form State
  const [authKey, setAuthKey] = useState('');
  const [showAuthKey, setShowAuthKey] = useState(false);
  const [advertiseExitNode, setAdvertiseExitNode] = useState(false);
  const [acceptRoutes, setAcceptRoutes] = useState(false);

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

  const handleConnectTailscale = async (e) => {
    if (e) e.preventDefault();
    setTailscaleSubmitting(true);
    setStatusMsg({ type: 'info', text: 'Connecting Tailscale...' });
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/network/tailscale/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          authkey: authKey,
          advertise_exit_node: advertiseExitNode,
          accept_routes: acceptRoutes
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to connect Tailscale');
      }
      
      if (data.needs_login) {
        setStatusMsg({ 
          type: 'info', 
          text: `Tailscale login required. Please authorize the device.` 
        });
      } else {
        setStatusMsg({ type: 'success', text: data.message || 'Tailscale connected successfully.' });
        setAuthKey('');
      }
      fetchTailscale();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setTailscaleSubmitting(false);
    }
  };

  const handleDisconnectTailscale = async () => {
    setTailscaleSubmitting(true);
    setStatusMsg({ type: 'info', text: 'Disconnecting Tailscale...' });
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/network/tailscale/disconnect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to disconnect Tailscale');
      }
      
      setStatusMsg({ type: 'success', text: data.message || 'Tailscale disconnected successfully.' });
      fetchTailscale();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setTailscaleSubmitting(false);
    }
  };

  const handleToggleTailscaleService = async () => {
    setTailscaleSubmitting(true);
    const action = tailscale.service_active ? 'stopping' : 'starting';
    setStatusMsg({ type: 'info', text: `Tailscale daemon service is ${action}...` });
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/network/tailscale/service', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          active: !tailscale.service_active
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to toggle Tailscale service');
      }
      
      setStatusMsg({ type: 'success', text: data.message || 'Tailscale daemon status updated.' });
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

  const getOsIcon = (os) => {
    const normalized = (os || '').toLowerCase();
    if (normalized.includes('win')) return <Monitor size={14} className="text-blue-500" />;
    if (normalized.includes('linux')) return <Server size={14} className="text-amber-500" />;
    if (normalized.includes('mac') || normalized.includes('darwin')) return <Laptop size={14} className="text-gray-500" />;
    if (normalized.includes('ios') || normalized.includes('android')) return <Smartphone size={14} className="text-emerald-500" />;
    return <Globe size={14} className="text-zinc-400" />;
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
      {/* Sub-tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-zinc-800 pb-px mb-6 gap-2">
        <button
          onClick={() => setActiveSubTab('vpn')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-sm transition-all duration-200 ${
            activeSubTab === 'vpn'
              ? 'border-brand-orange text-brand-orange'
              : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Shield size={16} />
          <span>WireGuard & OpenVPN</span>
        </button>
        <button
          onClick={() => setActiveSubTab('tailscale')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-sm transition-all duration-200 ${
            activeSubTab === 'tailscale'
              ? 'border-brand-orange text-brand-orange'
              : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Server size={16} />
          <span>Tailscale Mesh VPN</span>
        </button>
      </div>

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

      {activeSubTab === 'vpn' ? (
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
          </div>
        </div>
      ) : (
        /* Tailscale Mesh VPN View */
        <div className="space-y-6">
          {!tailscale.installed ? (
            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-8 text-center shadow-sm">
              <AlertCircle size={40} className="text-red-500 mx-auto mb-4" />
              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Tailscale Not Detected</h3>
              <p className="text-sm text-gray-400 dark:text-zinc-500 max-w-md mx-auto leading-relaxed">
                Tailscale is not detected on your Orange Pi device. Please install it on the host operating system to manage secure peer-to-peer mesh networks.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left/Middle Columns: Status and Peers */}
              <div className="lg:col-span-2 space-y-6">
                {/* Status Card */}
                <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                      <Activity size={18} className="text-brand-orange" />
                      <span>Node Connection Status</span>
                    </h3>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 dark:text-zinc-500 font-semibold">Service Daemon</span>
                      <button
                        onClick={handleToggleTailscaleService}
                        disabled={tailscaleSubmitting}
                        className={`px-3 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 transition-all ${
                          tailscale.service_active
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400'
                            : 'border-red-200 bg-red-50 dark:bg-red-950/20 text-red-500'
                        }`}
                      >
                        <Power size={12} />
                        <span>{tailscale.service_active ? 'ACTIVE' : 'INACTIVE'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-gray-100 dark:border-zinc-800">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-gray-50 dark:border-zinc-800/40">
                        <span className="text-sm font-semibold text-gray-400 dark:text-zinc-500">Connection status</span>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${
                          tailscale.status === 'Connected'
                            ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400'
                            : tailscale.status === 'Needs Login'
                            ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                        }`}>
                          {tailscale.status}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center pb-2 border-b border-gray-50 dark:border-zinc-800/40">
                        <span className="text-sm font-semibold text-gray-400 dark:text-zinc-500">Node Name</span>
                        <span className="text-sm font-bold text-gray-800 dark:text-zinc-200">
                          {tailscale.node_name || '-'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pb-2 border-b border-gray-50 dark:border-zinc-800/40">
                        <span className="text-sm font-semibold text-gray-400 dark:text-zinc-500">Logged Account</span>
                        <span className="text-sm font-bold text-gray-800 dark:text-zinc-200 flex items-center gap-1.5">
                          {tailscale.login_name ? (
                            <>
                              <UserCheck size={14} className="text-brand-orange" />
                              <span className="truncate max-w-[150px]">{tailscale.login_name}</span>
                            </>
                          ) : (
                            <span>-</span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-gray-50 dark:border-zinc-800/40">
                        <span className="text-sm font-semibold text-gray-400 dark:text-zinc-500">IPv4 Address</span>
                        <span className="text-sm font-bold font-mono text-gray-800 dark:text-zinc-200">
                          {tailscale.ip || '-'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pb-2 border-b border-gray-50 dark:border-zinc-800/40">
                        <span className="text-sm font-semibold text-gray-400 dark:text-zinc-500">IPv6 Address</span>
                        <span className="text-sm font-bold font-mono text-gray-800 dark:text-zinc-200 truncate max-w-[200px]" title={tailscale.ip6}>
                          {tailscale.ip6 || '-'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pb-2 border-b border-gray-50 dark:border-zinc-800/40">
                        <span className="text-sm font-semibold text-gray-400 dark:text-zinc-500">Interface</span>
                        <span className="text-sm font-bold font-mono text-gray-800 dark:text-zinc-200">
                          {tailscale.active ? 'tailscale0' : '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 flex flex-wrap gap-4">
                    {tailscale.status === 'Needs Login' && tailscale.login_url && (
                      <a
                        href={tailscale.login_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-5 py-2.5 bg-brand-orange hover:bg-brand-orange-600 text-white font-bold rounded-xl text-sm transition-all hover:shadow-md hover:shadow-brand-orange/15 flex items-center gap-1.5"
                      >
                        <ExternalLink size={14} />
                        <span>Authenticate Node (Open Login URL)</span>
                      </a>
                    )}

                    {tailscale.active && (
                      <button
                        onClick={handleDisconnectTailscale}
                        disabled={tailscaleSubmitting}
                        className="px-5 py-2.5 border border-red-200 hover:bg-red-50 dark:border-red-950/20 dark:hover:bg-red-950/30 text-red-500 font-bold rounded-xl text-sm transition-all flex items-center gap-1.5"
                      >
                        {tailscaleSubmitting ? <Loader2 size={14} className="animate-spin" /> : null}
                        <span>Disconnect Node</span>
                      </button>
                    )}

                    {tailscale.status === 'Disconnected' && (
                      <button
                        onClick={() => handleConnectTailscale()}
                        disabled={tailscaleSubmitting}
                        className="px-5 py-2.5 bg-brand-orange hover:bg-brand-orange-600 text-white font-bold rounded-xl text-sm transition-all hover:shadow-md hover:shadow-brand-orange/15 flex items-center gap-1.5"
                      >
                        {tailscaleSubmitting ? <Loader2 size={14} className="animate-spin" /> : null}
                        <span>Connect Node</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Active Peers Card */}
                {tailscale.active && (
                  <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <Globe size={18} className="text-brand-orange" />
                      <span>Connected Tailnet Peers ({tailscale.peers?.length || 0})</span>
                    </h3>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-zinc-800 text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase">
                            <th className="py-3 px-2">Device</th>
                            <th className="py-3 px-2">Tailscale IP</th>
                            <th className="py-3 px-2">OS</th>
                            <th className="py-3 px-2">User / Owner</th>
                            <th className="py-3 px-2 text-right">Activity</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-zinc-800/50">
                          {tailscale.peers?.map((peer) => (
                            <tr key={peer.ip} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                              <td className="py-3.5 px-2 font-bold text-gray-900 dark:text-white">
                                {peer.node_name}
                              </td>
                              <td className="py-3.5 px-2 font-mono text-gray-600 dark:text-zinc-300 text-xs">
                                {peer.ip}
                              </td>
                              <td className="py-3.5 px-2">
                                <div className="flex items-center gap-1.5 capitalize text-xs">
                                  {getOsIcon(peer.os)}
                                  <span className="text-gray-600 dark:text-zinc-300">{peer.os || 'unknown'}</span>
                                </div>
                              </td>
                              <td className="py-3.5 px-2 text-gray-500 dark:text-zinc-400 text-xs truncate max-w-[150px]" title={peer.user}>
                                {peer.user || '-'}
                              </td>
                              <td className="py-3.5 px-2 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <span className={`w-2.5 h-2.5 rounded-full ${
                                    peer.online
                                      ? 'bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50'
                                      : 'bg-zinc-300 dark:bg-zinc-700'
                                  }`} />
                                  <span className="text-[10px] uppercase font-bold text-gray-400">
                                    {peer.online ? 'Online' : 'Offline'}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {(!tailscale.peers || tailscale.peers.length === 0) && (
                            <tr>
                              <td colSpan="5" className="py-8 text-center text-gray-400 italic">
                                No other active nodes detected on your Tailscale network.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Connection Form and Configuration Guide */}
              <div className="lg:col-span-1 space-y-6">
                {/* Join Network Form */}
                {(!tailscale.active || tailscale.status === 'Needs Login') && (
                  <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-base text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <Key size={16} className="text-brand-orange" />
                      <span>Join VPN Network</span>
                    </h3>

                    <form onSubmit={handleConnectTailscale} className="space-y-4">
                      <div className="relative">
                        <label className="block text-xs font-semibold text-gray-500 dark:text-zinc-400 mb-1">
                          Auth Key (Optional)
                        </label>
                        <div className="relative">
                          <input
                            type={showAuthKey ? 'text' : 'password'}
                            value={authKey}
                            onChange={(e) => setAuthKey(e.target.value)}
                            placeholder="tskey-auth-..."
                            className="w-full pl-4 pr-10 py-2 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-xl text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange text-sm font-semibold font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowAuthKey(!showAuthKey)}
                            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300"
                          >
                            {showAuthKey ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1 italic">
                          If not specified, we'll start an interactive login.
                        </p>
                      </div>

                      <div className="space-y-3 pt-2 border-t border-gray-50 dark:border-zinc-800/50">
                        <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                          Advanced Options
                        </span>

                        <label className="flex items-center gap-2.5 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={advertiseExitNode}
                            onChange={(e) => setAdvertiseExitNode(e.target.checked)}
                            className="rounded border-gray-300 dark:border-zinc-800 text-brand-orange focus:ring-brand-orange/20"
                          />
                          <div className="text-xs">
                            <span className="font-semibold text-gray-700 dark:text-zinc-300 group-hover:text-gray-950 dark:group-hover:text-white transition-colors">
                              Advertise Exit Node
                            </span>
                            <p className="text-[10px] text-gray-400 dark:text-zinc-500 italic mt-0.5">
                              Route other nodes' internet traffic through this device.
                            </p>
                          </div>
                        </label>

                        <label className="flex items-center gap-2.5 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={acceptRoutes}
                            onChange={(e) => setAcceptRoutes(e.target.checked)}
                            className="rounded border-gray-300 dark:border-zinc-800 text-brand-orange focus:ring-brand-orange/20"
                          />
                          <div className="text-xs">
                            <span className="font-semibold text-gray-700 dark:text-zinc-300 group-hover:text-gray-950 dark:group-hover:text-white transition-colors">
                              Accept Routes
                            </span>
                            <p className="text-[10px] text-gray-400 dark:text-zinc-500 italic mt-0.5">
                              Accept subnet routes advertised by other peer nodes.
                            </p>
                          </div>
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={tailscaleSubmitting || !tailscale.service_active}
                        className="w-full mt-2 py-2.5 bg-brand-orange hover:bg-brand-orange-600 text-white font-bold rounded-xl text-sm transition-all hover:shadow-md hover:shadow-brand-orange/15 flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {tailscaleSubmitting ? <Loader2 size={14} className="animate-spin" /> : null}
                        <span>Connect Tailscale</span>
                      </button>
                      
                      {!tailscale.service_active && (
                        <p className="text-[10px] text-red-500 text-center font-semibold italic">
                          Start the service daemon to connect.
                        </p>
                      )}
                    </form>
                  </div>
                )}

                {/* Configuration Reference Card */}
                <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider">
                    Tailscale Reference
                  </h3>
                  
                  <div className="text-xs text-gray-500 dark:text-zinc-400 space-y-3 leading-relaxed">
                    <p>
                      Tailscale is a zero-configuration mesh VPN that makes it easy to connect devices securely over encrypted WireGuard links.
                    </p>
                    <div className="p-3 bg-gray-50 dark:bg-zinc-800/40 rounded-xl space-y-2">
                      <span className="font-bold text-gray-700 dark:text-zinc-300 block">How to get an Auth Key:</span>
                      <ol className="list-decimal list-inside space-y-1 text-[11px]">
                        <li>Log in to your Tailscale Admin Console.</li>
                        <li>Navigate to <b>Settings</b> &rarr; <b>Keys</b>.</li>
                        <li>Click <b>Generate auth key...</b></li>
                        <li>Copy the key and paste it here.</li>
                      </ol>
                    </div>
                    
                    {tailscale.active && advertiseExitNode && (
                      <div className="p-3 border border-amber-200/50 bg-amber-50/20 dark:border-amber-900/30 dark:bg-amber-950/10 rounded-xl space-y-1.5">
                        <span className="font-bold text-amber-800 dark:text-amber-400 block flex items-center gap-1">
                          <AlertCircle size={12} />
                          <span>Exit Node Approval Required</span>
                        </span>
                        <p className="text-[11px] leading-snug">
                          Since you've advertised this device as an exit node, you must go to your <b>Tailscale Admin Console</b>, click on this node, navigate to <b>Route Settings</b>, and toggle on <b>Use as exit node</b>.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
