import Link from "next/link";
import { Coffee } from "lucide-react";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-white">
      <span className="grid h-9 w-9 -rotate-6 place-items-center rounded-xl bg-accent text-ink-950 shadow-[3px_3px_0_0_var(--color-danger)]">
        <Coffee className="h-5 w-5" strokeWidth={2.5} />
      </span>
      <span>
        Nongki<span className="text-danger">Online</span>
      </span>
    </Link>
  );
}
