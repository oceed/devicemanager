import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Network, Wifi, Radio, Shield, LogOut, Sun, Moon, Server, Settings } from 'lucide-react';
import Login from './components/Login';
import DashboardTab from './components/DashboardTab';
import NetworkTab from './components/NetworkTab';
import WifiTab from './components/WifiTab';
import ApTab from './components/ApTab';
import VpnTab from './components/VpnTab';
import RecoveryTab from './components/RecoveryTab';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [activeTab, setActiveTab] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem('theme') === 'dark' ||
    (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );

  // Sync Dark Mode state to HTML document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  if (!token) {
    return <Login onLogin={setToken} darkMode={darkMode} setDarkMode={setDarkMode} />;
  }

  // Sidebar navigation items
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'ethernet', label: 'Ethernet / LAN', icon: Network },
    { id: 'wifi', label: 'Wi-Fi Client', icon: Wifi },
    { id: 'ap', label: 'Access Point (AP)', icon: Radio },
    { id: 'vpn', label: 'VPN Manager', icon: Shield },
    { id: 'recovery', label: 'System & Recovery', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-brand-dark-bg text-gray-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 flex flex-col justify-between p-6">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 px-2 mb-8">
            <span className="text-2xl">🍊</span>
            <div>
              <h1 className="font-bold font-sans tracking-tight text-gray-950 dark:text-white leading-none">
                Orange Pi <span className="text-brand-orange">Edge</span>
              </h1>
              <span className="text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                Config Node
              </span>
            </div>
          </div>

          {/* Menu */}
          <nav className="space-y-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-brand-orange/10 dark:bg-brand-orange/20 text-brand-orange shadow-sm shadow-brand-orange/5'
                      : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800/50 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-brand-orange' : ''} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer actions */}
        <div className="space-y-4 border-t border-gray-100 dark:border-zinc-800/80 pt-6">
          {/* Theme Switcher */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800 text-sm font-semibold text-gray-600 dark:text-zinc-400 transition-all duration-200"
          >
            <div className="flex items-center gap-2">
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase">Theme</span>
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-200"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="px-8 py-5 border-b border-gray-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/10 backdrop-blur-md flex justify-between items-center sticky top-0 z-40">
          <div>
            <h2 className="text-2xl font-bold text-gray-950 dark:text-white capitalize">
              {activeTab === 'ap' ? 'Access Point (AP)' : activeTab === 'ethernet' ? 'Ethernet Config' : activeTab === 'recovery' ? 'System & Recovery' : activeTab.replace('-', ' ')}
            </h2>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
              Configuration profile interface for Orange Pi 5 Pro Edge Device.
            </p>
          </div>
          
          <div className="flex items-center gap-4 text-xs font-semibold">
            {/* Status light */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>ONLINE</span>
            </div>
          </div>
        </header>

        {/* Tab Content Router */}
        <div className="p-8 max-w-7xl w-full mx-auto flex-1">
          {activeTab === 'dashboard' && <DashboardTab />}
          {activeTab === 'ethernet' && <NetworkTab />}
          {activeTab === 'wifi' && <WifiTab />}
          {activeTab === 'ap' && <ApTab />}
          {activeTab === 'vpn' && <VpnTab />}
          {activeTab === 'recovery' && <RecoveryTab />}
        </div>
      </main>
    </div>
  );
}
