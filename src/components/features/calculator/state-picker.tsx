"use client";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { StateDefault } from "@/hooks/use-state-defaults";

export interface StatePickerProps {
  states: StateDefault[];
  value: string;
  onChange: (stateCode: string) => void;
}

const STATE_LABEL: Record<string, string> = {
  IN: "Indiana", OH: "Ohio", IL: "Illinois", KY: "Kentucky", TN: "Tennessee",
  MO: "Missouri", WV: "West Virginia",
  MI: "Michigan", WI: "Wisconsin", PA: "Pennsylvania", MN: "Minnesota",
};

export function StatePicker({ states, value, onChange }: StatePickerProps) {
  return (
    <div className="space-y-1 max-w-sm">
      <Label className="text-xs">State</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Pick a state..." />
        </SelectTrigger>
        <SelectContent>
          {states.map((s) => (
            <SelectItem key={s.state_code} value={s.state_code}>
              {STATE_LABEL[s.state_code] ?? s.state_code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
