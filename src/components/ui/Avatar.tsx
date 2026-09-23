import { initials } from '@/lib/format';
import { cn } from '@/lib/cn';

export function Avatar({
  name,
  color = '#1CA672',
  size = 36,
  className,
}: {
  name: string;
  color?: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-white', className)}
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </div>
  );
}
