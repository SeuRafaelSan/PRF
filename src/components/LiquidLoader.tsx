import React from 'react';

export interface LiquidLoaderProps {
  text?: string;
  subtext?: string;
  fullscreen?: boolean;
  className?: string;
}

export default function LiquidLoader({
  text = 'Carregando',
  subtext,
  fullscreen = false,
  className = ''
}: LiquidLoaderProps) {
  const content = (
    <div className={`liquid-loader ${className}`}>
      <div className="loader-track">
        <div className="liquid-fill"></div>
      </div>
      <div className="loading-text">
        <span>{text}</span>
        <span className="dot">.</span>
        <span className="dot">.</span>
        <span className="dot">.</span>
      </div>
      {subtext && (
        <p className="text-xs text-slate-400 font-medium text-center mt-1 max-w-xs animate-pulse">
          {subtext}
        </p>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white z-50">
        {content}
      </div>
    );
  }

  return content;
}
