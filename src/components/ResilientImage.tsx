import React, { useEffect, useState } from 'react';
import { Mountain } from 'lucide-react';
import { resolveAssetUrl } from '../utils/assetMap';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export const ResilientImage: React.FC<ResilientImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-cover',
  fallbackTitle,
}) => {
  const [hasError, setHasError] = useState(false);
  const resolved = resolveAssetUrl(src);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (hasError || !resolved) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#1B3B2B] via-[#234B37] to-[#2E6047] text-[#F6F5F0]/80 p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Mountain className="w-7 h-7 mb-2 opacity-75" aria-hidden="true" />
        <span className="text-xs font-medium tracking-tight opacity-90 line-clamp-2">
          {fallbackTitle || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={resolved}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  );
};
