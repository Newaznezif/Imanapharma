/**
 * PharmacyLogo — shared component used in every header / sidebar / profile.
 * Serves the real logo.png from the backend /uploads directory.
 * Falls back to a styled pill icon if the image is unavailable.
 */
import { Pill } from 'lucide-react';

const BACKEND = 'http://localhost:5001';

/** Build the absolute URL for whatever logo_url comes from the API */
export function resolveLogoUrl(logo_url?: string | null): string {
  if (!logo_url) return `${BACKEND}/uploads/logo.png`;
  // Already absolute
  if (logo_url.startsWith('http')) return logo_url;
  // Relative path — prefix the backend origin
  return `${BACKEND}${logo_url.startsWith('/') ? '' : '/'}${logo_url}`;
}

interface PharmacyLogoProps {
  /** The logo_url field from pharmacyInfo / settings API */
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
  logoUrl,
  size = 40,
  className = '',
  shape = 'circle',
  bordered = true,
}: PharmacyLogoProps) {
  const shapeClass =
    shape === 'circle' ? 'rounded-full' : shape === 'rounded' ? 'rounded-xl' : 'rounded-md';

  const borderClass = bordered ? 'border border-gray-200 shadow-sm' : '';

  return (
    <div
      className={`bg-white ${shapeClass} ${borderClass} flex items-center justify-center overflow-hidden shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={resolveLogoUrl(logoUrl)}
        alt="Imana Pharmacy Logo"
        className="w-full h-full object-contain p-0.5"
        onError={(e) => {
          // On load failure — hide img and show pill icon fallback
          const img = e.currentTarget;
          img.style.display = 'none';
          const fallback = img.nextElementSibling as HTMLElement | null;
          if (fallback) fallback.style.display = 'flex';
        }}
      />
      {/* Fallback icon (hidden by default, shown when img fails) */}
      <span
        style={{ display: 'none', width: '100%', height: '100%' }}
        className="items-center justify-center text-blue-600"
      >
        <Pill size={Math.round(size * 0.5)} />
      </span>
    </div>
  );
}
