import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  headerAction?: React.ReactNode;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = "", title, headerAction }) => {
  return (
    <div className={`glass-panel rounded-2xl p-6 ${className}`}>
      {(title || headerAction) && (
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/5">
          {title && <h2 className="text-lg font-semibold text-white/90 tracking-wide">{title}</h2>}
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      {children}
    </div>
  );
};