/**
 * PharmacyLogo — shared component used in every header / sidebar / profile.
 * Uses /logo.png served from the frontend public folder (copied from uploads/logo.png).
 * Falls back to a styled pill icon if the image is unavailable.
 */
import { useState } from 'react';
import { Pill } from 'lucide-react';

interface PharmacyLogoProps {
  /** Optional — kept for API compatibility but the real file is always /logo.png */
  logoUrl?: string | null;
  /** Diameter in px (used for both width and height). Default 40 */
  size?: number;
  /** Additional wrapper className */
  className?: string;
  /** Shape: 'circle' | 'rounded' | 'square'. Default 'circle' */
  shape?: 'circle' | 'rounded' | 'square';
  /** Whether to show a ring / border. Default true */
  bordered?: boolean;
}

export default function PharmacyLogo({
  size = 40,
  className = '',
  shape = 'circle',
  bordered = true,
}: PharmacyLogoProps) {
  const [failed, setFailed] = useState(false);

  const shapeClass =
    shape === 'circle' ? 'rounded-full' : shape === 'rounded' ? 'rounded-xl' : 'rounded-md';
  const borderClass = bordered ? 'border border-gray-200 shadow-sm' : '';

  return (
    <div
      className={`bg-white ${shapeClass} ${borderClass} flex items-center justify-center overflow-hidden shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {!failed ? (
        <img
          src="/logo.png"
          alt="Imana Pharmacy Logo"
          className="w-full h-full object-contain p-0.5"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="flex items-center justify-center text-blue-600" style={{ width: '100%', height: '100%' }}>
          <Pill size={Math.round(size * 0.5)} />
        </span>
      )}
    </div>
  );
}
