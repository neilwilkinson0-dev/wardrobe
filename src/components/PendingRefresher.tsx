"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Polls the current route while any item is still classifying in the
 * background, so pending badges/banners clear on their own once the async
 * job finishes — no manual reload needed.
 */
export default function PendingRefresher({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(interval);
  }, [active, router]);

  return null;
}
