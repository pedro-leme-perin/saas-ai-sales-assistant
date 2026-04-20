"use client";

// =============================================
// 📥 CONTACTS IMPORT PAGE (Session 54 — Feature A1)
// =============================================

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import { dataImportService } from "@/services/data-import.service";
import {
  backgroundJobsService,
  type BackgroundJob,
} from "@/services/background-jobs.service";

const TERMINAL_STATUSES: BackgroundJob["status"][] = [
  "SUCCEEDED",
  "FAILED",
  "DEAD_LETTER",
  "CANCELED",
];

export default function ContactsImportPage() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);

  const enqueueMutation = useMutation({
    mutationFn: (csv: string) => dataImportService.enqueueContacts(csv),
    onSuccess: (res) => {
      setJobId(res.jobId);
      toast.success(t("dataImport.toast.success"));
    },
    onError: () => toast.error(t("dataImport.toast.error")),
  });

  const { data: job } = useQuery<BackgroundJob>({
    queryKey: ["bg-job", jobId],
    queryFn: () => backgroundJobsService.findById(jobId!),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const data = q.state.data as BackgroundJob | undefined;
      if (!data) return 2000;
      return TERMINAL_STATUSES.includes(data.status) ? false : 2000;
    },
  });

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setCsvContent(text);
      setFileName(file.name);
      // Quick row count: non-empty lines minus header
      const nonEmpty = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      setRowCount(Math.max(0, nonEmpty.length - 1));
      setJobId(null);
    };
    reader.readAsText(file);
  }, []);

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const submit = () => {
    if (!csvContent) return;
    enqueueMutation.mutate(csvContent);
  };

  const reset = () => {
    setCsvContent(null);
    setFileName(null);
    setRowCount(0);
    setJobId(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const isTerminal = job && TERMINAL_STATUSES.includes(job.status);
  const progress = job?.progress ?? 0;
  const result = job?.result as
    | {
        imported?: number;
        skipped?: number;
        errors?: Array<{ row: number; reason: string }>;
      }
    | null
    | undefined;

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{t("dataImport.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("dataImport.subtitle")}
          </p>
        </div>
      </div>

      {!jobId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("dataImport.dropzone")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-muted rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">
                {t("dataImport.selectFile")}
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={onBrowse}
              />
            </div>

            {fileName && (
              <div className="mt-4 flex items-center justify-between p-3 rounded-md bg-muted/50 border">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{fileName}</span>
                  <span className="text-xs text-muted-foreground">
                    ({rowCount} {t("dataImport.rowCount")})
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={reset}
                    disabled={enqueueMutation.isPending}
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={submit}
                    disabled={enqueueMutation.isPending || rowCount === 0}
                  >
                    {enqueueMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      t("dataImport.submit")
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {jobId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {job?.status === "SUCCEEDED" && (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              )}
              {job?.status === "FAILED" || job?.status === "DEAD_LETTER" ? (
                <AlertTriangle className="w-5 h-5 text-red-500" />
              ) : null}
              {!isTerminal && <Loader2 className="w-5 h-5 animate-spin" />}
              {t("dataImport.progress")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium">{job?.status ?? "PENDING"}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-muted rounded overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {isTerminal && result && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded border">
                    <div className="text-xs text-muted-foreground">
                      {t("dataImport.imported")}
                    </div>
                    <div className="text-2xl font-bold text-emerald-600">
                      {result.imported ?? 0}
                    </div>
                  </div>
                  <div className="p-3 rounded border">
                    <div className="text-xs text-muted-foreground">
                      {t("dataImport.skipped")}
                    </div>
                    <div className="text-2xl font-bold text-amber-600">
                      {result.skipped ?? 0}
                    </div>
                  </div>
                </div>

                {result.errors && result.errors.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">
                      {t("dataImport.errors")}
                    </div>
                    <div className="border rounded overflow-hidden max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left p-2">
                              {t("dataImport.col.row")}
                            </th>
                            <th className="text-left p-2">
                              {t("dataImport.col.reason")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.errors.map((e, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-2 font-mono">{e.row}</td>
                              <td className="p-2">{e.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isTerminal && job?.lastError && (
              <div className="p-3 rounded border border-red-200 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-xs font-mono">
                {job.lastError}
              </div>
            )}

            {isTerminal && (
              <Button variant="outline" onClick={reset} className="w-full">
                {t("dataImport.another")}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
