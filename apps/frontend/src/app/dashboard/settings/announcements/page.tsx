"use client";

// =============================================
// 📢 ANNOUNCEMENTS (admin) PAGE (Session 53)
// =============================================

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, Loader2, Megaphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import {
  announcementsService,
  type Announcement,
  type AnnouncementLevel,
  type CreateAnnouncementInput,
  type UserRole,
} from "@/services/announcements.service";

const LEVELS: AnnouncementLevel[] = ["INFO", "WARNING", "URGENT"];
const ROLES: UserRole[] = ["OWNER", "ADMIN", "MANAGER", "VENDOR"];

interface Draft {
  title: string;
  body: string;
  level: AnnouncementLevel;
  publishAt: string;
  expireAt: string;
  targetRoles: UserRole[];
}

const emptyDraft: Draft = {
  title: "",
  body: "",
  level: "INFO",
  publishAt: "",
  expireAt: "",
  targetRoles: [],
};

export default function AnnouncementsAdminPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => announcementsService.list(),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const createMut = useMutation({
    mutationFn: (input: CreateAnnouncementInput) =>
      announcementsService.create(input),
    onSuccess: () => {
      toast.success(t("announcements.toast.createOk"));
      setShowCreate(false);
      setDraft(emptyDraft);
      qc.invalidateQueries({ queryKey: ["announcements"] });
    },
    onError: () => toast.error(t("announcements.toast.createErr")),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => announcementsService.remove(id),
    onSuccess: () => {
      toast.success(t("announcements.toast.deleteOk"));
      qc.invalidateQueries({ queryKey: ["announcements"] });
    },
    onError: () => toast.error(t("announcements.toast.deleteErr")),
  });

  function toggleRole(role: UserRole) {
    setDraft((d) => ({
      ...d,
      targetRoles: d.targetRoles.includes(role)
        ? d.targetRoles.filter((r) => r !== role)
        : [...d.targetRoles, role],
    }));
  }

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
            {t("announcements.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("announcements.subtitle")}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate((s) => !s)}>
          <Plus className="w-4 h-4 mr-1" />
          {t("announcements.new")}
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("announcements.create")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              type="text"
              placeholder={t("announcements.titlePh")}
              value={draft.title}
              onChange={(e) =>
                setDraft((d) => ({ ...d, title: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
            />
            <textarea
              rows={4}
              placeholder={t("announcements.bodyPh")}
              value={draft.body}
              onChange={(e) =>
                setDraft((d) => ({ ...d, body: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
            />
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("announcements.level")}
                </label>
                <select
                  value={draft.level}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      level: e.target.value as AnnouncementLevel,
                    }))
                  }
                  className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
                >
                  {LEVELS.map((lv) => (
                    <option key={lv} value={lv}>
                      {t(`announcements.levels.${lv}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("announcements.publishAt")}
                </label>
                <input
                  type="datetime-local"
                  value={draft.publishAt}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, publishAt: e.target.value }))
                  }
                  className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("announcements.expireAt")}
                </label>
                <input
                  type="datetime-local"
                  value={draft.expireAt}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, expireAt: e.target.value }))
                  }
                  className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-2">
                {t("announcements.targetRoles")}
              </label>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((role) => {
                  const active = draft.targetRoles.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(role)}
                      className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-input"
                      }`}
                    >
                      {role}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {draft.targetRoles.length === 0
                  ? t("announcements.targetBroadcast")
                  : t("announcements.targetScoped")}
              </p>
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
                disabled={!draft.title || !draft.body || createMut.isPending}
                onClick={() =>
                  createMut.mutate({
                    title: draft.title,
                    body: draft.body,
                    level: draft.level,
                    publishAt: draft.publishAt
                      ? new Date(draft.publishAt).toISOString()
                      : undefined,
                    expireAt: draft.expireAt
                      ? new Date(draft.expireAt).toISOString()
                      : undefined,
                    targetRoles:
                      draft.targetRoles.length > 0
                        ? draft.targetRoles
                        : undefined,
                  })
                }
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
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Megaphone className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {t("announcements.empty")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => (
            <AnnouncementAdminRow
              key={row.id}
              row={row}
              onRemove={() => {
                if (confirm(t("announcements.confirmDelete"))) {
                  removeMut.mutate(row.id);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AnnouncementAdminRow({
  row,
  onRemove,
}: {
  row: Announcement;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const levelClass =
    row.level === "URGENT"
      ? "bg-red-500/10 text-red-700 dark:text-red-400"
      : row.level === "WARNING"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "bg-blue-500/10 text-blue-700 dark:text-blue-400";
  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded ${levelClass}`}>
              {t(`announcements.levels.${row.level}`)}
            </span>
            <span className="font-medium text-sm">{row.title}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2 whitespace-pre-line">
            {row.body}
          </p>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
            <span>
              {t("announcements.publishAt")}:{" "}
              {new Date(row.publishAt).toLocaleString()}
            </span>
            {row.expireAt && (
              <span>
                {t("announcements.expireAt")}:{" "}
                {new Date(row.expireAt).toLocaleString()}
              </span>
            )}
            <span>
              {row.targetRoles.length === 0
                ? t("announcements.targetBroadcast")
                : row.targetRoles.join(", ")}
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onRemove}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}
