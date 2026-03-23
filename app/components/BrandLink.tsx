import Image from "next/image";
import Link from "next/link";

export function BrandLink({
  href,
  subtitle = "Voice Intelligence",
}: {
  href: string;
  subtitle?: string;
}) {
  return (
    <Link href={href} className="inline-flex items-center gap-3">
      <Image
        src="/logo.png"
        alt="Voxly logo"
        className="h-10 w-10 object-contain"
        width={40}
        height={40}
        priority
      />
      <span>
        <span className="block text-sm font-bold tracking-tight text-slate-900">
          Voxly
        </span>
        <span className="block text-[11px] uppercase tracking-[0.2em] text-slate-500">
          {subtitle}
        </span>
      </span>
    </Link>
  );
}
