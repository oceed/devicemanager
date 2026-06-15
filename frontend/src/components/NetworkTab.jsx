import React, { useState, useEffect } from 'react';
import { Network, Server, Settings, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

export default function NetworkTab() {
  const [interfaces, setInterfaces] = useState([]);
  const [selectedIface, setSelectedIface] = useState(null);
  const [method, setMethod] = useState('auto'); // 'auto' (DHCP) or 'manual' (Static)
  const [ipAddress, setIpAddress] = useState('');
  const [gateway, setGateway] = useState('');
  const [dns, setDns] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const fetchInterfaces = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/network/interfaces', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setInterfaces(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterfaces();
  }, []);

  const handleSelectInterface = (iface) => {
    setSelectedIface(iface);
    setStatusMsg({ type: '', text: '' });
    
    // Set initial form states
    if (iface.ip) {
      setMethod('manual');
      setIpAddress(iface.ip);
    } else {
      setMethod('auto');
      setIpAddress('');
    }
    setGateway('');
    setDns('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedIface) return;

    setSubmitting(true);
    setStatusMsg({ type: 'info', text: 'Applying new network configuration. This might momentarily disrupt connection...' });

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/network/configure-ip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          device: selectedIface.device,
          method,
          ip: method === 'manual' ? ipAddress : null,
          gateway: method === 'manual' ? gateway : null,
          dns: method === 'manual' ? dns : null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to apply configurations');
      }

      setStatusMsg({ type: 'success', text: 'Network configuration applied successfully!' });
      fetchInterfaces();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Error occurred while applying network configuration.' });
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Interfaces List */}
      <div className="lg:col-span-1 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Network size={20} className="text-brand-orange" />
          <span>Network Interfaces</span>
        </h2>
        
        <div className="space-y-3">
          {interfaces.map((iface) => {
            const isSelected = selectedIface?.device === iface.device;
            const isConnected = iface.state === 'connected';
            
            return (
              <button
                key={iface.device}
                onClick={() => handleSelectInterface(iface)}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                  isSelected
                    ? 'bg-brand-orange/5 border-brand-orange dark:border-brand-orange shadow-sm'
                    : 'bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800 hover:border-brand-orange/30'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-gray-800 dark:text-zinc-200">{iface.device}</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                    isConnected
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400'
                  }`}>
                    {iface.state}
                  </span>
                </div>
                
                <div className="space-y-1 text-xs text-gray-500 dark:text-zinc-400">
                  <div className="flex justify-between">
                    <span>Type:</span>
                    <span className="font-semibold capitalize text-gray-700 dark:text-zinc-300">{iface.type}</span>
                  </div>
                  {iface.ip && (
                    <div className="flex justify-between">
                      <span>IP Address:</span>
                      <span className="font-semibold font-mono text-gray-700 dark:text-zinc-300">{iface.ip}</span>
                    </div>
                  )}
                  {iface.mac && (
                    <div className="flex justify-between">
                      <span>MAC Address:</span>
                      <span className="font-semibold font-mono text-gray-700 dark:text-zinc-300">{iface.mac}</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
          {interfaces.length === 0 && (
            <div className="p-4 text-center border border-dashed border-gray-200 dark:border-zinc-800 text-gray-400 rounded-xl text-sm">
              No network interfaces found.
            </div>
          )}
        </div>
      </div>

      {/* Configuration Form */}
      <div className="lg:col-span-2">
        {selectedIface ? (
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <Settings size={20} className="text-brand-orange" />
              <span>Configure {selectedIface.device}</span>
            </h2>

            {statusMsg.text && (
              <div className={`p-4 mb-6 rounded-xl flex items-start gap-3 border text-sm ${
                statusMsg.type === 'error'
                  ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400'
                  : statusMsg.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30 text-amber-600 dark:text-amber-400'
              }`}>
                {statusMsg.type === 'error' ? (
                  <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
                )}
                <span>{statusMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Method Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                  IP Assignment Method
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMethod('auto')}
                    className={`py-3 px-4 rounded-xl border text-sm font-semibold text-center transition-all ${
                      method === 'auto'
                        ? 'border-brand-orange bg-brand-orange/5 text-brand-orange shadow-sm'
                        : 'border-gray-200 dark:border-zinc-800 hover:border-gray-300 text-gray-600 dark:text-zinc-400'
                    }`}
                  >
                    Automatic (DHCP)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod('manual')}
                    className={`py-3 px-4 rounded-xl border text-sm font-semibold text-center transition-all ${
                      method === 'manual'
                        ? 'border-brand-orange bg-brand-orange/5 text-brand-orange shadow-sm'
                        : 'border-gray-200 dark:border-zinc-800 hover:border-gray-300 text-gray-600 dark:text-zinc-400'
                    }`}
                  >
                    Static IP (Manual)
                  </button>
                </div>
              </div>

              {/* Static Fields */}
              {method === 'manual' && (
                <div className="space-y-4 border-t border-gray-100 dark:border-zinc-800 pt-4 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                        IP Address & Subnet (e.g. 192.168.1.100/24)
                      </label>
                      <input
                        type="text"
                        required
                        value={ipAddress}
                        onChange={(e) => setIpAddress(e.target.value)}
                        placeholder="192.168.1.100/24"
                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-xl text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                        Default Gateway (e.g. 192.168.1.1)
                      </label>
                      <input
                        type="text"
                        value={gateway}
                        onChange={(e) => setGateway(e.target.value)}
                        placeholder="192.168.1.1"
                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-xl text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                      DNS Servers (comma-separated, e.g. 8.8.8.8, 1.1.1.1)
                    </label>
                    <input
                      type="text"
                      value={dns}
                      onChange={(e) => setDns(e.target.value)}
                      placeholder="8.8.8.8, 1.1.1.1"
                      className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-xl text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange font-mono text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="border-t border-gray-100 dark:border-zinc-800 pt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 bg-brand-orange hover:bg-brand-orange-600 text-white font-semibold rounded-xl text-sm transition-all duration-200 hover:shadow-lg hover:shadow-brand-orange/20 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Server size={16} />
                      <span>Apply Network Configuration</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="h-full bg-white dark:bg-zinc-900 border border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
            <Network size={48} className="text-gray-300 dark:text-zinc-700 mb-4" />
            <h3 className="text-base font-bold text-gray-700 dark:text-zinc-400 mb-1">No Interface Selected</h3>
            <p className="text-sm text-gray-400 dark:text-zinc-500 max-w-sm">
              Please select a network interface from the list on the left to configure IP addresses, subnet routing, and domain servers.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
