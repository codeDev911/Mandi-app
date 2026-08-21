import React from 'react';
import { ActiveTab, AppSettings } from '../types';
import { translations } from '../utils/localization';
import { Gavel, Users, History, Settings, BarChart3 } from 'lucide-react';

interface NavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  settings: AppSettings;
  activeBolliCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  settings,
  activeBolliCount,
}) => {
  const t = translations[settings.language];

  const navItems: Array<{ id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }> = [
    { id: 'bolli', label: t.tabBolli, icon: Gavel, badge: activeBolliCount > 0 ? activeBolliCount : undefined },
    { id: 'khata', label: t.tabKhata, icon: Users },
    { id: 'reports', label: t.tabReports, icon: BarChart3 },
    { id: 'history', label: t.tabHistory, icon: History },
    { id: 'settings', label: t.tabSettings, icon: Settings },
  ];

  return (
    <>
      {/* Top Desktop Tabs (when on wider screen) */}
      <div className="bg-white border-b border-slate-200 shadow-xs hidden sm:block">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between overflow-x-auto">
          <div className="flex space-x-1.5 sm:space-x-2 rtl:space-x-reverse py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`px-3.5 py-2 rounded-xl font-medium text-xs sm:text-sm flex items-center gap-2 transition relative whitespace-nowrap ${
                    isActive
                      ? 'bg-slate-900 text-white font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span className="font-urdu-sans">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className={`w-5 h-5 rounded-full font-bold text-[10px] flex items-center justify-center font-numbers ${
                      isActive ? 'bg-emerald-500 text-slate-950' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Mobile Tab Bar (Native App Style) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl z-30 px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all duration-150 active:scale-90 relative ${
                isActive ? 'text-slate-950 font-bold' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-150 ${
                    isActive ? 'scale-110 stroke-[2.6px] text-emerald-600' : 'text-slate-400'
                  }`}
                />
                {item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-emerald-600 text-white font-extrabold text-[9px] flex items-center justify-center font-numbers shadow-xs">
                    {item.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] mt-1 leading-none truncate max-w-[54px] font-urdu-sans ${
                  isActive ? 'text-slate-900 font-extrabold' : 'text-slate-500'
                }`}
              >
                {item.label}
              </span>
              {isActive ? (
                <div className="w-4 h-1 bg-emerald-600 rounded-full mt-1"></div>
              ) : (
                <div className="w-4 h-1 bg-transparent rounded-full mt-1"></div>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
};
