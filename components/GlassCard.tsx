import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  headerAction?: React.ReactNode;
  noPadding?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = "", title, headerAction, noPadding = false }) => {
  return (
    <div className={`glass-panel rounded-2xl ${noPadding ? 'p-0' : 'p-6'} ${className}`}>
      {(title || headerAction) && (
        <div className={`flex justify-between items-center border-b border-white/5 ${noPadding ? 'p-6 pb-4' : 'mb-4 pb-2'}`}>
          {title && <h2 className="text-lg font-semibold text-white/90 tracking-wide">{title}</h2>}
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      {children}
    </div>
  );
};