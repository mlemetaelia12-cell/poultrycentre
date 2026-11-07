import Link from "next/link";

export function Mark({ compact = false }: { compact?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="Poultry Centre mark" className={compact ? "h-9 w-9" : "h-11 w-11"}>
      <rect x="1" y="1" width="46" height="46" rx="15" fill="#14532d" />
      <path d="M12 28.5c0-7.1 5.2-12.4 12-12.4 4.7 0 8.7 2.5 10.7 6.4l-4.5 2.1c-1.2-2.3-3.4-3.7-6.2-3.7-4 0-7 3.1-7 7.5 0 4.1 2.9 7.1 7 7.1 2.5 0 4.6-1.1 5.9-3.1l4.3 2.5c-2.2 3.5-5.9 5.7-10.4 5.7-6.8 0-11.8-5.1-11.8-12.1Z" fill="#fff" transform="translate(0 -3)" />
      <path d="M28.5 12.8c1.1-3.8 5.1-4.7 7.2-2.6 2 2 1.2 5.8-2.3 7.1l-4.9-4.5Z" fill="#86efac" />
      <path d="M30.2 29.5h8.2l-4.1 4.6-4.1-4.6Z" fill="#86efac" />
      <circle cx="26.1" cy="23.3" r="1.2" fill="#14532d" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-3" aria-label="Poultry Centre dashboard">
      <Mark compact={compact} />
      {!compact && <span className="leading-tight"><span className="block text-[15px] font-extrabold tracking-[.06em] text-white">POULTRY CENTRE</span><span className="mt-1 block text-[10px] font-medium tracking-[.16em] text-emerald-200">VETERINARY BUSINESS</span></span>}
    </Link>
  );
}
