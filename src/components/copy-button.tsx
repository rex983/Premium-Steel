"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

/** What a price copies as: plain "1234.56", so it pastes into number fields too. */
export function copyAmount(n: number): string {
  return n.toFixed(2);
}

/** Small "copy" box beside a line item or price. Never printed. */
export function CopyButton({ text, what }: { text: string; what: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API blocked: fall back to a hidden field + execCommand.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } finally {
        ta.remove();
      }
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Copied" : `Copy ${what}`}
      aria-label={copied ? "Copied" : `Copy ${what}`}
      className={`print:hidden inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border align-middle transition-colors ${
        copied
          ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-border text-muted-foreground hover:border-primary hover:bg-primary/10 hover:text-primary"
      }`}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

/** A price with its copy box: "$1,234.56 [copy]". */
export function CopyPrice({ amount, what }: { amount: number; what: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {formatCurrency(amount)}
      <CopyButton text={copyAmount(amount)} what={`${what} price`} />
    </span>
  );
}

/** A line-item name with its copy box. */
export function CopyLabel({ text, truncate }: { text: string; truncate?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className={truncate ? "truncate" : undefined}>{text}</span>
      <CopyButton text={text} what={`"${text}"`} />
    </span>
  );
}
