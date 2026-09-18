"use client";

/**
 * Client-only mount for the /movil app. The dictation UI is 100% browser
 * state (localStorage settings, MediaRecorder, navigator.share…), so
 * server-rendering it only creates hydration mismatches. `ssr: false` lets
 * <MobileDictation /> read the browser APIs in its initializers.
 */
import dynamic from "next/dynamic";

const MobileDictation = dynamic(
  () => import("./MobileDictation").then((m) => m.MobileDictation),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg text-fg">
        <div className="wave" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <i key={i} style={{ animationDelay: `${i * 90}ms` }} />
          ))}
        </div>
      </div>
    ),
  },
);

export function MovilClient({ apiBase }: { apiBase: string }) {
  return <MobileDictation apiBase={apiBase} />;
}
