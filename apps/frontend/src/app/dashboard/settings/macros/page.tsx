"use client";

// =============================================
// 🛠 MACROS PAGE (Session 56 — Feature A2)
// =============================================

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Loader2,
  Zap,
  Pencil,
  X,
  MessageSquare,
  Tag as TagIcon,
  UserCheck,
  CheckCircle2,
  ArrowDown,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import {
  macrosService,
  MAX_ACTIONS_PER_MACRO,
  type Macro,
  type MacroAction,
  type MacroActionType,
  type CreateMacroInput,
  type UpdateMacroInput,
} from "@/services/macros.service";
import {
  replyTemplatesService,
  type ReplyTemplate,
} from "@/services/reply-templates.service";
import { tagsService, type ConversationTag } from "@/services/tags.service";
import { usersService } from "@/services/api";
import type { User } from "@/types";

const ACTION_TYPES: MacroActionType[] = [
  "SEND_REPLY",
  "ATTACH_TAG",
  "ASSIGN_AGENT",
  "CLOSE_CHAT",
];

const ACTION_ICONS: Record<MacroActionType, typeof MessageSquare> = {
  SEND_REPLY: MessageSquare,
  ATTACH_TAG: TagIcon,
  ASSIGN_AGENT: UserCheck,
  CLOSE_CHAT: CheckCircle2,
};

const ACTION_COLORS: Record<MacroActionType, string> = {
  SEND_REPLY: "bg-blue-500/10 text-blue-600",
  ATTACH_TAG: "bg-amber-500/10 text-amber-600",
  ASSIGN_AGENT: "bg-violet-500/10 text-violet-600",
  CLOSE_CHAT: "bg-emerald-500/10 text-emerald-600",
};

interface Draft {
  name: string;
  description: string;
  actions: MacroAction[];
  isActive: boolean;
}

const emptyDraft: Draft = {
  name: "",
  description: "",
  actions: [],
  isActive: true,
};

function defaultAction(type: MacroActionType): MacroAction {
  switch (type) {
    case "SEND_REPLY":
      return { type, templateId: "" };
    case "ATTACH_TAG":
      return { type, tagId: "" };
    case "ASSIGN_AGENT":
      return { type, userId: null };
    case "CLOSE_CHAT":
      return { type };
  }
}

export default function MacrosPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: macros = [], isLoading } = useQuery({
    queryKey: ["macros"],
    queryFn: () => macrosService.list(),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["reply-templates", "WHATSAPP"],
    queryFn: async () => {
      const res = await replyTemplatesService.list("WHATSAPP");
      return (res as unknown as ReplyTemplate[]) ?? [];
    },
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: () => tagsService.list(),
  });

  const { data: usersPage } = useQuery({
    queryKey: ["users-for-macros"],
    queryFn: () => usersService.getAll({ limit: 200 }),
  });
  const users: User[] = usersPage?.data ?? [];

  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: (input: CreateMacroInput) => macrosService.create(input),
    onSuccess: () => {
      toast.success(t("macros.toast.createOk"));
      setDraft(emptyDraft);
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ["macros"] });
    },
    onError: () => toast.error(t("macros.toast.createErr")),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMacroInput }) =>
      macrosService.update(id, input),
    onSuccess: () => {
      toast.success(t("macros.toast.updateOk"));
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["macros"] });
    },
    onError: () => toast.error(t("macros.toast.updateErr")),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => macrosService.remove(id),
    onSuccess: () => {
      toast.success(t("macros.toast.deleteOk"));
      qc.invalidateQueries({ queryKey: ["macros"] });
    },
    onError: () => toast.error(t("macros.toast.deleteErr")),
  });

  const handleAddAction = (type: MacroActionType) => {
    if (draft.actions.length >= MAX_ACTIONS_PER_MACRO) {
      toast.error(t("macros.toast.maxActions"));
      return;
    }
    setDraft((d) => ({ ...d, actions: [...d.actions, defaultAction(type)] }));
  };

  const handleUpdateAction = (idx: number, next: MacroAction) => {
    setDraft((d) => ({
      ...d,
      actions: d.actions.map((a, i) => (i === idx ? next : a)),
    }));
  };

  const handleRemoveAction = (idx: number) => {
    setDraft((d) => ({
      ...d,
      actions: d.actions.filter((_, i) => i !== idx),
    }));
  };

  const handleCreate = () => {
    if (!draft.name.trim() || draft.actions.length === 0) {
      toast.error(t("macros.toast.incomplete"));
      return;
    }
    // Lightweight client-side guard — backend also validates via Zod.
    for (const a of draft.actions) {
      if (a.type === "SEND_REPLY" && !a.templateId) {
        toast.error(t("macros.toast.actionInvalid"));
        return;
      }
      if (a.type === "ATTACH_TAG" && !a.tagId) {
        toast.error(t("macros.toast.actionInvalid"));
        return;
      }
    }
    createMut.mutate({
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      actions: draft.actions,
      isActive: draft.isActive,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/settings"
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {t("macros.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("macros.subtitle")}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate((s) => !s)}>
          <Plus className="w-4 h-4 mr-1" />
          {t("macros.new")}
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("macros.create")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("macros.name")}
                </label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("macros.description")}
                </label>
                <input
                  type="text"
                  value={draft.description}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, description: e.target.value }))
                  }
                  className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, isActive: e.target.checked }))
                }
              />
              {t("macros.isActive")}
            </label>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                {t("macros.actions")} ({draft.actions.length}/
                {MAX_ACTIONS_PER_MACRO})
              </p>
              <div className="space-y-2">
                {draft.actions.map((action, idx) => (
                  <ActionEditor
                    key={idx}
                    idx={idx}
                    action={action}
                    templates={templates}
                    tags={tags}
                    users={users}
                    onChange={(next) => handleUpdateAction(idx, next)}
                    onRemove={() => handleRemoveAction(idx)}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {ACTION_TYPES.map((type) => {
                  const Icon = ACTION_ICONS[type];
                  return (
                    <Button
                      key={type}
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddAction(type)}
                    >
                      <Icon className="w-3.5 h-3.5 mr-1" />
                      {t(`macros.action.${type}`)}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCreate(false);
                  setDraft(emptyDraft);
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                size="sm"
                disabled={
                  !draft.name ||
                  draft.actions.length === 0 ||
                  createMut.isPending
                }
                onClick={handleCreate}
              >
                {createMut.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 mr-1" />
                )}
                {t("common.create")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t("common.loading")}
          </CardContent>
        </Card>
      ) : macros.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Zap className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {t("macros.empty")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {macros.map((macro) => (
            <MacroRow
              key={macro.id}
              macro={macro}
              templates={templates}
              tags={tags}
              users={users}
              isEditing={editingId === macro.id}
              onEdit={() => setEditingId(macro.id)}
              onCancelEdit={() => setEditingId(null)}
              onUpdate={(input) =>
                updateMut.mutate({ id: macro.id, input })
              }
              onRemove={() => {
                if (confirm(t("macros.confirmDelete"))) removeMut.mutate(macro.id);
              }}
              updating={updateMut.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================
// Action editor row — inline per-action form
// =============================================
function ActionEditor({
  idx,
  action,
  templates,
  tags,
  users,
  onChange,
  onRemove,
}: {
  idx: number;
  action: MacroAction;
  templates: ReplyTemplate[];
  tags: ConversationTag[];
  users: User[];
  onChange: (next: MacroAction) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const Icon = ACTION_ICONS[action.type];
  const colorClass = ACTION_COLORS[action.type];

  return (
    <div className="flex items-start gap-2 p-3 rounded-lg border bg-muted/30">
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-background border text-xs font-semibold mt-0.5">
        {idx + 1}
      </div>
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${colorClass}`}
      >
        <Icon className="w-3.5 h-3.5" />
        {t(`macros.action.${action.type}`)}
      </div>
      <div className="flex-1 space-y-2">
        {action.type === "SEND_REPLY" && (
          <select
            value={action.templateId}
            onChange={(e) =>
              onChange({ ...action, templateId: e.target.value })
            }
            className="w-full px-2 py-1.5 rounded-md border bg-background text-sm"
          >
            <option value="">{t("macros.pickTemplate")}</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </select>
        )}
        {action.type === "ATTACH_TAG" && (
          <select
            value={action.tagId}
            onChange={(e) => onChange({ ...action, tagId: e.target.value })}
            className="w-full px-2 py-1.5 rounded-md border bg-background text-sm"
          >
            <option value="">{t("macros.pickTag")}</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        )}
        {action.type === "ASSIGN_AGENT" && (
          <select
            value={action.userId ?? ""}
            onChange={(e) =>
              onChange({ ...action, userId: e.target.value || null })
            }
            className="w-full px-2 py-1.5 rounded-md border bg-background text-sm"
          >
            <option value="">{t("macros.unassign")}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </select>
        )}
        {action.type === "CLOSE_CHAT" && (
          <input
            type="text"
            value={action.note ?? ""}
            onChange={(e) =>
              onChange({ ...action, note: e.target.value || undefined })
            }
            placeholder={t("macros.notePh")}
            maxLength={500}
            className="w-full px-2 py-1.5 rounded-md border bg-background text-sm"
          />
        )}
      </div>
      <button
        onClick={onRemove}
        className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        aria-label="remove"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// =============================================
// Macro list row (view / edit)
// =============================================
function MacroRow({
  macro,
  templates,
  tags,
  users,
  isEditing,
  onEdit,
  onCancelEdit,
  onUpdate,
  onRemove,
  updating,
}: {
  macro: Macro;
  templates: ReplyTemplate[];
  tags: ConversationTag[];
  users: User[];
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (input: UpdateMacroInput) => void;
  onRemove: () => void;
  updating: boolean;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(macro.name);
  const [description, setDescription] = useState(macro.description ?? "");
  const [actions, setActions] = useState<MacroAction[]>(macro.actions);
  const [isActive, setIsActive] = useState(macro.isActive);

  if (isEditing) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="px-3 py-2 rounded-lg border bg-background text-sm"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("macros.description")}
              className="px-3 py-2 rounded-lg border bg-background text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            {t("macros.isActive")}
          </label>
          <div className="space-y-2">
            {actions.map((action, idx) => (
              <ActionEditor
                key={idx}
                idx={idx}
                action={action}
                templates={templates}
                tags={tags}
                users={users}
                onChange={(next) =>
                  setActions((arr) => arr.map((a, i) => (i === idx ? next : a)))
                }
                onRemove={() =>
                  setActions((arr) => arr.filter((_, i) => i !== idx))
                }
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {ACTION_TYPES.map((type) => {
              const Icon = ACTION_ICONS[type];
              return (
                <Button
                  key={type}
                  size="sm"
                  variant="outline"
                  disabled={actions.length >= MAX_ACTIONS_PER_MACRO}
                  onClick={() =>
                    setActions((arr) => [...arr, defaultAction(type)])
                  }
                >
                  <Icon className="w-3.5 h-3.5 mr-1" />
                  {t(`macros.action.${type}`)}
                </Button>
              );
            })}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onCancelEdit}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              disabled={!name || actions.length === 0 || updating}
              onClick={() =>
                onUpdate({
                  name: name.trim(),
                  description: description.trim() || undefined,
                  actions,
                  isActive,
                })
              }
            >
              {updating ? (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5 mr-1" />
              )}
              {t("common.save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold">{macro.name}</p>
              {!macro.isActive && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {t("macros.inactive")}
                </span>
              )}
            </div>
            {macro.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {macro.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {macro.actions.map((action, idx) => {
                const Icon = ACTION_ICONS[action.type];
                const colorClass = ACTION_COLORS[action.type];
                return (
                  <div key={idx} className="flex items-center gap-1">
                    {idx > 0 && (
                      <ArrowDown className="w-3 h-3 text-muted-foreground" />
                    )}
                    <span
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${colorClass}`}
                    >
                      <Icon className="w-3 h-3" />
                      {t(`macros.action.${action.type}`)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span>
                {t("macros.usageCount", {
                  n: String(macro.usageCount),
                })}
              </span>
              {macro.lastUsedAt && (
                <span>
                  {t("macros.lastUsedAt")}:{" "}
                  {new Date(macro.lastUsedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={onEdit}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              aria-label="edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRemove}
              className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              aria-label="remove"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
