import React, { useState, useEffect } from 'react';
import { Shield, Mic, Settings, Sun, Moon, ArrowRight } from 'lucide-react';

export default function Portal() {
  const [darkMode, setDarkMode] = useState(
    document.documentElement.classList.contains('dark') ||
    localStorage.getItem('theme') === 'dark'
  );
  
  const [status, setStatus] = useState({
    protectqube: { installed: false, running: false },
    voiceguard: { installed: false, running: false },
    devicemanager: { installed: true, running: true }
  });

  // Sync dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Polling service status
  useEffect(() => {
    const checkStatus = () => {
      fetch('/api/system/portal/status')
        .then(res => {
          if (!res.ok) throw new Error('Status API offline');
          return res.json();
        })
        .then(data => setStatus(data))
        .catch(err => {
          console.error('Portal status fetch error:', err);
          // Fallback to offline on fetch failure
          setStatus({
            protectqube: { installed: false, running: false },
            voiceguard: { installed: false, running: false },
            devicemanager: { installed: true, running: true }
          });
        });
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const hostname = window.location.hostname;
  const protocol = window.location.protocol;

  const services = [
    {
      id: 'protectqube',
      title: 'ProtectQube AI',
      desc: 'NPU-accelerated intelligent camera monitoring and local spatial alert processing engine.',
      icon: Shield,
      url: `${protocol}//${hostname}:8082`,
      ...status.protectqube
    },
    {
      id: 'voiceguard',
      title: 'VoiceGuard',
      desc: 'Real-time retail audio capture, VAD processing, and local LLM/STT speech analysis system.',
      icon: Mic,
      url: `${protocol}//${hostname}:8083`,
      ...status.voiceguard
    },
    {
      id: 'devicemanager',
      title: 'Device Manager',
      desc: 'System resources visualizer, multimedia input detection, services manager, and network settings.',
      icon: Settings,
      url: `${protocol}//${hostname}:8081`,
      ...status.devicemanager
    }
  ];

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center relative overflow-hidden bg-gray-50 dark:bg-[#070709] transition-colors duration-300 p-6 select-none">
      {/* Tech Grid Background */}
      <div className="absolute inset-0 tech-grid pointer-events-none z-0" />

      {/* Decorative Glow Blob */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] rounded-full bg-brand-orange-500/5 dark:bg-brand-orange-500/10 blur-[100px] pointer-events-none z-0" />

      {/* Theme Switcher Header */}
      <header className="absolute top-6 right-6 z-50">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2.5 rounded-full border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 backdrop-blur-md text-gray-800 dark:text-zinc-200 hover:border-brand-orange hover:text-brand-orange transition-all duration-200 shadow-sm"
          title="Toggle Theme"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      {/* Main Centered Content */}
      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center justify-center">
        {/* Portal Brand Header */}
        <div className="text-center mb-10">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-orange">ProtectQube Ecosystem</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1.5 mb-2.5 text-gray-900 dark:text-white">
            ProtectQube Portal
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
            Choose an active edge service node below to open its dashboard.
          </p>
        </div>

        {/* Dynamic Cards Grid */}
        <div className="flex flex-wrap justify-center items-stretch gap-6 w-full">
          {services
            .filter(service => service.installed)
            .map(service => {
              const Icon = service.icon;
              return (
                <div
                  key={service.id}
                  className="w-[260px] p-6 rounded-3xl border border-gray-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/50 backdrop-blur-md shadow-sm hover:shadow-md hover:border-brand-orange/40 dark:hover:border-brand-orange/40 transition-all duration-300 flex flex-col items-center relative group"
                >
                  {/* Status Indicator */}
                  <div className="absolute top-5 right-5">
                    {service.running ? (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>ACTIVE</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        <span>OFFLINE</span>
                      </div>
                    )}
                  </div>

                  {/* Icon Circle */}
                  <div className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center bg-brand-orange/5 border border-brand-orange/15 text-brand-orange group-hover:scale-105 group-hover:border-brand-orange/30 group-hover:bg-brand-orange/10 transition-all duration-300 mt-2">
                    <Icon size={22} />
                  </div>

                  {/* Title & Description */}
                  <h2 className="text-sm font-bold mt-4 mb-2 text-gray-900 dark:text-white tracking-tight">
                    {service.title}
                  </h2>
                  <p className="text-[11px] text-gray-500 dark:text-zinc-400 text-center leading-relaxed flex-grow mb-6">
                    {service.desc}
                  </p>

                  {/* Dynamic Launch Button */}
                  {service.running ? (
                    <a
                      href={service.url}
                      className="w-full py-2.5 rounded-xl text-xs font-semibold bg-brand-orange hover:bg-brand-orange-600 text-white transition-all duration-200 flex items-center justify-center gap-1 shadow-md shadow-brand-orange/10 hover:shadow-lg hover:shadow-brand-orange/20"
                    >
                      <span>Launch Node</span>
                      <ArrowRight size={13} />
                    </a>
                  ) : (
                    <button
                      disabled
                      className="w-full py-2.5 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-zinc-800/80 text-gray-400 dark:text-zinc-500 border border-gray-200/50 dark:border-zinc-800/50 cursor-not-allowed flex items-center justify-center"
                    >
                      <span>Offline</span>
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Minimal Footer */}
      <footer className="absolute bottom-6 text-[10px] font-semibold text-gray-400 dark:text-zinc-500 tracking-wider z-10 opacity-60">
        PROTECTQUBE ECOSYSTEM &bull; 2026
      </footer>
    </div>
  );
}
