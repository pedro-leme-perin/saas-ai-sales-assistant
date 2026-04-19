"use client";

// =============================================
// 📑 REPLY TEMPLATES SETTINGS PAGE (Session 46)
// =============================================

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Pencil, Copy, Hash } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import {
  replyTemplatesService,
  type CreateReplyTemplateInput,
  type ReplyTemplate,
  type ReplyTemplateChannel,
} from "@/services/reply-templates.service";

const CHANNELS: ReplyTemplateChannel[] = ["CALL", "WHATSAPP", "BOTH"];

export default function ReplyTemplatesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ReplyTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["reply-templates"],
    queryFn: () => replyTemplatesService.list(),
  });

  const createMut = useMutation({
    mutationFn: replyTemplatesService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reply-templates"] });
      toast.success(t("templates.created"));
      setIsCreating(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: (args: { id: string; input: Partial<CreateReplyTemplateInput> }) =>
      replyTemplatesService.update(args.id, args.input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reply-templates"] });
      toast.success(t("templates.updated"));
      setEditing(null);
    },
  });

  const removeMut = useMutation({
    mutationFn: replyTemplatesService.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reply-templates"] });
      toast.success(t("templates.deleted"));
    },
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
          <h1 className="text-2xl font-bold">{t("templates.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("templates.subtitle")}
          </p>
        </div>
        <Button className="ml-auto" onClick={() => setIsCreating(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t("templates.new")}
        </Button>
      </div>

      {isCreating && (
        <TemplateForm
          onSubmit={(input) => createMut.mutate(input)}
          onCancel={() => setIsCreating(false)}
          submitting={createMut.isPending}
        />
      )}

      {editing && (
        <TemplateForm
          initial={editing}
          onSubmit={(input) => updateMut.mutate({ id: editing.id, input })}
          onCancel={() => setEditing(null)}
          submitting={updateMut.isPending}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-2">
            <p className="text-muted-foreground">{t("templates.empty.title")}</p>
            <p className="text-sm text-muted-foreground">
              {t("templates.empty.description")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {templates.map((tmpl) => (
            <TemplateCard
              key={tmpl.id}
              template={tmpl}
              onEdit={() => setEditing(tmpl)}
              onDelete={() => removeMut.mutate(tmpl.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  onEdit,
  onDelete,
}: {
  template: ReplyTemplate;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate">{template.name}</h3>
              <span className="text-xs px-2 py-0.5 bg-accent rounded">
                {template.channel}
              </span>
              {template.category && (
                <span className="text-xs px-2 py-0.5 bg-muted rounded flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  {template.category}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
          {template.content}
        </p>

        {template.variables.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {template.variables.map((v) => (
              <code
                key={v}
                className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded"
              >
                {`{{${v}}}`}
              </code>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span>
            {t("templates.usageCount", { count: template.usageCount })}
          </span>
          <button
            className="hover:text-foreground"
            onClick={() => {
              navigator.clipboard.writeText(template.content).catch(() => undefined);
              toast.success(t("templates.copied"));
            }}
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: ReplyTemplate;
  onSubmit: (input: CreateReplyTemplateInput) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? "");
  const [channel, setChannel] = useState<ReplyTemplateChannel>(
    initial?.channel ?? "BOTH",
  );
  const [category, setCategory] = useState(initial?.category ?? "");
  const [content, setContent] = useState(initial?.content ?? "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {initial ? t("templates.edit") : t("templates.new")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">
              {t("templates.form.name")}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded bg-background"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">
              {t("templates.form.channel")}
            </label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as ReplyTemplateChannel)}
              className="w-full px-3 py-2 border rounded bg-background"
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">
            {t("templates.form.category")}
          </label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder={t("templates.form.categoryPlaceholder")}
            className="w-full px-3 py-2 border rounded bg-background"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">
            {t("templates.form.content")}
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            placeholder={t("templates.form.contentPlaceholder")}
            className="w-full px-3 py-2 border rounded bg-background font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {t("templates.form.variablesHint")}
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!name || !content || submitting}
            onClick={() =>
              onSubmit({
                name,
                channel,
                category: category || undefined,
                content,
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
