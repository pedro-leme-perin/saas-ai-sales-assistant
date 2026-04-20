"use client";

// =============================================
// 🎯 ASSIGNMENT RULES PAGE (Session 54 — Feature A2)
// =============================================

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Edit, Users, Loader2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import { usersService } from "@/services/api";
import {
  assignmentRulesService,
  type AssignmentRule,
  type AssignmentStrategy,
  type ChatPriority,
  type CreateAssignmentRuleInput,
} from "@/services/assignment-rules.service";
import type { User } from "@/types";

const STRATEGIES: AssignmentStrategy[] = [
  "ROUND_ROBIN",
  "LEAST_BUSY",
  "MANUAL_ONLY",
];

const PRIORITIES: ChatPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

interface FormState {
  id?: string;
  name: string;
  priority: number;
  strategy: AssignmentStrategy;
  priorityCond: ChatPriority | "";
  tagsCond: string;
  phonePrefix: string;
  keywordsAny: string;
  targetUserIds: string[];
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  priority: 100,
  strategy: "ROUND_ROBIN",
  priorityCond: "",
  tagsCond: "",
  phonePrefix: "",
  keywordsAny: "",
  targetUserIds: [],
  isActive: true,
};

function strategyColor(s: AssignmentStrategy): string {
  switch (s) {
    case "ROUND_ROBIN":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
    case "LEAST_BUSY":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "MANUAL_ONLY":
      return "bg-muted text-foreground";
  }
}

export default function AssignmentRulesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["assignment-rules"],
    queryFn: () => assignmentRulesService.list(),
  });

  const { data: usersPage } = useQuery({
    queryKey: ["team-members-lite"],
    queryFn: () => usersService.getAll({ limit: 200 }),
  });
  const users: User[] = usersPage?.data ?? [];

  const saveMutation = useMutation({
    mutationFn: async (input: {
      id?: string;
      dto: CreateAssignmentRuleInput;
    }) => {
      if (input.id) {
        return assignmentRulesService.update(input.id, input.dto);
      }
      return assignmentRulesService.create(input.dto);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignment-rules"] });
      toast.success(
        form.id
          ? t("assignmentRules.toast.updated")
          : t("assignmentRules.toast.created"),
      );
      setShowForm(false);
      setForm(EMPTY_FORM);
    },
    onError: () => toast.error(t("assignmentRules.toast.error")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => assignmentRulesService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignment-rules"] });
      toast.success(t("assignmentRules.toast.deleted"));
    },
    onError: () => toast.error(t("assignmentRules.toast.error")),
  });

  const openEdit = (rule: AssignmentRule) => {
    setForm({
      id: rule.id,
      name: rule.name,
      priority: rule.priority,
      strategy: rule.strategy,
      priorityCond: (rule.conditions.priority as ChatPriority) ?? "",
      tagsCond: (rule.conditions.tags ?? []).join(", "),
      phonePrefix: rule.conditions.phonePrefix ?? "",
      keywordsAny: (rule.conditions.keywordsAny ?? []).join(", "),
      targetUserIds: rule.targetUserIds,
      isActive: rule.isActive,
    });
    setShowForm(true);
  };

  const submit = () => {
    if (!form.name.trim() || form.targetUserIds.length === 0) return;
    const conditions: CreateAssignmentRuleInput["conditions"] = {};
    if (form.priorityCond) conditions.priority = form.priorityCond;
    const tags = form.tagsCond
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (tags.length) conditions.tags = tags;
    if (form.phonePrefix.trim())
      conditions.phonePrefix = form.phonePrefix.trim();
    const kw = form.keywordsAny
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (kw.length) conditions.keywordsAny = kw;

    const dto: CreateAssignmentRuleInput = {
      name: form.name.trim(),
      priority: form.priority,
      strategy: form.strategy,
      conditions,
      targetUserIds: form.targetUserIds,
      isActive: form.isActive,
    };
    saveMutation.mutate({ id: form.id, dto });
  };

  const toggleTarget = (uid: string) => {
    setForm((f) => ({
      ...f,
      targetUserIds: f.targetUserIds.includes(uid)
        ? f.targetUserIds.filter((x) => x !== uid)
        : [...f.targetUserIds, uid],
    }));
  };

  const sortedRules = useMemo(
    () => [...rules].sort((a, b) => a.priority - b.priority),
    [rules],
  );

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{t("assignmentRules.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("assignmentRules.subtitle")}
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setForm(EMPTY_FORM);
            setShowForm(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          {t("assignmentRules.new")}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              {form.id ? t("assignmentRules.edit") : t("assignmentRules.new")}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowForm(false);
                  setForm(EMPTY_FORM);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium">
                  {t("assignmentRules.name")}
                </label>
                <input
                  className="w-full mt-1 px-3 py-2 border rounded text-sm bg-background"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium">
                  {t("assignmentRules.priority")}
                </label>
                <input
                  type="number"
                  className="w-full mt-1 px-3 py-2 border rounded text-sm bg-background"
                  value={form.priority}
                  min={1}
                  max={10000}
                  onChange={(e) =>
                    setForm({ ...form, priority: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium">
                  {t("assignmentRules.strategy")}
                </label>
                <select
                  className="w-full mt-1 px-3 py-2 border rounded text-sm bg-background"
                  value={form.strategy}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      strategy: e.target.value as AssignmentStrategy,
                    })
                  }
                >
                  {STRATEGIES.map((s) => (
                    <option key={s} value={s}>
                      {t(`assignmentRules.strategies.${s}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                />
                <label htmlFor="isActive" className="text-sm">
                  {t("assignmentRules.isActive")}
                </label>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="text-sm font-medium mb-3">
                {t("assignmentRules.conditions")}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium">
                    {t("assignmentRules.cond.priority")}
                  </label>
                  <select
                    className="w-full mt-1 px-3 py-2 border rounded text-sm bg-background"
                    value={form.priorityCond}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        priorityCond: e.target.value as ChatPriority | "",
                      })
                    }
                  >
                    <option value="">{t("common.all")}</option>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">
                    {t("assignmentRules.cond.phonePrefix")}
                  </label>
                  <input
                    className="w-full mt-1 px-3 py-2 border rounded text-sm bg-background font-mono"
                    placeholder="+5511"
                    value={form.phonePrefix}
                    onChange={(e) =>
                      setForm({ ...form, phonePrefix: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">
                    {t("assignmentRules.cond.tags")}
                  </label>
                  <input
                    className="w-full mt-1 px-3 py-2 border rounded text-sm bg-background"
                    placeholder="vip, priority"
                    value={form.tagsCond}
                    onChange={(e) =>
                      setForm({ ...form, tagsCond: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">
                    {t("assignmentRules.cond.keywordsAny")}
                  </label>
                  <input
                    className="w-full mt-1 px-3 py-2 border rounded text-sm bg-background"
                    placeholder="urgent, support"
                    value={form.keywordsAny}
                    onChange={(e) =>
                      setForm({ ...form, keywordsAny: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="text-sm font-medium mb-2">
                {t("assignmentRules.targets")}
                <span className="ml-2 text-xs text-muted-foreground">
                  ({form.targetUserIds.length})
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto border rounded p-2 space-y-1">
                {users.length === 0 && (
                  <div className="text-xs text-muted-foreground p-2">
                    {t("assignmentRules.noUsers")}
                  </div>
                )}
                {users.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-2 text-sm p-1 hover:bg-muted rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={form.targetUserIds.includes(u.id)}
                      onChange={() => toggleTarget(u.id)}
                    />
                    <span className="flex-1">{u.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {u.email}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowForm(false);
                  setForm(EMPTY_FORM);
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={submit}
                disabled={
                  saveMutation.isPending ||
                  !form.name.trim() ||
                  form.targetUserIds.length === 0
                }
              >
                {saveMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {t("common.save")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
        </div>
      ) : sortedRules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t("assignmentRules.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sortedRules.map((rule) => (
            <Card key={rule.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{rule.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${strategyColor(rule.strategy)}`}
                    >
                      {t(`assignmentRules.strategies.${rule.strategy}`)}
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs bg-muted">
                      P{rule.priority}
                    </span>
                    {!rule.isActive && (
                      <span className="px-2 py-0.5 rounded text-xs bg-red-500/10 text-red-700 dark:text-red-300">
                        {t("assignmentRules.inactive")}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {rule.targetUserIds.length} {t("assignmentRules.agents")}
                    {Object.keys(rule.conditions).length > 0 && (
                      <span className="ml-2">
                        · {Object.keys(rule.conditions).join(", ")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEdit(rule)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(t("assignmentRules.confirmDelete"))) {
                        deleteMutation.mutate(rule.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
