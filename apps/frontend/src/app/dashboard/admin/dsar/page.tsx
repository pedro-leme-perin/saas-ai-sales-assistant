"use client";

// =============================================
// 🛡️ DSAR admin page (Session 60a) — LGPD Art. 18
// =============================================
// Lista solicitações DSAR + cria + aprova/rejeita + re-emite download URL.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ShieldCheck,
  ShieldX,
  Download,
  Plus,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  dsarService,
  type CreateDsarPayload,
  type DsarRequestRow,
  type DsarStatus,
  type DsarType,
  type ListDsarFilters,
} from "@/services/dsar.service";

const STATUS_BADGE: Record<DsarStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 border border-amber-200",
  APPROVED: "bg-blue-100 text-blue-800 border border-blue-200",
  REJECTED: "bg-rose-100 text-rose-800 border border-rose-200",
  PROCESSING: "bg-violet-100 text-violet-800 border border-violet-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  EXPIRED: "bg-zinc-100 text-zinc-700 border border-zinc-200",
  FAILED: "bg-red-100 text-red-800 border border-red-200",
};

const TYPE_LABEL: Record<DsarType, string> = {
  ACCESS: "Art. 18 II — Acesso",
  PORTABILITY: "Art. 18 V — Portabilidade",
  CORRECTION: "Art. 18 III — Correção",
  DELETION: "Art. 18 VI — Eliminação",
  INFO: "Art. 18 VII — Informação",
};

interface FormState extends CreateDsarPayload {}

const EMPTY_FORM: FormState = {
  type: "ACCESS",
  requesterEmail: "",
};

function canApprove(role: string): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MANAGER";
}

function canCreateOrDownload(role: string): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export default function DsarAdminPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [filters, setFilters] = useState<ListDsarFilters>({ limit: 25, offset: 0 });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["dsar-list", filters],
    queryFn: () => dsarService.list(filters),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateDsarPayload) => dsarService.create(payload),
    onSuccess: () => {
      toast.success(t("dsar.toast.created"));
      setShowCreate(false);
      setForm(EMPTY_FORM);
      qc.invalidateQueries({ queryKey: ["dsar-list"] });
    },
    onError: (err: Error) => toast.error(err.message ?? "Failed to create DSAR"),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => dsarService.approve(id),
    onSuccess: () => {
      toast.success(t("dsar.toast.approved"));
      qc.invalidateQueries({ queryKey: ["dsar-list"] });
    },
    onError: (err: Error) => toast.error(err.message ?? "Approve failed"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      dsarService.reject(id, reason),
    onSuccess: () => {
      toast.success(t("dsar.toast.rejected"));
      setRejectingId(null);
      setRejectReason("");
      qc.invalidateQueries({ queryKey: ["dsar-list"] });
    },
    onError: (err: Error) => toast.error(err.message ?? "Reject failed"),
  });

  const downloadMutation = useMutation({
    mutationFn: (id: string) => dsarService.download(id),
    onSuccess: (res) => {
      window.open(res.downloadUrl, "_blank", "noopener,noreferrer");
    },
    onError: (err: Error) => toast.error(err.message ?? "Download failed"),
  });

  const items: DsarRequestRow[] = useMemo(() => data?.items ?? [], [data]);
  const role = user?.role ?? "";

  function submitCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.requesterEmail.trim()) {
      toast.error(t("dsar.errors.emailRequired"));
      return;
    }
    if (form.type === "CORRECTION" && !form.correctionPayload) {
      toast.error(t("dsar.errors.correctionPayloadRequired"));
      return;
    }
    createMutation.mutate(form);
  }

  function submitReject(id: string) {
    if (rejectReason.trim().length < 5) {
      toast.error(t("dsar.errors.rejectReasonShort"));
      return;
    }
    rejectMutation.mutate({ id, reason: rejectReason.trim() });
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-800 mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t("common.back")}
          </Link>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
            {t("dsar.title")}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">{t("dsar.subtitle")}</p>
        </div>
        {canCreateOrDownload(role) && (
          <Button onClick={() => setShowCreate((v) => !v)}>
            <Plus className="h-4 w-4 mr-1" />
            {t("dsar.actions.create")}
          </Button>
        )}
      </div>

      {showCreate && canCreateOrDownload(role) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("dsar.create.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-sm">
                <span className="text-zinc-700 font-medium">{t("dsar.fields.type")}</span>
                <select
                  className="mt-1 w-full border rounded-md px-3 py-2 bg-background text-foreground text-sm"
                  value={form.type}
                  onChange={(e) =>
                    setForm({ ...form, type: e.target.value as DsarType, correctionPayload: undefined })
                  }
                >
                  {(Object.keys(TYPE_LABEL) as DsarType[]).map((tp) => (
                    <option key={tp} value={tp}>
                      {TYPE_LABEL[tp]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="text-zinc-700 font-medium">{t("dsar.fields.email")}</span>
                <input
                  type="email"
                  required
                  className="mt-1 w-full border rounded-md px-3 py-2 bg-background text-foreground text-sm"
                  value={form.requesterEmail}
                  onChange={(e) => setForm({ ...form, requesterEmail: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="text-zinc-700 font-medium">{t("dsar.fields.name")}</span>
                <input
                  className="mt-1 w-full border rounded-md px-3 py-2 bg-background text-foreground text-sm"
                  value={form.requesterName ?? ""}
                  onChange={(e) => setForm({ ...form, requesterName: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="text-zinc-700 font-medium">{t("dsar.fields.cpf")}</span>
                <input
                  className="mt-1 w-full border rounded-md px-3 py-2 bg-background text-foreground text-sm"
                  placeholder="XXX.XXX.XXX-XX"
                  value={form.cpf ?? ""}
                  onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="text-zinc-700 font-medium">{t("dsar.fields.notes")}</span>
                <textarea
                  className="mt-1 w-full border rounded-md px-3 py-2 bg-background text-foreground text-sm"
                  rows={2}
                  value={form.notes ?? ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>

              {form.type === "CORRECTION" && (
                <div className="md:col-span-2 border-t border-zinc-200 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <p className="md:col-span-2 text-xs text-zinc-500 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {t("dsar.create.correctionHint")}
                  </p>
                  <CorrectionField
                    label={t("dsar.fields.correction.name")}
                    value={form.correctionPayload?.name ?? ""}
                    onChange={(v) =>
                      setForm({
                        ...form,
                        correctionPayload: { ...(form.correctionPayload ?? {}), name: v || null },
                      })
                    }
                  />
                  <CorrectionField
                    label={t("dsar.fields.correction.email")}
                    value={form.correctionPayload?.email ?? ""}
                    onChange={(v) =>
                      setForm({
                        ...form,
                        correctionPayload: { ...(form.correctionPayload ?? {}), email: v || null },
                      })
                    }
                  />
                  <CorrectionField
                    label={t("dsar.fields.correction.phone")}
                    value={form.correctionPayload?.phone ?? ""}
                    onChange={(v) =>
                      setForm({
                        ...form,
                        correctionPayload: { ...(form.correctionPayload ?? {}), phone: v || null },
                      })
                    }
                  />
                  <CorrectionField
                    label={t("dsar.fields.correction.timezone")}
                    value={form.correctionPayload?.timezone ?? ""}
                    onChange={(v) =>
                      setForm({
                        ...form,
                        correctionPayload: { ...(form.correctionPayload ?? {}), timezone: v || null },
                      })
                    }
                  />
                </div>
              )}

              <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  {t("dsar.actions.create")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t("dsar.list.title")}</span>
            <FilterBar filters={filters} setFilters={setFilters} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              {t("common.loading")}
            </div>
          )}
          {error && (
            <div className="text-rose-700 text-sm py-6">{(error as Error).message}</div>
          )}
          {!isLoading && !error && items.length === 0 && (
            <div className="py-12 text-center text-zinc-500 text-sm">
              {t("dsar.list.empty")}
            </div>
          )}
          {items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-zinc-500 border-b border-zinc-200">
                  <tr>
                    <th className="text-left py-2 pr-4">{t("dsar.cols.requester")}</th>
                    <th className="text-left py-2 pr-4">{t("dsar.cols.type")}</th>
                    <th className="text-left py-2 pr-4">{t("dsar.cols.status")}</th>
                    <th className="text-left py-2 pr-4">{t("dsar.cols.requestedAt")}</th>
                    <th className="text-left py-2 pr-4">{t("dsar.cols.expiresAt")}</th>
                    <th className="text-right py-2">{t("dsar.cols.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                      <td className="py-3 pr-4">
                        <div className="font-medium">{row.requesterName ?? row.requesterEmail}</div>
                        {row.requesterName && (
                          <div className="text-xs text-zinc-500">{row.requesterEmail}</div>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-zinc-600">{TYPE_LABEL[row.type]}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${STATUS_BADGE[row.status]}`}
                        >
                          {row.status === "PENDING" && <Clock className="h-3 w-3" />}
                          {row.status === "COMPLETED" && <CheckCircle2 className="h-3 w-3" />}
                          {row.status === "REJECTED" && <XCircle className="h-3 w-3" />}
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-zinc-600">
                        {new Date(row.requestedAt).toLocaleString()}
                      </td>
                      <td className="py-3 pr-4 text-zinc-600">
                        {row.expiresAt ? new Date(row.expiresAt).toLocaleString() : "—"}
                      </td>
                      <td className="py-3 text-right space-x-2">
                        {row.status === "PENDING" && canApprove(role) && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => approveMutation.mutate(row.id)}
                              disabled={approveMutation.isPending}
                            >
                              <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                              {t("dsar.actions.approve")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setRejectingId(row.id);
                                setRejectReason("");
                              }}
                            >
                              <ShieldX className="h-3.5 w-3.5 mr-1" />
                              {t("dsar.actions.reject")}
                            </Button>
                          </>
                        )}
                        {row.status === "COMPLETED" &&
                          row.artifactKey &&
                          canCreateOrDownload(role) && (
                            <Button
                              size="sm"
                              onClick={() => downloadMutation.mutate(row.id)}
                              disabled={downloadMutation.isPending}
                            >
                              <Download className="h-3.5 w-3.5 mr-1" />
                              {t("dsar.actions.download")}
                            </Button>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {rejectingId && (
        <RejectModal
          onClose={() => {
            setRejectingId(null);
            setRejectReason("");
          }}
          reason={rejectReason}
          setReason={setRejectReason}
          onSubmit={() => submitReject(rejectingId)}
          pending={rejectMutation.isPending}
          t={t}
        />
      )}
    </div>
  );
}

interface CorrectionFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}
function CorrectionField({ label, value, onChange }: CorrectionFieldProps) {
  return (
    <label className="text-sm">
      <span className="text-zinc-700 font-medium">{label}</span>
      <input
        className="mt-1 w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

interface FilterBarProps {
  filters: ListDsarFilters;
  setFilters: (f: ListDsarFilters) => void;
}
function FilterBar({ filters, setFilters }: FilterBarProps) {
  return (
    <div className="flex items-center gap-2 text-sm font-normal">
      <select
        className="border border-zinc-300 rounded-md px-2 py-1 text-xs"
        value={filters.status ?? ""}
        onChange={(e) =>
          setFilters({
            ...filters,
            status: (e.target.value || undefined) as DsarStatus | undefined,
            offset: 0,
          })
        }
      >
        <option value="">All statuses</option>
        {(["PENDING", "APPROVED", "PROCESSING", "COMPLETED", "REJECTED", "EXPIRED", "FAILED"] as DsarStatus[]).map(
          (s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ),
        )}
      </select>
      <select
        className="border border-zinc-300 rounded-md px-2 py-1 text-xs"
        value={filters.type ?? ""}
        onChange={(e) =>
          setFilters({ ...filters, type: (e.target.value || undefined) as DsarType | undefined, offset: 0 })
        }
      >
        <option value="">All types</option>
        {(["ACCESS", "PORTABILITY", "CORRECTION", "DELETION", "INFO"] as DsarType[]).map((tp) => (
          <option key={tp} value={tp}>
            {tp}
          </option>
        ))}
      </select>
    </div>
  );
}

interface RejectModalProps {
  onClose: () => void;
  reason: string;
  setReason: (s: string) => void;
  onSubmit: () => void;
  pending: boolean;
  t: ReturnType<typeof useTranslation>["t"];
}
function RejectModal({ onClose, reason, setReason, onSubmit, pending, t }: RejectModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <ShieldX className="h-5 w-5 text-rose-600" />
          {t("dsar.reject.title")}
        </h2>
        <p className="text-xs text-zinc-500 mb-4">{t("dsar.reject.subtitle")}</p>
        <textarea
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
          rows={4}
          minLength={5}
          maxLength={2000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("dsar.reject.placeholder")}
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {t("dsar.actions.reject