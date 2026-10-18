import Link from "next/link";

import WorldRadarMap from "@/components/ui/world-radar-map";

// Landing page: a world map of container ships on radar, and one way in.
export default function Landing() {
  return (
    <main className="flex-1 font-sans">
      <WorldRadarMap height="100dvh">
        <div className="grid h-full place-items-center">
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-3 rounded-sm text-2xl font-medium tracking-tight text-white/90 [text-shadow:0_0_24px_rgb(3_5_6/0.9)] transition-colors hover:text-[#5cf2c6] focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-[#5cf2c6] sm:text-3xl"
          >
            Start now
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-6 transition-transform duration-300 group-hover:translate-x-1.5 sm:size-7"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </WorldRadarMap>
    </main>
  );
}
