"use client";

import { Fragment, type ReactNode } from "react";

import { sourceDomain } from "@/lib/research-report";

/** A citation shrunk to its domain; the full title and URL stay on hover. */
export function SourceChip({ url, title }: { url: string; title?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title={title && title !== url ? `${title}\n${url}` : url}
      className="mx-0.5 inline-flex max-w-[14rem] items-center rounded-full border border-teal-600/20 bg-teal-500/10 px-2 align-baseline text-[11px] font-medium leading-5 text-teal-800 hover:bg-teal-500/20 dark:border-teal-300/20 dark:text-teal-200"
    >
      <span className="truncate">{sourceDomain(url)}</span>
    </a>
  );
}

// Order matters: a cited link wrapped in parentheses must win over the bare link inside it.
const INLINE = new RegExp(
  [
    String.raw`\(\s*\[([^\]]+)\]\((https?://[^\s)]+)\)\s*\)`, // ([title](url))
    String.raw`\[([^\]]+)\]\((https?://[^\s)]+)\)`, // [title](url)
    String.raw`\(\s*(https?://[^\s)]+)\s*\)`, // (url)
    String.raw`(https?://[^\s<>()\[\]]+)`, // url
    String.raw`\*\*([^*]+)\*\*`, // **bold**
  ].join("|"),
  "g",
);

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const key = `${start}`;
    if (m[2]) out.push(<SourceChip key={key} url={m[2]} title={m[1]} />);
    else if (m[4]) out.push(<SourceChip key={key} url={m[4]} title={m[3]} />);
    else if (m[5]) out.push(<SourceChip key={key} url={m[5]} />);
    else if (m[6]) {
      // Bare URLs often end a sentence: keep trailing punctuation out of the link.
      const url = m[6].replace(/[.,;:!?]+$/, "");
      out.push(<SourceChip key={key} url={url} />);
      out.push(m[6].slice(url.length));
    } else if (m[7]) out.push(<strong key={key} className="font-semibold">{m[7]}</strong>);
    last = start + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;
const HEADING = /^\s*#{1,6}\s+/;

type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "ul"; items: string[] };

function blocks(source: string): Block[] {
  const out: Block[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (para.length) out.push({ kind: "p", text: para.join(" ") });
    if (list.length) out.push({ kind: "ul", items: list });
    para = [];
    list = [];
  };
  for (const raw of source.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
    } else if (HEADING.test(line)) {
      flush();
      out.push({ kind: "h", text: line.replace(HEADING, "") });
    } else if (BULLET.test(line)) {
      if (para.length) flush();
      list.push(line.replace(BULLET, ""));
    } else {
      if (list.length) flush();
      para.push(line);
    }
  }
  flush();
  return out;
}

/** Model-written report text: paragraphs, bullets, headings, bold, and links as domain chips. */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`space-y-2 text-sm leading-6 ${className}`}>
      {blocks(text).map((b, i) => (
        <Fragment key={i}>
          {b.kind === "p" ? <p>{inline(b.text)}</p> : null}
          {b.kind === "h" ? (
            <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
              {inline(b.text)}
            </p>
          ) : null}
          {b.kind === "ul" ? (
            <ul className="list-disc space-y-1 pl-5 marker:text-black/30 dark:marker:text-white/30">
              {b.items.map((item, j) => (
                <li key={j}>{inline(item)}</li>
              ))}
            </ul>
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}
