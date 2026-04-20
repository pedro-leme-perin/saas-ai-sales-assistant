"use client";

// =============================================
// 🧩 CUSTOM FIELDS PAGE (Session 55 — Feature A1)
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
  Database,
  Pencil,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import {
  customFieldsService,
  type CustomFieldDefinition,
  type CustomFieldType,
  type CreateCustomFieldInput,
  type UpdateCustomFieldInput,
} from "@/services/custom-fields.service";

const TYPES: CustomFieldType[] = ["TEXT", "NUMBER", "BOOLEAN", "DATE", "SELECT"];

interface Draft {
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  optionsText: string;
  displayOrder: number;
  isActive: boolean;
}

const emptyDraft: Draft = {
  key: "",
  label: "",
  type: "TEXT",
  required: false,
  optionsText: "",
  displayOrder: 0,
  isActive: true,
};

function parseOptions(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function CustomFieldsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: fields = [], isLoading } = useQuery({
    queryKey: ["custom-fields"],
    queryFn: () => customFieldsService.list("CONTACT"),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: (input: CreateCustomFieldInput) =>
      customFieldsService.create(input),
    onSuccess: () => {
      toast.success(t("customFields.toast.createOk"));
      setDraft(emptyDraft);
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ["custom-fields"] });
    },
    onError: () => toast.error(t("customFields.toast.createErr")),
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateCustomFieldInput;
    }) => customFieldsService.update(id, input),
    onSuccess: () => {
      toast.success(t("customFields.toast.updateOk"));
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["custom-fields"] });
    },
    onError: () => toast.error(t("customFields.toast.updateErr")),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => customFieldsService.remove(id),
    onSuccess: () => {
      toast.success(t("customFields.toast.deleteOk"));
      qc.invalidateQueries({ queryKey: ["custom-fields"] });
    },
    onError: () => toast.error(t("customFields.toast.deleteErr")),
  });

  const handleCreate = () => {
    const options = draft.type === "SELECT" ? parseOptions(draft.optionsText) : [];
    if (draft.type === "SELECT" && options.length === 0) {
      toast.error(t("customFields.toast.selectNeedsOptions"));
      return;
    }
    createMut.mutate({
      resource: "CONTACT",
      key: draft.key,
      label: draft.label,
      type: draft.type,
      required: draft.required,
      options,
      displayOrder: draft.displayOrder,
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
            {t("customFields.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("customFields.subtitle")}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate((s) => !s)}>
          <Plus className="w-4 h-4 mr-1" />
          {t("customFields.new")}
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("customFields.create")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("customFields.key")}
                </label>
                <input
                  type="text"
                  value={draft.key}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, key: e.target.value }))
                  }
                  placeholder="cpf"
                  className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("customFields.label")}
                </label>
                <input
                  type="text"
                  value={draft.label}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, label: e.target.value }))
                  }
                  className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
                />
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("customFields.type")}
                </label>
                <select
                  value={draft.type}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      type: e.target.value as CustomFieldType,
                    }))
                  }
                  className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
                >
                  {TYPES.map((tp) => (
                    <option key={tp} value={tp}>
                      {t(`customFields.types.${tp}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("customFields.displayOrder")}
                </label>
                <input
                  type="number"
                  min={0}
                  value={draft.displayOrder}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      displayOrder: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
                />
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.required}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, required: e.target.checked }))
                    }
                  />
                  {t("customFields.required")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, isActive: e.target.checked }))
                    }
                  />
                  {t("customFields.active")}
                </label>
              </div>
            </div>
            {draft.type === "SELECT" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("customFields.options")}
                </label>
                <input
                  type="text"
                  value={draft.optionsText}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, optionsText: e.target.value }))
                  }
                  placeholder={t("customFields.optionsPh")}
                  className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("customFields.optionsHint")}
                </p>
              </div>
            )}
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
                disabled={!draft.key || !draft.label || createMut.isPending}
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
      ) : fields.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Database className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {t("customFields.empty")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {fields.map((field) =>
            editingId === field.id ? (
              <EditRow
                key={field.id}
                field={field}
                saving={updateMut.isPending}
                onCancel={() => setEditingId(null)}
                onSave={(input) =>
                  updateMut.mutate({ id: field.id, input })
                }
              />
            ) : (
              <FieldRow
                key={field.id}
                field={field}
                onEdit={() => setEditingId(field.id)}
                onRemove={() => {
                  if (confirm(t("customFields.confirmDelete"))) {
                    removeMut.mutate(field.id);
                  }
                }}
                saving={removeMut.isPending}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function TypeBadge({ type }: { type: CustomFieldType }) {
  const { t } = useTranslation();
  const colors: Record<CustomFieldType, string> = {
    TEXT: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    NUMBER: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    BOOLEAN: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    DATE: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    SELECT: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  };
  return (
    <span
      className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase ${colors[type]}`}
    >
      {t(`customFields.types.${type}`)}
    </span>
  );
}

function FieldRow({
  field,
  onEdit,
  onRemove,
  saving,
}: {
  field: CustomFieldDefinition;
  onEdit: () => void;
  onRemove: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="p-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-xs bg-muted px-2 py-0.5 rounded">
              {field.key}
            </code>
            <span className="text-sm font-medium">{field.label}</span>
            <TypeBadge type={field.type} />
            {field.required && (
              <span className="text-[10px] uppercase font-semibold text-red-500">
                {t("customFields.required")}
              </span>
            )}
            {!field.isActive && (
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                {t("customFields.inactive")}
              </span>
            )}
          </div>
          {field.type === "SELECT" && field.options.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {field.options.map((opt) => (
                <span
                  key={opt}
                  className="text-xs bg-muted px-2 py-0.5 rounded"
                >
                  {opt}
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {t("customFields.displayOrder")}: {field.displayOrder}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onEdit} disabled={saving}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={onRemove} disabled={saving}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EditRow({
  field,
  saving,
  onCancel,
  onSave,
}: {
  field: CustomFieldDefinition;
  saving: boolean;
  onCancel: () => void;
  onSave: (input: UpdateCustomFieldInput) => void;
}) {
  const { t } = useTranslation();
  const [label, setLabel] = useState(field.label);
  const [required, setRequired] = useState(field.required);
  const [isActive, setIsActive] = useState(field.isActive);
  const [displayOrder, setDisplayOrder] = useState(field.displayOrder);
  const [optionsText, setOptionsText] = useState(field.options.join(", "));

  const handleSave = () => {
    const input: UpdateCustomFieldInput = {
      label,
      required,
      isActive,
      displayOrder,
    };
    if (field.type === "SELECT") {
      const options = parseOptions(optionsText);
      if (options.length === 0) return;
      input.options = options;
    }
    onSave(input);
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <code className="text-xs bg-muted px-2 py-0.5 rounded">
            {field.key}
          </code>
          <TypeBadge type={field.type} />
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {t("customFields.label")}
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {t("customFields.displayOrder")}
            </label>
            <input
              type="number"
              min={0}
              value={displayOrder}
              onChange={(e) => setDisplayOrder(Number(e.target.value) || 0)}
              className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
            />
          </div>
        </div>
        {field.type === "SELECT" && (
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {t("customFields.options")}
            </label>
            <input
              type="text"
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
            />
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
              />
              {t("customFields.required")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              {t("customFields.active")}
            </label>
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving || !label}>
            {saving ? (
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
