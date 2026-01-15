import React from 'react';

export type ViewMode = 'grid' | 'freeform';

interface SidebarProps {
  activeMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  onSettingsClick: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeMode, onModeChange, onSettingsClick }) => {
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
    <div className="w-20 lg:w-32 flex-none flex flex-col bg-black/20 border-r border-white/10 backdrop-blur-xl h-full pt-6">
      <div className="px-4 mb-6 hidden lg:block">
        <h2 className="text-xs font-bold text-white/40 uppercase tracking-wider">Menu</h2>
      </div>
      
      <div className="flex-1 flex flex-col gap-2 px-3">
        {menuItems.map((item) => {
          const isActive = activeMode === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onModeChange(item.id)}
              className={`flex items-center gap-2 px-3 py-3 rounded-xl transition-all duration-300 group ${
                isActive 
                  ? 'bg-gradient-to-r from-indigo-600/20 to-purple-600/20 text-white border border-white/10 shadow-lg shadow-indigo-500/5' 
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className={`${isActive ? 'text-indigo-400' : 'text-current group-hover:text-indigo-300'} transition-colors flex-shrink-0`}>
                {item.icon}
              </div>
              <span className={`hidden lg:block text-xs font-medium truncate ${isActive ? 'text-white' : ''}`}>
                {item.label}
              </span>
              
              {isActive && (
                <div className="ml-auto hidden lg:block w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)] flex-shrink-0"></div>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-3 border-t border-white/5 mt-auto">
        <button 
            onClick={onSettingsClick}
            className="w-full flex items-center gap-2 px-3 py-3 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-all duration-300 group"
        >
            <div className="text-current group-hover:text-indigo-300 transition-colors flex-shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </div>
            <span className="hidden lg:block text-xs font-medium truncate">设置</span>
        </button>
        <div className="hidden lg:block text-[10px] text-white/20 text-center font-mono mt-2 pb-2 leading-tight">
           Gemini 3<br/>System
        </div>
      </div>
    </div>
  );
};