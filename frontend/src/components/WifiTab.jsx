import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, Key, Shield, ShieldCheck, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export default function WifiTab() {
  const [networks, setNetworks] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [password, setPassword] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const scanWifi = async () => {
    setScanning(true);
    setStatusMsg({ type: '', text: '' });
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/network/wifi/scan', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setNetworks(data.networks || []);
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Failed to scan Wi-Fi networks. Ensure Wi-Fi is enabled on the device.' });
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    scanWifi();
  }, []);

  const handleConnect = async (e) => {
    e.preventDefault();
    if (!selectedNetwork) return;

    setConnecting(true);
    setStatusMsg({ type: 'info', text: `Connecting to ${selectedNetwork.ssid}...` });

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/network/wifi/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ssid: selectedNetwork.ssid,
          password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Connection failed');
      }

      setStatusMsg({ type: 'success', text: `Successfully connected to Wi-Fi network: ${selectedNetwork.ssid}` });
      setSelectedNetwork(null);
      setPassword('');
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || `Failed to connect to ${selectedNetwork.ssid}` });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setConnecting(true);
    setStatusMsg({ type: 'info', text: 'Disconnecting from Wi-Fi...' });
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/network/wifi/disconnect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Disconnection failed');
      }
      setStatusMsg({ type: 'success', text: 'Wi-Fi interface disconnected successfully.' });
      setSelectedNetwork(null);
      scanWifi();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to disconnect Wi-Fi' });
    } finally {
      setConnecting(false);
    }
  };

  // Icon depending on signal strength
  const getSignalIcon = (signal) => {
    return <Wifi size={18} className={signal > 75 ? 'text-emerald-500' : signal > 45 ? 'text-amber-500' : 'text-red-500'} />;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Wifi size={20} className="text-brand-orange" />
          <span>Wi-Fi Client Connection</span>
        </h2>
        <button
          onClick={scanWifi}
          disabled={scanning}
          className="py-2 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw size={14} className={scanning ? 'animate-spin' : ''} />
          <span>{scanning ? 'Scanning...' : 'Scan Networks'}</span>
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

      {/* Grid: Networks list & connect pane */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Networks List */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
            {networks.map((net, idx) => {
              const isSelected = selectedNetwork?.ssid === net.ssid;
              const hasSecurity = net.security && net.security !== 'None';
              
              return (
                <div
                  key={net.ssid + idx}
                  onClick={() => {
                    setSelectedNetwork(net);
                    setStatusMsg({ type: '', text: '' });
                  }}
                  className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? 'border-brand-orange bg-brand-orange/5 glow-orange'
                      : 'border-gray-100 dark:border-zinc-800 hover:border-brand-orange/30 bg-gray-50/50 dark:bg-zinc-900/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {getSignalIcon(net.signal)}
                    <div>
                      <h4 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">{net.ssid}</h4>
                      <p className="text-xs text-gray-400 dark:text-zinc-500 font-mono mt-0.5">{net.bssid}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold font-mono text-gray-500 dark:text-zinc-400">
                      {net.signal}%
                    </span>
                    {net.connected ? (
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">Connected</span>
                    ) : hasSecurity ? (
                      <Shield size={14} className="text-gray-400 dark:text-zinc-500" title={net.security} />
                    ) : (
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded font-bold uppercase">Open</span>
                    )}
                  </div>
                </div>
              );
            })}
            
            {networks.length === 0 && !scanning && (
              <div className="h-48 flex flex-col items-center justify-center text-center text-gray-400 dark:text-zinc-600">
                <WifiOff size={40} className="mb-2" />
                <p className="text-sm font-semibold">No Wi-Fi Networks Found</p>
                <p className="text-xs mt-1">Click scan to refresh local network spectrum.</p>
              </div>
            )}
          </div>
        </div>

        {/* Connect Pane */}
        <div className="lg:col-span-1">
          {selectedNetwork ? (
            selectedNetwork.connected ? (
              <div className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-emerald-950/20 rounded-2xl p-6 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <ShieldCheck className="text-emerald-500" size={18} />
                  <span>Connected Network</span>
                </h3>
                <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-xl mb-4 space-y-2 text-sm text-gray-700 dark:text-zinc-300 border border-emerald-100/30">
                  <div><span className="text-gray-400">SSID:</span> <span className="font-bold">{selectedNetwork.ssid}</span></div>
                  <div><span className="text-gray-400">BSSID:</span> <span className="font-mono text-xs">{selectedNetwork.bssid}</span></div>
                  <div><span className="text-gray-400">Signal:</span> <span>{selectedNetwork.signal}%</span></div>
                  <div><span className="text-gray-400">Security:</span> <span>{selectedNetwork.security}</span></div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedNetwork(null)}
                    className="flex-1 py-2.5 border border-gray-300 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 text-sm font-semibold rounded-xl transition-all"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={connecting}
                    className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-all hover:shadow-md hover:shadow-red-500/15 flex items-center justify-center gap-1.5 disabled:opacity-50 animate-in fade-in duration-200"
                  >
                    {connecting ? <Loader2 size={14} className="animate-spin" /> : null}
                    <span>Disconnect</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">Connect to Network</h3>
                <div className="p-3 bg-gray-50 dark:bg-zinc-950 rounded-xl mb-4 text-sm font-semibold text-gray-700 dark:text-zinc-300">
                  SSID: {selectedNetwork.ssid}
                </div>
                
                <form onSubmit={handleConnect} className="space-y-4">
                  {selectedNetwork.security !== 'None' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1">
                        <Key size={14} className="text-brand-orange" />
                        <span>Security Password</span>
                      </label>
                      <input
                        type="password"
                        required={!selectedNetwork.saved}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={selectedNetwork.saved ? "Saved (leave empty to use saved password)" : "••••••••"}
                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-xl text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange text-sm"
                      />
                      {selectedNetwork.saved && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-500 mt-1.5 flex items-center gap-1">
                          <ShieldCheck size={12} />
                          <span>This network is saved on the device.</span>
                        </p>
                      )}
                    </div>
                  )}
                  
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedNetwork(null);
                        setPassword('');
                      }}
                      className="flex-1 py-2.5 border border-gray-300 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 text-sm font-semibold rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={connecting}
                      className="flex-1 py-2.5 bg-brand-orange hover:bg-brand-orange-600 text-white text-sm font-semibold rounded-xl transition-all hover:shadow-md hover:shadow-brand-orange/15 flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {connecting ? <Loader2 size={14} className="animate-spin" /> : null}
                      <span>Connect</span>
                    </button>
                  </div>
                </form>
              </div>
            )
          ) : (
            <div className="h-full bg-white dark:bg-zinc-900 border border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl p-6 text-center flex flex-col items-center justify-center min-h-[220px]">
              <Wifi size={32} className="text-gray-300 dark:text-zinc-700 mb-3" />
              <h3 className="text-sm font-bold text-gray-700 dark:text-zinc-400 mb-1">Select a Network</h3>
              <p className="text-xs text-gray-400 dark:text-zinc-500 max-w-xs">
                Select a Wi-Fi network from the list to enter credentials and establish connection.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
