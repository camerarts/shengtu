import React from 'react';

export type ViewMode = 'grid' | 'freeform';

interface SidebarProps {
  activeMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeMode, onModeChange }) => {
  const menuItems = [
    {
      id: 'grid' as ViewMode,
      label: '9宫格图片',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      )
    },
    {
      id: 'freeform' as ViewMode,
      label: '自由生图',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    }
  ];

  return (
    <div className="w-20 lg:w-64 flex-none flex flex-col bg-black/20 border-r border-white/10 backdrop-blur-xl h-full pt-6">
      <div className="px-6 mb-8 hidden lg:block">
        <h2 className="text-xs font-bold text-white/40 uppercase tracking-wider">Menu</h2>
      </div>
      
      <div className="flex-1 flex flex-col gap-2 px-3">
        {menuItems.map((item) => {
          const isActive = activeMode === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onModeChange(item.id)}
              className={`flex items-center gap-3 px-3 lg:px-4 py-3 rounded-xl transition-all duration-300 group ${
                isActive 
                  ? 'bg-gradient-to-r from-indigo-600/20 to-purple-600/20 text-white border border-white/10 shadow-lg shadow-indigo-500/5' 
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className={`${isActive ? 'text-indigo-400' : 'text-current group-hover:text-indigo-300'} transition-colors`}>
                {item.icon}
              </div>
              <span className={`hidden lg:block text-sm font-medium ${isActive ? 'text-white' : ''}`}>
                {item.label}
              </span>
              
              {isActive && (
                <div className="ml-auto hidden lg:block w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]"></div>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-4 border-t border-white/5 hidden lg:block">
        <div className="text-[10px] text-white/20 text-center font-mono">
           Gemini 3 Pro System
        </div>
      </div>
    </div>
  );
};