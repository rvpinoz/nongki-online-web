import Link from "next/link";
import { Video } from "lucide-react";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-white">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-ink-950">
        <Video className="h-4 w-4" />
      </span>
      MeetLite
    </Link>
  );
}
