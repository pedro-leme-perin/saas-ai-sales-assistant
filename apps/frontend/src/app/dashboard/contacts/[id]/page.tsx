"use client";

// =============================================
// 👤 Contact Detail Page (Session 50)
// =============================================

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Edit2,
  Save,
  X,
  Phone,
  MessageSquare,
  StickyNote,
  Merge,
  Trash2,
  Loader2,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Badge } from "@/components/ui/index";
import { useTranslation } from "@/i18n/use-translation";
import { contactsService, type UpdateContactInput } from "@/services/contacts.service";

export default function ContactDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const id = params?.id as string;
  const qc = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<UpdateContactInput>({});
  const [tagInput, setTagInput] = useState("");
  const [noteText, setNoteText] = useState("");
  const [mergeOpen, setMergeOpen] = useState(false);
  const [secondaryId, setSecondaryId] = useState("");

  const contactQ = useQuery({
    queryKey: ["contacts", "detail", id],
    queryFn: () => contactsService.findById(id),
    enabled: !!id,
  });

  const timelineQ = useQuery({
    queryKey: ["contacts", "timeline", id],
    queryFn: () => contactsService.timeline(id),
    enabled: !!id,
  });

  const notesQ = useQuery({
    queryKey: ["contacts", "notes", id],
    queryFn: () => contactsService.listNotes(id),
    enabled: !!id,
  });

  const updateM = useMutation({
    mutationFn: (input: UpdateContactInput) => contactsService.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      setEditing(false);
      toast.success(t("contacts.toast.saveOk"));
    },
    onError: () => toast.error(t("contacts.toast.saveErr")),
  });

  const addNoteM = useMutation({
    mutationFn: (content: string) => contactsService.addNote(id, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts", "notes", id] });
      setNoteText("");
      toast.success(t("contacts.toast.noteOk"));
    },
    onError: () => toast.error(t("contacts.toast.noteErr")),
  });

  const removeNoteM = useMutation({
    mutationFn: (noteId: string) => contactsService.removeNote(id, noteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts", "notes", id] });
      toast.success(t("contacts.toast.noteRemoveOk"));
    },
  });

  const mergeM = useMutation({
    mutationFn: (secId: string) =>
      contactsService.merge({ primaryId: id, secondaryId: secId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      setMergeOpen(false);
      setSecondaryId("");
      toast.success(t("contacts.toast.mergeOk"));
    },
    onError: () => toast.error(t("contacts.toast.mergeErr")),
  });

  if (contactQ.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!contactQ.data) return null;
  const c = contactQ.data;

  const startEdit = () => {
    setForm({
      name: c.name ?? "",
      email: c.email ?? "",
      timezone: c.timezone ?? "",
      tags: [...c.tags],
    });
    setEditing(true);
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed || form.tags?.includes(trimmed)) return;
    setForm({ ...form, tags: [...(form.tags ?? []), trimmed] });
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setForm({ ...form, tags: (form.tags ?? []).filter((t) => t !== tag) });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/contacts">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("contacts.detail.back")}
          </Button>
        </Link>
        <div className="flex-1" />
        {!editing && (
          <>
            <Button variant="outline" size="sm" onClick={() => setMergeOpen(true)}>
              <Merge className="mr-2 h-4 w-4" />
              {t("contacts.detail.merge")}
            </Button>
            <Button size="sm" onClick={startEdit}>
              <Edit2 className="mr-2 h-4 w-4" />
              {t("contacts.detail.edit")}
            </Button>
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{c.name || c.phone}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {editing ? (
            <div className="space-y-3">
              <div>
                <Label>{t("contacts.columns.name")}</Label>
                <Input
                  value={form.name ?? ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("contacts.columns.email")}</Label>
                <Input
                  value={form.email ?? ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("contacts.detail.timezone")}</Label>
                <Input
                  value={form.timezone ?? ""}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  placeholder="America/Sao_Paulo"
                />
              </div>
              <div>
                <Label>{t("contacts.detail.tags")}</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(form.tags ?? []).map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => removeTag(tag)}
                    >
                      {tag} <X className="ml-1 h-3 w-3" />
                    </Badge>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder={t("contacts.detail.tagsPlaceholder")}
                  />
                  <Button type="button" size="sm" onClick={addTag}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => updateM.mutate(form)}
                  disabled={updateM.isPending}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {t("contacts.detail.save")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                  {t("contacts.detail.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("contacts.columns.phone")}
                </p>
                <p className="font-mono">{c.phone}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("contacts.columns.email")}
                </p>
                <p>{c.email || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("contacts.detail.timezone")}
                </p>
                <p>{c.timezone || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("contacts.detail.firstSeen")}
                </p>
                <p>{new Date(c.firstSeenAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("contacts.detail.lastInteraction")}
                </p>
                <p>
                  {c.lastInteractionAt
                    ? new Date(c.lastInteractionAt).toLocaleString()
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("contacts.detail.tags")}
                </p>
                <div className="flex flex-wrap gap-1">
                  {c.tags.length > 0 ? (
                    c.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("contacts.timeline.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {timelineQ.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : !timelineQ.data || timelineQ.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("contacts.timeline.empty")}
              </p>
            ) : (
              <ul className="space-y-2">
                {timelineQ.data.map((ev) => (
                  <li
                    key={`${ev.kind}-${ev.id}`}
                    className="flex items-start gap-2 border-b pb-2 last:border-0"
                  >
                    {ev.kind === "call" ? (
                      <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    ) : ev.kind === "chat" ? (
                      <MessageSquare className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    ) : (
                      <StickyNote className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    )}
                    <div className="flex-1 text-sm">
                      <p className="font-medium">
                        {t(`contacts.timeline.${ev.kind}`)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(ev.at).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("contacts.notes.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder={t("contacts.notes.placeholder")}
              />
              <Button
                size="sm"
                disabled={!noteText.trim() || addNoteM.isPending}
                onClick={() => addNoteM.mutate(noteText.trim())}
              >
                {t("contacts.notes.add")}
              </Button>
            </div>
            {notesQ.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : !notesQ.data || notesQ.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("contacts.notes.empty")}
              </p>
            ) : (
              <ul className="space-y-2">
                {notesQ.data.map((n) => (
                  <li
                    key={n.id}
                    className="flex items-start justify-between gap-2 rounded border p-2"
                  >
                    <div className="flex-1 text-sm">
                      <p>{n.content}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeNoteM.mutate(n.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {mergeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{t("contacts.merge.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("contacts.merge.hint")}
              </p>
              <div>
                <Label>{t("contacts.merge.secondaryId")}</Label>
                <Input
                  value={secondaryId}
                  onChange={(e) => setSecondaryId(e.target.value)}
                  placeholder="ctc_..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setMergeOpen(false)}>
                  {t("contacts.merge.cancel")}
                </Button>
                <Button
                  disabled={!secondaryId.trim() || mergeM.isPending}
                  onClick={() => mergeM.mutate(secondaryId.trim())}
                >
                  {t("contacts.merge.confirm")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
