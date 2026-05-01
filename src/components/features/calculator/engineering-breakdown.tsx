"use client";

import { useState } from "react";
import type { SnowEngineeringBreakdown } from "@/lib/pricing/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export function EngineeringBreakdownPanel({ breakdown }: { breakdown: SnowEngineeringBreakdown }) {
  const [open, setOpen] = useState(true);

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setOpen((o) => !o)}>
        <div className="flex justify-between items-center">
          <h3 className="text-base font-semibold">Engineering Breakdown</h3>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
        <p className="text-xs text-muted-foreground">
          Total: {formatCurrency(breakdown.totalEngineering)}
        </p>
      </CardHeader>
      {open && (
        <CardContent className="text-xs space-y-2">
          <Section
            title="Trusses"
            spacing={breakdown.trussSpacing}
            original={breakdown.originalTrusses}
            extra={breakdown.extraTrussesNeeded}
            price={breakdown.trussPrice}
          />
          <Section
            title="Hat Channels"
            spacing={breakdown.hatChannelSpacing}
            original={breakdown.originalHatChannels}
            extra={breakdown.extraChannelsNeeded}
            price={breakdown.hatChannelPrice}
          />
          <Section
            title="Girts"
            spacing={breakdown.girtSpacing}
            original={breakdown.originalGirts}
            extra={breakdown.extraGirtsNeeded}
            price={breakdown.girtPrice}
          />
          <Section
            title="Verticals"
            spacing={breakdown.verticalSpacing}
            original={breakdown.originalVerticals}
            extra={breakdown.extraVerticalsNeeded}
            price={breakdown.verticalPrice}
          />
        </CardContent>
      )}
    </Card>
  );
}

function Section({
  title, spacing, original, extra, price,
}: { title: string; spacing: string; original: number; extra: number; price: number }) {
  return (
    <div className="grid grid-cols-4 gap-2 py-1 border-b last:border-b-0">
      <div className="font-medium">{title}</div>
      <div className="text-muted-foreground">{spacing}</div>
      <div className="text-muted-foreground">+{extra} (orig {original})</div>
      <div className="text-right font-mono">{formatCurrency(price)}</div>
    </div>
  );
}
