import React from 'react';
import { HistoryItem as HistoryItemType } from '../types';
import { RATIO_LABELS } from '../constants';

interface HistoryItemProps {
  item: HistoryItemType;
  onClick: (item: HistoryItemType) => void;
}

export const HistoryItemCard: React.FC<HistoryItemProps> = ({ item, onClick }) => {
  // Prefer the R2 URL if available, otherwise fallback to thumbnail/base64
  const src = item.imageUrl || `data:image/png;base64,${item.thumbnailBase64}`;

  return (
    <div 
      onClick={() => onClick(item)}
      className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer border border-white/5 hover:border-indigo-500/50 transition-all duration-300"
    >
      <img 
        src={src} 
        alt={item.prompt} 
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
        <p className="text-white text-xs font-medium line-clamp-1">{item.prompt}</p>
        <div className="flex gap-2 mt-1">
          <span className="text-[10px] text-white/70 bg-white/10 px-1.5 py-0.5 rounded backdrop-blur-md">
            {RATIO_LABELS[item.aspectRatio]}
          </span>
          {item.imageUrl && (
             <span className="text-[10px] text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded backdrop-blur-md border border-indigo-500/30">
               CLOUD
             </span>
          )}
        </div>
      </div>
    </div>
  );
};