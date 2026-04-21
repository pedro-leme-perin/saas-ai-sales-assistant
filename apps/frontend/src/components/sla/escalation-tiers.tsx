"use client";

// =============================================
// ⚡ SLA ESCALATION TIERS EDITOR (Session 57 — Feature A2)
// =============================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Save, Loader2, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import { usersService } from "@/services/api";
import {
  slaEscalationsService,
  type CreateSlaEscalationPayload,
  type SlaEscalation,
  type SlaEscalationAction,
  type UserRole,
} from "@/services/sla-escalations.service";
import type { ChatPriority } from "@/services/sla-policies.service";
import type { User } from "@/types";

const ACTIONS: SlaEscalationAction[] = [
  "NOTIFY_MANAGER",
  "REASSIGN_TO_USER",
  "CHANGE_PRIORITY",
];

const ROLES: UserRole[] = ["OWNER", "ADMIN", "MANAGER", "VENDOR"];

const PRIORITIES: ChatPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

type FormState = {
  level: number;
  triggerAfterMins: number;
  action: SlaEscalationAction;
  targetUserIds: string[];
  targetPriority: ChatPriority;
  notifyRoles: UserRole[];
  isActive: boolean;
};

function blankForm(nextLevel: number): FormState {
  return {
    level: nextLevel,
    triggerAfterMins: 15,
    action: "NOTIFY_MANAGER",
    targetUserIds: [],
    targetPriority: "HIGH",
    notifyRoles: ["MANAGER"],
    isActive: true,
  };
}

interface Props {
  policyId: string;
  policyName: string;
}

export function EscalationTiers({ policyId, policyName }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm(1));

  const { data: escalations = [], isLoading } = useQuery({
    queryKey: ["sla-escalations", policyId],
    queryFn: () => slaEscalationsService.list(policyId),
    enabled: expanded,
  });

  const { data: usersPage } = useQuery({
    queryKey: ["users", "for-escalation"],
    queryFn: () => usersService.getAll({ limit: 200 }),
    enabled: expanded,
    staleTime: 5 * 60_000,
  });
  const users: User[] = usersPage?.data ?? [];

  const createMut = useMutation({
    mutationFn: (payload: CreateSlaEscalationPayload) =>
      slaEscalationsService.create(payload),
    onSuccess: () => {
      toast.success(t("slaEscalation.toast.saveOk"));
      qc.invalidateQueries({ queryKey: ["sla-escalations", policyId] });
      resetForm();
    },
    onError: () => toast.error(t("slaEscalation.toast.saveErr")),
  });

  const updateMut = useMutation({
    mutationFn: (vars: { id: string; payload: Partial<CreateSlaEscalationPayload> }) =>
      slaEscalationsService.update(vars.id, vars.payload),
    onSuccess: () => {
      toast.success(t("slaEscalation.toast.saveOk"));
      qc.invalidateQueries({ queryKey: ["sla-escalations", policyId] });
      resetForm();
    },
    onError: () => toast.error(t("slaEscalation.toast.saveErr")),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => slaEscalationsService.remove(id),
    onSuccess: () => {
      toast.success(t("slaEscalation.toast.deleteOk"));
      qc.invalidateQueries({ queryKey: ["sla-escalations", policyId] });
    },
    onError: () => toast.error(t("slaEscalation.toast.deleteErr")),
  });

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    const nextLevel =
      (escalations.reduce((max, e) => Math.max(max, e.level), 0) || 0) + 1;
    setForm(blankForm(Math.min(nextLevel, 10)));
  }

  function startEdit(esc: SlaEscalation) {
    setEditingId(esc.id);
    setShowForm(true);
    setForm({
      level: esc.level,
      triggerAfterMins: esc.triggerAfterMins,
      action: esc.action,
      targetUserIds: esc.targetUserIds,
      targetPriority: esc.targetPriority ?? "HIGH",
      notifyRoles: esc.notifyRoles.length > 0 ? esc.notifyRoles : ["MANAGER"],
      isActive: esc.isActive,
    });
  }

  function toggleUser(userId: string) {
    setForm((prev) => ({
      ...prev,
      targetUserIds: prev.targetUserIds.includes(userId)
        ? prev.targetUserIds.filter((id) => id !== userId)
        : [...prev.targetUserIds, userId],
    }));
  }

  function toggleRole(role: UserRole) {
    setForm((prev) => ({
      ...prev,
      notifyRoles: prev.notifyRoles.includes(role)
        ? prev.notifyRoles.filter((r) => r !== role)
        : [...prev.notifyRoles, role],
    }));
  }

  function submit() {
    if (form.action === "REASSIGN_TO_USER" && form.targetUserIds.length === 0) {
      toast.error(t("slaEscalation.errNeedUsers"));
      return;
    }
    const payload: CreateSlaEscalationPayload = {
      policyId,
      level: form.level,
      triggerAfterMins: form.triggerAfterMins,
      action: form.action,
      targetUserIds:
        form.action === "REASSIGN_TO_USER" ? form.targetUserIds : [],
      notifyRoles:
        form.action === "NOTIFY_MANAGER" ? form.notifyRoles : [],
      isActive: form.isActive,
    };
    if (form.action === "CHANGE_PRIORITY") {
      payload.targetPriority = form.targetPriority;
    }
    if (editingId) {
      updateMut.mutate({ id: editingId, payload });
    } else {
      createMut.mutate(payload);
    }
  }

  const saving = createMut.isPending || updateMut.isPending;
  const sorted = [...escalations].sort((a, b) => a.level - b.level);

  return (
    <div className="border-t pt-3 mt-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-foreground/80 hover:text-foreground"
      >
        {expanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
        {t("slaEscalation.title")}
        {sorted.length > 0 && (
          <span className="text-xs text-muted-foreground">
            ({sorted.length})
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {isLoading ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              {t("common.loading")}
            </p>
          ) : sorted.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              {t("slaEscalation.empty")}
            </p>
          ) : (
            <div className="space-y-2">
              {sorted.map((esc) => (
                <div
                  key={esc.id}
                  className="flex items-center justify-between gap-2 rounded-lg border p-3 bg-muted/30"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                      {esc.level}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {t(`slaEscalation.actions.${esc.action}`)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("slaEscalation.afterMins", {
                          n: String(esc.triggerAfterMins),
                        })}
                        {!esc.isActive && (
                          <span className="ml-2 text-amber-600">
                            {t("slaEscalation.inactive")}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(esc)}
                    >
                      {t("common.edit")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm(t("slaEscalation.confirmDelete"))) {
                          removeMut.mutate(esc.id);
                        }
                      }}
                      disabled={removeMut.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showForm ? (
            <div className="rounded-lg border p-3 space-y-3 bg-background">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {editingId
                    ? t("slaEscalation.edit")
                    : t("slaEscalation.new")}{" "}
                  — {policyName}
                </p>
                <button
                  type="button"
                  onClick={resetForm}
                  className="p-1 rounded hover:bg-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("slaEscalation.level")}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={form.level}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        level: Math.max(1, Math.min(10, Number(e.target.value) || 1)),
                      }))
                    }
                    className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("slaEscalation.triggerAfterMins")}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10080}
                    value={form.triggerAfterMins}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        triggerAfterMins: Math.max(
                          1,
                          Math.min(10080, Number(e.target.value) || 1),
                        ),
                      }))
                    }
                    className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("slaEscalation.action")}
                  </label>
                  <select
                    value={form.action}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        action: e.target.value as SlaEscalationAction,
                      }))
                    }
                    className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
                  >
                    {ACTIONS.map((a) => (
                      <option key={a} value={a}>
                        {t(`slaEscalation.actions.${a}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {form.action === "NOTIFY_MANAGER" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("slaEscalation.notifyRoles")}
                  </label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {ROLES.map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleRole(role)}
                        className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                          form.notifyRoles.includes(role)
                            ? "bg-primary/10 text-primary border-primary"
                            : "bg-background hover:bg-muted"
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {form.action === "REASSIGN_TO_USER" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("slaEscalation.targetUsers")}
                  </label>
                  <div className="mt-1 max-h-40 overflow-y-auto space-y-1 rounded-lg border p-2">
                    {users.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        {t("slaEscalation.noUsers")}
                      </p>
                    ) : (
                      users.map((u) => {
                        const checked = form.targetUserIds.includes(u.id);
                        const display =
                          [u.firstName, u.lastName].filter(Boolean).join(" ") ||
                          u.email;
                        return (
                          <label
                            key={u.id}
                            className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted rounded px-2 py-1"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleUser(u.id)}
                            />
                            <span className="truncate">{display}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {form.action === "CHANGE_PRIORITY" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("slaEscalation.targetPriority")}
                  </label>
                  <select
                    value={form.targetPriority}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        targetPriority: e.target.value as ChatPriority,
                      }))
                    }
                    className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
                  >
                    {PRIORITIES.map((pr) => (
                      <option key={pr} value={pr}>
                        {pr}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between border-t pt-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, isActive: e.target.checked }))
                    }
                  />
                  {t("slaEscalation.isActive")}
                </label>
                <Button size="sm" onClick={submit} disabled={saving}>
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5 mr-1" />
                  )}
                  {t("common.save")}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              {t("slaEscalation.new")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
