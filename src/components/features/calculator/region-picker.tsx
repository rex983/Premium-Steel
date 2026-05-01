"use client";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Region } from "@/hooks/use-regions";

export interface RegionPickerProps {
  regions: Region[];
  selectedRegionId: string | null;
  onChange: (id: string) => void;
}

export function RegionPicker({ regions, selectedRegionId, onChange }: RegionPickerProps) {
  return (
    <div className="space-y-1 max-w-sm">
      <Label className="text-xs">Region</Label>
      <Select value={selectedRegionId ?? ""} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Pick a region..." />
        </SelectTrigger>
        <SelectContent>
          {regions.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.name} — {r.states.join(", ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
