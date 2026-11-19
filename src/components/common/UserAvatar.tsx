import React, { useState, useEffect, useMemo } from 'react';

export interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  className?: string;
  textClassName?: string;
  role?: string;
  alt?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name,
  className = 'w-10 h-10 rounded-xl',
  textClassName,
  alt,
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const initial = useMemo(() => {
    if (!name || name === 'string') return 'U';
    const trimmed = name.trim();
    const match = trimmed.match(/[a-zA-Z\u00C0-\u1EF9]/);
    if (match) {
      return match[0].toUpperCase();
    }
    return trimmed.charAt(0).toUpperCase() || 'U';
  }, [name]);

  const defaultTextClass = useMemo(() => {
    if (textClassName) return textClassName;
    if (className.includes('w-6') || className.includes('w-7') || className.includes('w-8')) {
      return 'text-[11px] font-bold';
    }
    if (className.includes('w-12') || className.includes('w-14') || className.includes('w-16')) {
      return 'text-base sm:text-lg font-black';
    }
    if (className.includes('w-20') || className.includes('w-22') || className.includes('w-24')) {
      return 'text-2xl font-black';
    }
    return 'text-xs sm:text-sm font-black';
  }, [className, textClassName]);

  const isValidSrc = Boolean(src && typeof src === 'string' && src.trim() !== '' && !hasError);

  return (
    <div
      className={`relative shrink-0 overflow-hidden flex items-center justify-center select-none ${className} ${
        !isValidSrc
          ? 'bg-gradient-to-tr from-[#c34c36] to-[#fce5da] text-white shadow-xs'
          : ''
      }`}
    >
      {isValidSrc ? (
        <img
          src={src!}
          alt={alt || name || 'Avatar'}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <span className={`leading-none ${defaultTextClass}`}>
          {initial}
        </span>
      )}
    </div>
  );
};

export default UserAvatar;
