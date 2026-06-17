import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive, Thermometer, RefreshCw, Power, Clock, Info, ShieldAlert, ArrowDownUp } from 'lucide-react';

export default function DashboardTab() {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(null); // 'reboot' or 'shutdown' or null
  const [modalLoading, setModalLoading] = useState(false);
  const [modalResult, setModalResult] = useState('');

  const fetchMetrics = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/system/metrics', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          window.location.reload();
        }
        throw new Error('Failed to fetch metrics');
      }
      const data = await response.ok ? await response.json() : null;
      if (data) {
        setMetrics(data);
        setError('');
      }
    } catch (err) {
      setError('Connection to edge lost. Retrying...');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000); // refresh every 3s
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds) => {
    if (!seconds) return '0s';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  };

  const handleSystemAction = async (action) => {
    setModalLoading(true);
    setModalResult('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/system/control?action=${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setModalResult(`Success: ${data.message}`);
        setTimeout(() => {
          setShowModal(null);
          setModalResult('');
        }, 3000);
      } else {
        setModalResult(`Error: ${data.message}`);
      }
    } catch (err) {
      setModalResult('Failed to execute command on host');
    } finally {
      setModalLoading(false);
    }
  };

  // Helper component for Circular Progress Gauge
  const CircularGauge = ({ value, label, icon: Icon, colorClass }) => {
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (value / 100) * circumference;

    return (
      <div className="flex flex-col items-center p-6 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200">
        <div className="relative w-28 h-28 flex items-center justify-center">
          {/* Background circle */}
          <svg className="absolute w-full h-full transform -rotate-90">
            <circle
              cx="56"
              cy="56"
              r={radius}
              className="stroke-gray-100 dark:stroke-zinc-800"
              strokeWidth="8"
              fill="transparent"
            />
            {/* Value circle */}
            <circle
              cx="56"
              cy="56"
              r={radius}
              className={`transition-all duration-500 ease-out ${colorClass}`}
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>
          <div className="flex flex-col items-center justify-center text-center">
            <Icon size={22} className="text-gray-400 dark:text-zinc-500 mb-0.5" />
            <span className="text-xl font-bold font-sans text-gray-900 dark:text-white">
              {Math.round(value)}%
            </span>
          </div>
        </div>
        <span className="mt-4 text-sm font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
          {label}
        </span>
      </div>
    );
  };

  if (loading && !metrics) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw size={36} className="animate-spin text-brand-orange" />
          <span className="text-gray-500 dark:text-zinc-400 font-medium">Reading system state...</span>
        </div>
      </div>
    );
  }

  const cpuPercent = metrics?.cpu?.percent ?? 0;
  const ramPercent = metrics?.memory?.percent ?? 0;
  const diskPercent = metrics?.disk?.percent ?? 0;
  const npuPercent = metrics?.npu?.average ?? 0;
  const temps = metrics?.temperatures ?? {};
  const npuSupported = metrics?.npu?.supported ?? false;
  const bandwidth = metrics?.bandwidth;

  return (
    <div className="space-y-6">
      {/* Network Lost/Error alert */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-600 dark:text-amber-400 text-sm animate-pulse-slow">
          <ShieldAlert size={18} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Gauges Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <CircularGauge
          value={cpuPercent}
          label="CPU Load"
          icon={Cpu}
          colorClass="stroke-brand-orange"
        />
        <CircularGauge
          value={ramPercent}
          label="RAM Usage"
          icon={Info}
          colorClass="stroke-blue-500"
        />
        <CircularGauge
          value={diskPercent}
          label="Disk Space"
          icon={HardDrive}
          colorClass="stroke-emerald-500"
        />
        <CircularGauge
          value={npuPercent}
          label="NPU Load"
          icon={Cpu}
          colorClass={npuSupported ? 'stroke-purple-500' : 'stroke-gray-300 dark:stroke-zinc-700'}
        />
      </div>

      {/* Detailed Diagnostics Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Thermal Readings */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Thermometer className="text-brand-orange" size={20} />
            <span>Thermal Zones</span>
          </h2>
          <div className="space-y-5">
            {Object.entries(temps).map(([zone, temp]) => {
              // Color base on temperature
              let barColor = 'bg-emerald-500';
              if (temp > 75) barColor = 'bg-red-500';
              else if (temp > 60) barColor = 'bg-amber-500';

              return (
                <div key={zone} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-gray-600 dark:text-zinc-400 capitalize">{zone.replace("-thermal", "")}</span>
                    <span className="font-bold text-gray-900 dark:text-white">{temp}°C</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${Math.min(100, (temp / 90) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {Object.keys(temps).length === 0 && (
              <p className="text-sm text-gray-400 dark:text-zinc-500">No thermal sensors found</p>
            )}
          </div>
        </div>

        {/* Internet Bandwidth Consumption */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <ArrowDownUp className="text-brand-orange" size={20} />
              <span>Data Consumption</span>
            </h2>
            
            <div className="space-y-4">
              {/* Today */}
              <div className="p-3 bg-gray-50/50 dark:bg-zinc-950/20 border border-gray-100/50 dark:border-zinc-850/20 rounded-xl">
                <div className="flex justify-between text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase mb-1">
                  <span>Today</span>
                  <span className="text-brand-orange">{bandwidth?.today?.total_gb ?? 0} GB</span>
                </div>
                <div className="flex justify-between text-[11px] text-gray-500 dark:text-zinc-400">
                  <span>Download: {bandwidth?.today?.rx_gb ?? 0} GB</span>
                  <span>Upload: {bandwidth?.today?.tx_gb ?? 0} GB</span>
                </div>
              </div>
              
              {/* This Week */}
              <div className="p-3 bg-gray-50/50 dark:bg-zinc-950/20 border border-gray-100/50 dark:border-zinc-850/20 rounded-xl">
                <div className="flex justify-between text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase mb-1">
                  <span>This Week</span>
                  <span className="text-brand-orange">{bandwidth?.week?.total_gb ?? 0} GB</span>
                </div>
                <div className="flex justify-between text-[11px] text-gray-500 dark:text-zinc-400">
                  <span>Download: {bandwidth?.week?.rx_gb ?? 0} GB</span>
                  <span>Upload: {bandwidth?.week?.tx_gb ?? 0} GB</span>
                </div>
              </div>
              
              {/* This Month */}
              <div className="p-3 bg-gray-50/50 dark:bg-zinc-950/20 border border-gray-100/50 dark:border-zinc-850/20 rounded-xl">
                <div className="flex justify-between text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase mb-1">
                  <span>This Month</span>
                  <span className="text-brand-orange">{bandwidth?.month?.total_gb ?? 0} GB</span>
                </div>
                <div className="flex justify-between text-[11px] text-gray-500 dark:text-zinc-400">
                  <span>Download: {bandwidth?.month?.rx_gb ?? 0} GB</span>
                  <span>Upload: {bandwidth?.month?.tx_gb ?? 0} GB</span>
                </div>
              </div>
            </div>
          </div>
          
          {!bandwidth?.supported && bandwidth?.message && (
            <p className="text-[10px] text-gray-400 dark:text-zinc-500 text-center mt-3 italic leading-relaxed">
              * {bandwidth.message}
            </p>
          )}
        </div>

        {/* System Details & Controls */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <Info className="text-brand-orange" size={20} />
              <span>System Information</span>
            </h2>
            <div className="grid grid-cols-2 gap-y-4 text-sm mb-6">
              <div className="text-gray-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Clock size={16} />
                <span>Uptime</span>
              </div>
              <div className="font-semibold text-gray-900 dark:text-white text-right">
                {formatUptime(metrics?.uptime)}
              </div>

              <div className="text-gray-500 dark:text-zinc-400">Orange Pi NPU</div>
              <div className="font-semibold text-gray-900 dark:text-white text-right">
                {npuSupported ? 'RK3588 (Enabled)' : 'Not exposed (Mocked)'}
              </div>

              <div className="text-gray-500 dark:text-zinc-400">Memory Total</div>
              <div className="font-semibold text-gray-900 dark:text-white text-right">
                {metrics?.memory?.total_gb} GB
              </div>

              <div className="text-gray-500 dark:text-zinc-400">Disk Used</div>
              <div className="font-semibold text-gray-900 dark:text-white text-right font-mono">
                {metrics?.disk?.used_gb} / {metrics?.disk?.total_gb} GB
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-zinc-800 pt-6 flex items-center gap-3">
            <button
              onClick={() => setShowModal('reboot')}
              className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200 font-semibold rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} />
              <span>Reboot Device</span>
            </button>
            <button
              onClick={() => setShowModal('shutdown')}
              className="flex-1 py-2.5 px-4 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 font-semibold rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Power size={16} />
              <span>Power Off</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 capitalize">
              Confirm Device {showModal}
            </h3>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
              Are you sure you want to {showModal} the Orange Pi edge device? Active background operations like dashboard telemetry and NVR camera connections will be interrupted.
            </p>

            {modalResult && (
              <div className="mb-4 p-3 rounded-lg bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-sm font-semibold text-gray-700 dark:text-zinc-300">
                {modalResult}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowModal(null)}
                disabled={modalLoading}
                className="px-4 py-2 border border-gray-300 dark:border-zinc-800 rounded-xl text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSystemAction(showModal)}
                disabled={modalLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
              >
                {modalLoading ? <RefreshCw size={14} className="animate-spin" /> : null}
                <span>Confirm {showModal}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
