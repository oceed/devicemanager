import React, { useState, useEffect } from 'react';
import { Cpu, RefreshCw, Radio, HardDrive, ToggleLeft, ToggleRight, CheckCircle2, AlertTriangle, Play, HelpCircle, Loader2, Signal, AlertCircle, Trash2, Square, Video, Mic, Activity } from 'lucide-react';

export default function RecoveryTab() {
  const [usbDevices, setUsbDevices] = useState([]);
  const [services, setServices] = useState([]);
  const [modems, setModems] = useState([]);
  const [activeModem, setActiveModem] = useState(null);
  const [multimedia, setMultimedia] = useState({ cameras: [], microphones: [] });
  const [watchdog, setWatchdog] = useState({
    enabled: false,
    ping_target: '8.8.8.8',
    interval: 30,
    fail_threshold: 3,
    fail_count: 0,
    last_check_time: null,
    last_check_status: 'unknown',
    last_healing_time: null,
    last_healing_action: null,
    logs: []
  });

  const [mqtt, setMqtt] = useState({
    enabled: false,
    broker_host: 'localhost',
    broker_port: 1883,
    username: '',
    password: '',
    device_id: 'orange-pi-edge',
    heartbeat_topic: 'device/orange-pi-edge/heartbeat',
    heartbeat_interval: 30,
    telemetry_topic: 'device/orange-pi-edge/telemetry',
    telemetry_interval: 60,
    connection_status: 'disconnected',
    error_message: null
  });

  const [loading, setLoading] = useState(true);
  const [resettingUsb, setResettingUsb] = useState(null);
  const [serviceActionLoading, setServiceActionLoading] = useState(null);
  const [modemLoading, setModemLoading] = useState(false);
  const [watchdogSubmitting, setWatchdogSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // 1. Fetch USB devices
      const usbRes = await fetch('/api/system/usb', { headers });
      const usbData = await usbRes.json();
      setUsbDevices(Array.isArray(usbData) ? usbData : []);

      // 2. Fetch System services status
      const svcRes = await fetch('/api/system/services', { headers });
      const svcData = await svcRes.json();
      setServices(Array.isArray(svcData) ? svcData : []);

      // 3. Fetch Multimedia devices
      const mmRes = await fetch('/api/system/multimedia', { headers });
      const mmData = await mmRes.json();
      if (mmData && !mmData.detail) {
        setMultimedia(mmData);
      }

      // 4. Fetch Watchdog status
      const wdRes = await fetch('/api/network/watchdog/status', { headers });
      const wdData = await wdRes.json();
      if (wdData && !wdData.detail) {
        setWatchdog(wdData);
      }

      // 4b. Fetch MQTT status
      const mqttRes = await fetch('/api/system/mqtt', { headers });
      const mqttData = await mqttRes.json();
      if (mqttData && !mqttData.detail) {
        setMqtt(mqttData);
      }

      // 5. Fetch Modem info
      setModemLoading(true);
      const modemRes = await fetch('/api/system/modem', { headers });
      const modemData = await modemRes.json();
      setModems(modemData.modems || []);
      setActiveModem(modemData.active_modem);
    } catch (err) {
      console.error('Error fetching recovery tab data:', err);
      showStatus('error', 'Failed to retrieve system status data.');
    } finally {
      setLoading(false);
      setModemLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Poll service, watchdog, and modem status every 10 seconds
    const intervalId = setInterval(() => {
      fetchData();
    }, 10000);
    return () => clearInterval(intervalId);
  }, []);

  const showStatus = (type, text) => {
    setStatusMsg({ type, text });
    setTimeout(() => {
      setStatusMsg({ type: '', text: '' });
    }, 6000);
  };

  const handleResetUsb = async (path) => {
    setResettingUsb(path);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/system/usb/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ path })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to reset USB');
      showStatus('success', data.message || `USB device at ${path} reset successfully.`);
    } catch (err) {
      showStatus('error', err.message);
    } finally {
      setResettingUsb(null);
      fetchData();
    }
  };

  const handleControlService = async (serviceName, action) => {
    setServiceActionLoading(`${serviceName}-${action}`);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/system/services/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ service_name: serviceName, action })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to control service');
      showStatus('success', data.message || `Service ${serviceName} ${action}ed successfully.`);
    } catch (err) {
      showStatus('error', err.message);
    } finally {
      setServiceActionLoading(null);
      fetchData();
    }
  };

  const handleToggleWatchdog = async () => {
    const nextState = !watchdog.enabled;
    setWatchdogSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/network/watchdog/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          enabled: nextState,
          ping_target: watchdog.ping_target,
          interval: watchdog.interval,
          fail_threshold: watchdog.fail_threshold
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to configure watchdog');
      setWatchdog(data.status);
      showStatus('success', `Watchdog ${nextState ? 'enabled' : 'disabled'} successfully.`);
    } catch (err) {
      showStatus('error', err.message);
    } finally {
      setWatchdogSubmitting(false);
    }
  };

  const handleSaveWatchdogSettings = async (e) => {
    e.preventDefault();
    setWatchdogSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/network/watchdog/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          enabled: watchdog.enabled,
          ping_target: watchdog.ping_target,
          interval: Number(watchdog.interval),
          fail_threshold: Number(watchdog.fail_threshold)
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to update settings');
      setWatchdog(data.status);
      showStatus('success', 'Watchdog settings updated.');
    } catch (err) {
      showStatus('error', err.message);
    } finally {
      setWatchdogSubmitting(false);
    }
  };

  const handleClearWatchdogLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/network/watchdog/clear-logs', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setWatchdog(prev => ({ ...prev, logs: [] }));
      showStatus('success', 'Watchdog healing logs cleared.');
    } catch (err) {
      showStatus('error', 'Failed to clear logs.');
    }
  };

  const handleTriggerHeal = async () => {
    showStatus('info', 'Triggering manual connectivity healing sequence...');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/network/watchdog/trigger', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        showStatus('success', `Auto-heal action complete: ${data.action}`);
        fetchData();
      } else {
        throw new Error(data.detail || 'Failed to trigger heal');
      }
    } catch (err) {
      showStatus('error', err.message);
    }
  };

  const [mqttSubmitting, setMqttSubmitting] = useState(false);

  const handleToggleMqtt = async () => {
    const nextState = !mqtt.enabled;
    setMqttSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/system/mqtt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...mqtt,
          enabled: nextState
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to configure MQTT');
      setMqtt(data.status);
      showStatus('success', `MQTT telemetry ${nextState ? 'enabled' : 'disabled'} successfully.`);
    } catch (err) {
      showStatus('error', err.message);
    } finally {
      setMqttSubmitting(false);
    }
  };

  const handleSaveMqttSettings = async (e) => {
    e.preventDefault();
    setMqttSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/system/mqtt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...mqtt,
          broker_port: Number(mqtt.broker_port),
          heartbeat_interval: Number(mqtt.heartbeat_interval),
          telemetry_interval: Number(mqtt.telemetry_interval)
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to update MQTT settings');
      setMqtt(data.status);
      showStatus('success', 'MQTT settings updated.');
    } catch (err) {
      showStatus('error', err.message);
    } finally {
      setMqttSubmitting(false);
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
      {/* Top Banner Message */}
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
        {/* LEFT COLUMN: Services & Cellular Modems */}
        <div className="lg:col-span-1 space-y-6">
          {/* Section 1: Services Controller */}
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Cpu size={18} className="text-brand-orange" />
              <span>Connectivity Services</span>
            </h2>

            <div className="space-y-3">
              {services.map((svc) => {
                const isActive = svc.status === 'active';
                const isInstalled = svc.status !== 'not-installed';
                
                return (
                  <div
                    key={svc.name}
                    className="flex items-center justify-between p-3.5 bg-gray-50/50 dark:bg-zinc-950/50 border border-gray-100 dark:border-zinc-800 rounded-xl"
                  >
                    <div>
                      <h4 className="font-bold text-gray-800 dark:text-zinc-200 text-sm truncate max-w-[150px]" title={svc.name}>{svc.name}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          isActive 
                            ? 'bg-emerald-500 animate-pulse' 
                            : svc.status === 'not-installed'
                            ? 'bg-zinc-300 dark:bg-zinc-700' 
                            : 'bg-red-500'
                        }`} />
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isActive 
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' 
                            : svc.status === 'not-installed'
                            ? 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
                            : 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400'
                        } uppercase tracking-wide`}>
                          {svc.status.replace('-', ' ')}
                        </span>
                      </div>
                    </div>

                    {isInstalled && (
                      <div className="flex gap-1.5">
                        {isActive ? (
                          <button
                            onClick={() => handleControlService(svc.name, 'stop')}
                            disabled={serviceActionLoading !== null}
                            className="p-1.5 border border-gray-200 dark:border-zinc-850 hover:border-red-500 text-gray-400 dark:text-zinc-500 hover:text-red-500 rounded-lg transition-all hover:bg-red-50/50 dark:hover:bg-red-950/10"
                            title={`Stop ${svc.name}`}
                          >
                            {serviceActionLoading === `${svc.name}-stop` ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Square size={13} />
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleControlService(svc.name, 'start')}
                            disabled={serviceActionLoading !== null}
                            className="p-1.5 border border-gray-200 dark:border-zinc-850 hover:border-emerald-500 text-gray-400 dark:text-zinc-500 hover:text-emerald-500 rounded-lg transition-all hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10"
                            title={`Start ${svc.name}`}
                          >
                            {serviceActionLoading === `${svc.name}-start` ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Play size={13} />
                            )}
                          </button>
                        )}

                        <button
                          onClick={() => handleControlService(svc.name, 'restart')}
                          disabled={serviceActionLoading !== null}
                          className="p-1.5 border border-gray-200 dark:border-zinc-850 hover:border-brand-orange text-gray-400 dark:text-zinc-500 hover:text-brand-orange rounded-lg transition-all hover:bg-brand-orange/5"
                          title={`Restart ${svc.name}`}
                        >
                          {serviceActionLoading === `${svc.name}-restart` ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <RefreshCw size={13} />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Cellular Modem status (ModemManager) */}
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Radio size={18} className="text-brand-orange" />
              <span>Cellular Modem</span>
            </h2>

            {modemLoading ? (
              <div className="h-32 flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-brand-orange" />
              </div>
            ) : activeModem ? (
              <div className="space-y-4">
                <div className="p-3.5 bg-brand-orange/5 dark:bg-brand-orange/10 border border-brand-orange/15 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-sm">{activeModem.model}</h4>
                      <p className="text-xs text-gray-500 dark:text-zinc-400">{activeModem.manufacturer}</p>
                    </div>
                    <span className="text-[10px] bg-brand-orange/15 text-brand-orange px-2 py-0.5 rounded font-bold uppercase">
                      ID {activeModem.id}
                    </span>
                  </div>

                  {/* Signal indicator */}
                  <div className="mt-3 flex items-center gap-2">
                    <Signal size={16} className="text-brand-orange" />
                    <div className="flex-1">
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span>Signal Quality</span>
                        <span>{activeModem.signal_quality}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-brand-orange h-full rounded-full transition-all duration-300"
                          style={{ width: `${activeModem.signal_quality}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-gray-50 dark:border-zinc-800/50 pb-2">
                    <span className="text-gray-400 dark:text-zinc-500">State:</span>
                    <span className="font-semibold text-gray-800 dark:text-zinc-200 capitalize">{activeModem.state}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-50 dark:border-zinc-800/50 pb-2">
                    <span className="text-gray-400 dark:text-zinc-500">Access Tech:</span>
                    <span className="font-semibold text-gray-800 dark:text-zinc-200 uppercase">{activeModem.access_tech || 'None'}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-50 dark:border-zinc-800/50 pb-2">
                    <span className="text-gray-400 dark:text-zinc-500">Network Operator:</span>
                    <span className="font-semibold text-gray-800 dark:text-zinc-200">{activeModem.operator_name || 'N/A'}</span>
                  </div>
                  {activeModem.ip && (
                    <div className="flex justify-between border-b border-gray-50 dark:border-zinc-800/50 pb-2">
                      <span className="text-gray-400 dark:text-zinc-500">IP Address:</span>
                      <span className="font-semibold font-mono text-gray-800 dark:text-zinc-200">{activeModem.ip}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-b border-gray-50 dark:border-zinc-800/50 pb-2">
                    <span className="text-gray-400 dark:text-zinc-500">IMEI:</span>
                    <span className="font-mono text-gray-700 dark:text-zinc-400">{activeModem.imei || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 dark:text-zinc-500">ICCID:</span>
                    <span className="font-mono text-gray-700 dark:text-zinc-400 truncate max-w-[150px]" title={activeModem.iccid}>
                      {activeModem.iccid || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center border border-dashed border-gray-200 dark:border-zinc-800 text-gray-400 rounded-xl text-xs">
                No active cellular modems detected by ModemManager.
              </div>
            )}
          </div>
        </div>

        {/* MIDDLE COLUMN: USB Devices & Multimedia Inputs */}
        <div className="lg:col-span-1 space-y-6 flex flex-col">
          {/* USB Devices Card */}
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex-1 flex flex-col">
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <HardDrive size={18} className="text-brand-orange" />
              <span>Connected USB Devices</span>
            </h2>

            <div className="space-y-3 flex-1 overflow-y-auto max-h-[350px] pr-1">
              {usbDevices.map((usb, index) => {
                const isResetting = resettingUsb === usb.path;
                return (
                  <div
                    key={usb.path + index}
                    className="p-3.5 bg-gray-50/50 dark:bg-zinc-950/50 border border-gray-100 dark:border-zinc-800 rounded-xl space-y-2.5 transition-all hover:border-zinc-200 dark:hover:border-zinc-800"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <h4 className="font-bold text-gray-900 dark:text-white text-xs truncate max-w-[160px]" title={usb.name}>
                          {usb.name}
                        </h4>
                        <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-mono">
                          ID {usb.id}
                        </p>
                      </div>

                      <button
                        onClick={() => handleResetUsb(usb.path)}
                        disabled={isResetting}
                        className="py-1 px-2.5 border border-red-150 hover:bg-red-50 dark:border-red-950/20 dark:hover:bg-red-950/30 text-red-500 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1"
                        title="Re-initialize and Reset USB Device Port"
                      >
                        {isResetting ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                        <span>{isResetting ? 'Resetting...' : 'Reset'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-medium text-gray-400 dark:text-zinc-500 border-t border-gray-100/50 dark:border-zinc-800/30 pt-2">
                      <div>Bus/Device: <span className="font-semibold text-gray-700 dark:text-zinc-300 font-mono">{usb.bus}/{usb.device}</span></div>
                      <div className="truncate" title={usb.path}>Path: <span className="font-semibold text-gray-700 dark:text-zinc-300 font-mono">{usb.path}</span></div>
                    </div>
                  </div>
                );
              })}

              {usbDevices.length === 0 && (
                <div className="p-8 text-center border border-dashed border-gray-200 dark:border-zinc-800 text-gray-400 rounded-xl text-xs">
                  No USB controllers or devices listed.
                </div>
              )}
            </div>
          </div>

          {/* Multimedia inputs Card */}
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex-1 flex flex-col">
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Video size={18} className="text-brand-orange" />
              <span>Multimedia Inputs</span>
            </h2>

            <div className="space-y-4 flex-1 overflow-y-auto max-h-[300px] pr-1">
              {/* Cameras */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Video size={12} />
                  <span>Video Cameras</span>
                </h3>
                {multimedia.cameras.map((cam, idx) => (
                  <div key={idx} className="p-3 bg-gray-50/50 dark:bg-zinc-950/50 border border-gray-100 dark:border-zinc-850 rounded-xl flex items-center gap-3">
                    <div className="p-2 bg-brand-orange/10 text-brand-orange rounded-lg">
                      <Video size={16} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-gray-800 dark:text-zinc-200 text-xs truncate max-w-[170px]" title={cam.name}>
                        {cam.name}
                      </h4>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">{cam.device}</p>
                    </div>
                  </div>
                ))}
                {multimedia.cameras.length === 0 && (
                  <p className="text-[10px] text-zinc-500 italic pl-2">No video inputs detected.</p>
                )}
              </div>

              {/* Microphones */}
              <div className="space-y-2 border-t border-gray-100 dark:border-zinc-800/50 pt-3">
                <h3 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Mic size={12} />
                  <span>Audio Capture Inputs</span>
                </h3>
                {multimedia.microphones.map((mic, idx) => (
                  <div key={idx} className="p-3 bg-gray-50/50 dark:bg-zinc-950/50 border border-gray-100 dark:border-zinc-850 rounded-xl flex items-center gap-3">
                    <div className="p-2 bg-brand-orange/10 text-brand-orange rounded-lg">
                      <Mic size={16} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-gray-800 dark:text-zinc-200 text-xs truncate max-w-[170px]" title={mic.name}>
                        {mic.name}
                      </h4>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">Card ID: {mic.id}</p>
                    </div>
                  </div>
                ))}
                {multimedia.microphones.length === 0 && (
                  <p className="text-[10px] text-zinc-500 italic pl-2">No audio capture inputs detected.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Smart Watchdog Recovery Config & Logs */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            {/* Header with Switch */}
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 size={18} className="text-brand-orange" />
                <span>Smart Auto-Recovery</span>
              </h2>

              <button
                onClick={handleToggleWatchdog}
                disabled={watchdogSubmitting}
                className="text-gray-400 hover:text-brand-orange transition-colors"
                title={watchdog.enabled ? 'Disable Smart Watchdog' : 'Enable Smart Watchdog'}
              >
                {watchdog.enabled ? (
                  <ToggleRight size={36} className="text-brand-orange cursor-pointer" />
                ) : (
                  <ToggleLeft size={36} className="cursor-pointer" />
                )}
              </button>
            </div>

            {/* Watchdog status banner */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="p-3.5 bg-gray-50 dark:bg-zinc-950 rounded-xl border border-gray-100 dark:border-zinc-800/50">
                <div className="text-[10px] font-bold text-gray-400 uppercase">Ping Check</div>
                <div className="flex items-center gap-1.5 mt-1 font-bold text-sm">
                  <span className={`w-2 h-2 rounded-full ${watchdog.last_check_status === 'online' ? 'bg-emerald-500' : watchdog.last_check_status === 'offline' ? 'bg-red-500 animate-pulse' : 'bg-zinc-400'}`} />
                  <span className={watchdog.last_check_status === 'online' ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'}>
                    {watchdog.last_check_status.toUpperCase()}
                  </span>
                </div>
              </div>
              
              <div className="p-3.5 bg-gray-50 dark:bg-zinc-950 rounded-xl border border-gray-100 dark:border-zinc-800/50">
                <div className="text-[10px] font-bold text-gray-400 uppercase">Fail Strikes</div>
                <div className="mt-1 font-bold text-sm text-gray-800 dark:text-zinc-200">
                  {watchdog.fail_count} / {watchdog.fail_threshold}
                </div>
              </div>
            </div>

            {/* Settings Form */}
            <form onSubmit={handleSaveWatchdogSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-zinc-400 mb-1">
                  Ping Target IP
                </label>
                <input
                  type="text"
                  required
                  value={watchdog.ping_target}
                  onChange={(e) => setWatchdog(prev => ({ ...prev, ping_target: e.target.value }))}
                  placeholder="8.8.8.8"
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-850 rounded-xl text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange text-xs font-semibold font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-zinc-400 mb-1">
                    Check Interval (sec)
                  </label>
                  <input
                    type="number"
                    required
                    min={10}
                    value={watchdog.interval}
                    onChange={(e) => setWatchdog(prev => ({ ...prev, interval: e.target.value }))}
                    placeholder="30"
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-850 rounded-xl text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange text-xs font-semibold"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-zinc-400 mb-1">
                    Fail Threshold
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={watchdog.fail_threshold}
                    onChange={(e) => setWatchdog(prev => ({ ...prev, fail_threshold: e.target.value }))}
                    placeholder="3"
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-850 rounded-xl text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleTriggerHeal}
                  className="flex-1 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold rounded-xl text-xs transition-all flex items-center justify-center gap-1"
                >
                  <Play size={12} />
                  <span>Manual Heal</span>
                </button>

                <button
                  type="submit"
                  disabled={watchdogSubmitting}
                  className="flex-1 py-2 bg-brand-orange hover:bg-brand-orange-600 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {watchdogSubmitting ? <Loader2 size={12} className="animate-spin" /> : null}
                  <span>Save Config</span>
                </button>
              </div>
            </form>

            {/* Healing Logs Section */}
            <div className="border-t border-gray-100 dark:border-zinc-800 pt-5 mt-5 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-gray-800 dark:text-zinc-300 uppercase tracking-wide">
                  Watchdog Activity Log
                </h3>
                {watchdog.logs && watchdog.logs.length > 0 && (
                  <button
                    onClick={handleClearWatchdogLogs}
                    className="text-red-500 hover:text-red-600 text-[10px] font-bold uppercase transition-colors flex items-center gap-1"
                  >
                    <Trash2 size={10} />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              <div className="bg-gray-50 dark:bg-zinc-950/40 border border-gray-100 dark:border-zinc-850 rounded-xl p-3.5 h-[230px] overflow-y-auto space-y-3 font-mono text-[10px]">
                {watchdog.logs && watchdog.logs.map((log, idx) => {
                  const isHeal = log.message.toLowerCase().includes('heal') || log.message.toLowerCase().includes('restarting');
                  const isFail = log.message.toLowerCase().includes('failed');
                  const isSuccess = log.message.toLowerCase().includes('restored');
                  
                  let textColor = 'text-gray-500 dark:text-zinc-400';
                  if (isHeal) textColor = 'text-red-500 dark:text-red-400 font-semibold';
                  else if (isFail) textColor = 'text-amber-500 dark:text-amber-400 font-semibold';
                  else if (isSuccess) textColor = 'text-emerald-500 dark:text-emerald-400 font-semibold';

                  return (
                    <div key={idx} className="space-y-0.5 border-b border-gray-100/50 dark:border-zinc-900/30 pb-2 last:border-0 last:pb-0">
                      <div className="text-gray-400 dark:text-zinc-600">{log.timestamp}</div>
                      <div className={textColor}>{log.message}</div>
                    </div>
                  );
                })}

                {(!watchdog.logs || watchdog.logs.length === 0) && (
                  <div className="h-full flex items-center justify-center text-center text-gray-400 dark:text-zinc-600 text-[10px]">
                    No recovery log events generated.
                  </div>
                )}
              </div>
          </div>

          {/* MQTT Configuration Card */}
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            {/* Header with Switch */}
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Activity size={18} className="text-brand-orange" />
                <span>MQTT Heartbeat & Telemetry</span>
              </h2>

              <button
                onClick={handleToggleMqtt}
                disabled={mqttSubmitting}
                className="text-gray-400 hover:text-brand-orange transition-colors"
                title={mqtt.enabled ? 'Disable MQTT Integration' : 'Enable MQTT Integration'}
              >
                {mqtt.enabled ? (
                  <ToggleRight size={36} className="text-brand-orange cursor-pointer" />
                ) : (
                  <ToggleLeft size={36} className="cursor-pointer" />
                )}
              </button>
            </div>

            {/* Connection Status Banner */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="p-3.5 bg-gray-50 dark:bg-zinc-950 rounded-xl border border-gray-100 dark:border-zinc-800/50">
                <div className="text-[10px] font-bold text-gray-400 uppercase">Broker Status</div>
                <div className="flex items-center gap-1.5 mt-1 font-bold text-xs">
                  <span className={`w-2 h-2 rounded-full ${
                    mqtt.connection_status === 'connected' 
                      ? 'bg-emerald-500 animate-pulse' 
                      : mqtt.connection_status === 'connecting'
                      ? 'bg-amber-500 animate-pulse'
                      : mqtt.connection_status === 'error'
                      ? 'bg-red-500 animate-pulse'
                      : 'bg-zinc-400'
                  }`} />
                  <span className={
                    mqtt.connection_status === 'connected' 
                      ? 'text-emerald-600 dark:text-emerald-400' 
                      : mqtt.connection_status === 'connecting'
                      ? 'text-amber-600 dark:text-amber-400'
                      : mqtt.connection_status === 'error'
                      ? 'text-red-500 dark:text-red-400'
                      : 'text-zinc-500'
                  }>
                    {mqtt.connection_status.toUpperCase()}
                  </span>
                </div>
              </div>
              
              <div className="p-3.5 bg-gray-50 dark:bg-zinc-950 rounded-xl border border-gray-100 dark:border-zinc-800/50">
                <div className="text-[10px] font-bold text-gray-400 uppercase">Device ID</div>
                <div className="mt-1 font-bold text-xs text-gray-800 dark:text-zinc-200 truncate" title={mqtt.device_id}>
                  {mqtt.device_id}
                </div>
              </div>
            </div>

            {mqtt.connection_status === 'error' && mqtt.error_message && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/25 border border-red-200 dark:border-red-900/30 rounded-xl text-[10px] font-semibold text-red-600 dark:text-red-400 flex items-start gap-2">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span>{mqtt.error_message}</span>
              </div>
            )}

            {/* Settings Form */}
            <form onSubmit={handleSaveMqttSettings} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                    Broker Host
                  </label>
                  <input
                    type="text"
                    required
                    value={mqtt.broker_host}
                    onChange={(e) => setMqtt(prev => ({ ...prev, broker_host: e.target.value }))}
                    placeholder="localhost"
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-850 rounded-xl text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange text-xs font-semibold"
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                    Port
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={65535}
                    value={mqtt.broker_port}
                    onChange={(e) => setMqtt(prev => ({ ...prev, broker_port: e.target.value }))}
                    placeholder="1883"
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-850 rounded-xl text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={mqtt.username || ''}
                    onChange={(e) => setMqtt(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="Optional"
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-850 rounded-xl text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={mqtt.password || ''}
                    onChange={(e) => setMqtt(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Optional"
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-850 rounded-xl text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                  Device / Client ID
                </label>
                <input
                  type="text"
                  required
                  value={mqtt.device_id}
                  onChange={(e) => setMqtt(prev => ({ 
                    ...prev, 
                    device_id: e.target.value,
                    heartbeat_topic: `device/${e.target.value}/heartbeat`,
                    telemetry_topic: `device/${e.target.value}/telemetry`
                  }))}
                  placeholder="orange-pi-edge"
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-850 rounded-xl text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange text-xs font-semibold"
                />
              </div>

              <div className="border-t border-gray-100 dark:border-zinc-800/50 pt-3 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                      Heartbeat Topic
                    </label>
                    <input
                      type="text"
                      required
                      value={mqtt.heartbeat_topic}
                      onChange={(e) => setMqtt(prev => ({ ...prev, heartbeat_topic: e.target.value }))}
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-850 rounded-xl text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange text-xs font-semibold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                      Interval (s)
                    </label>
                    <input
                      type="number"
                      required
                      min={5}
                      value={mqtt.heartbeat_interval}
                      onChange={(e) => setMqtt(prev => ({ ...prev, heartbeat_interval: e.target.value }))}
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-850 rounded-xl text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange text-xs font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                      Telemetry Topic
                    </label>
                    <input
                      type="text"
                      required
                      value={mqtt.telemetry_topic}
                      onChange={(e) => setMqtt(prev => ({ ...prev, telemetry_topic: e.target.value }))}
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-850 rounded-xl text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange text-xs font-semibold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                      Interval (s)
                    </label>
                    <input
                      type="number"
                      required
                      min={10}
                      value={mqtt.telemetry_interval}
                      onChange={(e) => setMqtt(prev => ({ ...prev, telemetry_interval: e.target.value }))}
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-850 rounded-xl text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={mqttSubmitting}
                  className="w-full py-2 bg-brand-orange hover:bg-brand-orange-600 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {mqttSubmitting ? <Loader2 size={12} className="animate-spin" /> : null}
                  <span>Save Settings</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
