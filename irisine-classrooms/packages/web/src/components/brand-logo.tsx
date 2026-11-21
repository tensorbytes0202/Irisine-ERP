import { brand } from '@/lib/brand';

/** Logo icon + naam. `showText={false}` karne par sirf icon dikhta hai (collapsed sidebar). */
export function BrandLogo({
  showText = true,
  size = 36,
  className = '',
  light = false,
}: {
  showText?: boolean;
  size?: number;
  className?: string;
  light?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={brand.logoIcon} alt="" width={size} height={size} className="shrink-0" />
      {showText && (
        <span
          className={`font-bold tracking-tight text-lg leading-none ${
            light ? 'text-white' : 'text-foreground'
          }`}
        >
          {brand.shortName}{' '}
          <span className={light ? 'font-medium text-white/80' : 'font-medium text-primary'}>
            Classrooms
          </span>
        </span>
      )}
    </span>
  );
}
