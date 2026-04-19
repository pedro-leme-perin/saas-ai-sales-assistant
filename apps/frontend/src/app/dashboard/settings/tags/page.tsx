"use client";

// =============================================
// 🏷️ CONVERSATION TAGS SETTINGS PAGE (Session 47)
// =============================================

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Pencil, Phone, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import {
  tagsService,
  type ConversationTag,
  type CreateTagInput,
} from "@/services/tags.service";

const PRESET_COLORS = [
  "#6366F1",
  "#EC4899",
  "#F59E0B",
  "#10B981",
  "#EF4444",
  "#3B82F6",
  "#8B5CF6",
  "#14B8A6",
];

export default function TagsSettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ConversationTag | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["tags"],
    queryFn: () => tagsService.list(),
  });

  const createMut = useMutation({
    mutationFn: tagsService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      toast.success(t("tags.created"));
      setIsCreating(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: (args: { id: string; input: Partial<CreateTagInput> }) =>
      tagsService.update(args.id, args.input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      toast.success(t("tags.updated"));
      setEditing(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMut = useMutation({
    mutationFn: tagsService.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      toast.success(t("tags.deleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/settings"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{t("tags.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("tags.subtitle")}</p>
        </div>
        <Button className="ml-auto" onClick={() => setIsCreating(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t("tags.new")}
        </Button>
      </div>

      {isCreating && (
        <TagForm
          onSubmit={(input) => createMut.mutate(input)}
          onCancel={() => setIsCreating(false)}
          submitting={createMut.isPending}
        />
      )}

      {editing && (
        <TagForm
          initial={editing}
          onSubmit={(input) => updateMut.mutate({ id: editing.id, input })}
          onCancel={() => setEditing(null)}
          submitting={updateMut.isPending}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : tags.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-2">
            <p className="text-muted-foreground">{t("tags.empty.title")}</p>
            <p className="text-sm text-muted-foreground">
              {t("tags.empty.description")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tags.map((tag) => (
            <TagCard
              key={tag.id}
              tag={tag}
              onEdit={() => setEditing(tag)}
              onDelete={() => removeMut.mutate(tag.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TagCard({
  tag,
  onEdit,
  onDelete,
}: {
  tag: ConversationTag;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <span
              aria-hidden
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: tag.color }}
            />
            <h3 className="font-semibold truncate">{tag.name}</h3>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit} aria-label={t("common.edit")}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              aria-label={t("common.delete")}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {tag.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {tag.description}
          </p>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Phone className="w-3 h-3" />
            {tag.callCount ?? 0}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {tag.chatCount ?? 0}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function TagForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: ConversationTag;
  onSubmit: (input: CreateTagInput) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? PRESET_COLORS[0]);
  const [description, setDescription] = useState(initial?.description ?? "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {initial ? t("tags.edit") : t("tags.new")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">{t("tags.form.name")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="w-full px-3 py-2 border rounded bg-background"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">{t("tags.form.color")}</label>
          <div className="flex items-center gap-2 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full border-2 transition-transform ${
                  color === c ? "border-foreground scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border"
              aria-label={t("tags.form.customColor")}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">
            {t("tags.form.description")}
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            placeholder={t("tags.form.descriptionPlaceholder")}
            className="w-full px-3 py-2 border rounded bg-background"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!name || submitting}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                color,
                description: description.trim() || undefined,
              })
            }
          >
            {submitting ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
