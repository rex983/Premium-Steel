"use client";

import { useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import {
  Card, CardContent, CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Upload as UploadIcon, CheckCircle2, AlertCircle } from "lucide-react";
import { useRegions } from "@/hooks/use-regions";

type Status = "idle" | "uploading" | "success" | "error";

interface UploadResponse {
  ok?: boolean;
  pricing?: { id: string; version: number };
  detection?: { region: string; states: string[]; confidence: string; reasons: string[] };
  warnings?: string[];
  error?: string;
}

export default function UploadPage() {
  const { regions, loading } = useRegions();
  const [regionId, setRegionId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [response, setResponse] = useState<UploadResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!regionId && regions.length > 0) setRegionId(regions[0].id);
  }, [regions, regionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !regionId) return;
    setStatus("uploading");
    setResponse(null);
    const form = new FormData();
    form.set("file", file);
    form.set("regionId", regionId);
    const res = await fetch("/api/admin/upload", { method: "POST", body: form });
    const json: UploadResponse = await res.json();
    setResponse(json);
    setStatus(res.ok ? "success" : "error");
    if (res.ok) {
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <AppHeader title="Upload Pricing" />
      <main className="flex-1 p-6 space-y-4">
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">
              Upload a PSB workbook (.xlsx) for a specific region. The parser auto-detects
              south vs north and validates the file's states overlap with the target region.
              On success, the new version is automatically activated.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
              <div className="space-y-1">
                <Label className="text-xs">Region</Label>
                <Select value={regionId} onValueChange={setRegionId} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a region…" />
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
              <div className="space-y-1">
                <Label className="text-xs">PSB Workbook (.xlsx)</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
              </div>
              <Button type="submit" disabled={!file || !regionId || status === "uploading"}>
                <UploadIcon className="h-4 w-4 mr-1" />
                {status === "uploading" ? "Uploading…" : "Upload & Activate"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {response && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                {status === "success" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                <h3 className="font-semibold">
                  {status === "success" ? "Upload Successful" : "Upload Failed"}
                </h3>
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {response.error && (
                <div className="text-destructive">{response.error}</div>
              )}
              {response.detection && (
                <div className="space-y-1">
                  <div>
                    <span className="text-muted-foreground">Detected region: </span>
                    <span className="font-medium">{response.detection.region}</span>{" "}
                    <span className="text-xs text-muted-foreground">({response.detection.confidence} confidence)</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">States: </span>
                    <span>{response.detection.states.join(", ") || "—"}</span>
                  </div>
                  <ul className="text-xs text-muted-foreground list-disc ml-4">
                    {response.detection.reasons.map((r) => <li key={r}>{r}</li>)}
                  </ul>
                </div>
              )}
              {response.pricing && (
                <div>
                  <span className="text-muted-foreground">Active version: </span>
                  <span className="font-medium">v{response.pricing.version}</span>
                </div>
              )}
              {response.warnings && response.warnings.length > 0 && (
                <div className="text-xs text-amber-600">
                  Warnings: {response.warnings.join("; ")}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
