import Link from "next/link";

import { CardShell } from "@/components/cards/CardShell";
import { FIXTURES } from "@/components/cards/fixtures";

// Fixture gallery: every renderer against real engine output, without the agent running.
export default function CardsGallery() {
  return (
    <main className="mx-auto w-full max-w-7xl p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold">Comparison card fixtures ({FIXTURES.length})</h1>
        <Link href="/" className="text-sm text-black/50 underline-offset-2 hover:underline dark:text-white/50">
          ← Back to the Buddies
        </Link>
      </header>
      <div className="grid gap-4 xl:grid-cols-2">
        {FIXTURES.map(({ name, card }) => (
          <section key={name} className={card.metrics.length > 6 ? "min-w-0 xl:col-span-2" : "min-w-0"}>
            <p className="mb-1 font-mono text-[11px] text-black/40 dark:text-white/40">{name}</p>
            <CardShell card={card} />
          </section>
        ))}
      </div>
    </main>
  );
}
