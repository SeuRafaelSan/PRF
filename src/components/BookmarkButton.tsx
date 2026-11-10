import React from 'react';

export interface BookmarkButtonProps {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  isSaved?: boolean;
  isLoading?: boolean;
  savedText?: string;
  unsavedText?: string;
  className?: string;
  title?: string;
  disabled?: boolean;
  id?: string;
}

export default function BookmarkButton({
  onClick,
  isSaved = false,
  isLoading = false,
  savedText = "Salvo",
  unsavedText = "Salvar",
  className = "",
  title,
  disabled = false,
  id
}: BookmarkButtonProps) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      title={title || (isSaved ? "Material salvo nos seus favoritos" : "Salvar material nos favoritos")}
      className={`bookmarkBtn ${isSaved ? 'is-saved' : ''} ${className}`}
    >
      <span className="IconContainer">
        {isLoading ? (
          <svg className="icon animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg
            viewBox="0 0 384 512"
            height="14"
            className="icon"
            fill="white"
          >
            <path d="M0 48V487.7C0 501.1 10.9 512 24.3 512c5 0 9.9-1.5 14-4.4L192 400 345.7 507.6c4.1 2.9 9 4.4 14 4.4c13.4 0 24.3-10.9 24.3-24.3V48c0-26.5-21.5-48-48-48H48C21.5 0 0 21.5 0 48z" />
          </svg>
        )}
      </span>
      <p className="text">
        {isLoading ? "..." : isSaved ? savedText : unsavedText}
      </p>
    </button>
  );
}
