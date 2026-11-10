import React from 'react';

export interface BrandButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'gold';
  children: React.ReactNode;
  className?: string;
  isLoading?: boolean;
  loadingText?: string;
  disabled?: boolean;
}

export default function BrandButton({
  variant = 'primary',
  children,
  className = '',
  isLoading = false,
  loadingText,
  disabled,
  ...props
}: BrandButtonProps) {
  const variantClass = variant === 'gold' ? 'brand-skew-btn-gold' : 'brand-skew-btn';

  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      className={`${variantClass} ${className}`}
    >
      {isLoading ? (
        <div className="flex items-center gap-2.5 z-10 py-1">
          <svg className="animate-spin h-5 w-5 text-amber-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm font-black uppercase tracking-wider text-amber-200">
            {loadingText || 'Processando...'}
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-3 w-full h-full z-10">
          {children}
        </div>
      )}
    </button>
  );
}
