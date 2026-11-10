import Image from "next/image";
import Link from "next/link";

export function Mark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`relative inline-flex shrink-0 overflow-hidden rounded-2xl bg-white ${compact ? "h-10 w-10" : "h-[76px] w-[76px]"}`}>
      <Image src="/poultry-farm-logo.jpeg" alt="Poultry Farm logo" fill sizes={compact ? "40px" : "76px"} priority className="object-contain" />
    </span>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex min-w-0 items-center gap-3" aria-label="Poultry Centre dashboard">
      <Mark compact={compact} />
      {!compact && <span className="min-w-0 leading-tight"><span className="block text-[15px] font-extrabold tracking-[.045em] text-white">POULTRY CENTRE</span><span className="mt-1 block text-[10px] font-medium tracking-[.13em] text-emerald-200">SHOP MANAGEMENT</span></span>}
    </Link>
  );
}
