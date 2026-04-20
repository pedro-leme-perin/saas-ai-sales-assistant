"use client";

// =============================================
// 🚩 FEATURE FLAGS PAGE (Session 53)
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
  Flag,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import {
  featureFlagsService,
  type FeatureFlag,
  type CreateFeatureFlagInput,
} from "@/services/feature-flags.service";

interface CreateDraft {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
}

const emptyDraft: CreateDraft = {
  key: "",
  name: "",
  description: "",
  enabled: false,
  rolloutPercentage: 0,
};

export default function FeatureFlagsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: flags = [], isLoading } = useQuery({
    queryKey: ["feature-flags"],
    queryFn: () => featureFlagsService.list(),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<CreateDraft>(emptyDraft);

  const createMut = useMutation({
    mutationFn: (input: CreateFeatureFlagInput) =>
      featureFlagsService.create(input),
    onSuccess: () => {
      toast.success(t("featureFlags.toast.createOk"));
      setDraft(emptyDraft);
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ["feature-flags"] });
    },
    onError: () => toast.error(t("featureFlags.toast.createErr")),
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<FeatureFlag>;
    }) => featureFlagsService.update(id, input),
    onSuccess: () => {
      toast.success(t("featureFlags.toast.updateOk"));
      qc.invalidateQueries({ queryKey: ["feature-flags"] });
    },
    onError: () => toast.error(t("featureFlags.toast.updateErr")),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => featureFlagsService.remove(id),
    onSuccess: () => {
      toast.success(t("featureFlags.toast.deleteOk"));
      qc.invalidateQueries({ queryKey: ["feature-flags"] });
    },
    onError: () => toast.error(t("featureFlags.toast.deleteErr")),
  });

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
            {t("featureFlags.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("featureFlags.subtitle")}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate((s) => !s)}>
          <Plus className="w-4 h-4 mr-1" />
          {t("featureFlags.new")}
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("featureFlags.create")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("featureFlags.key")}
                </label>
                <input
                  type="text"
                  value={draft.key}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, key: e.target.value }))
                  }
                  placeholder="new_dashboard_ui"
                  className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("featureFlags.name")}
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
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {t("featureFlags.description")}
              </label>
              <textarea
                rows={2}
                value={draft.description}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, description: e.target.value }))
                }
                className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
              />
            </div>
            <div className="grid md:grid-cols-2 gap-3 items-end">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("featureFlags.rollout")} ({draft.rolloutPercentage}%)
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={draft.rolloutPercentage}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      rolloutPercentage: Number(e.target.value),
                    }))
                  }
                  className="w-full mt-2"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, enabled: e.target.checked }))
                  }
                />
                {t("featureFlags.enabled")}
              </label>
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
                disabled={!draft.key || !draft.name || createMut.isPending}
                onClick={() =>
                  createMut.mutate({
                    key: draft.key,
                    name: draft.name,
                    description: draft.description || undefined,
                    enabled: draft.enabled,
                    rolloutPercentage: draft.rolloutPercentage,
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
      ) : flags.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Flag className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {t("featureFlags.empty")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {flags.map((flag) => (
            <FlagRow
              key={flag.id}
              flag={flag}
              onToggle={(enabled) =>
                updateMut.mutate({ id: flag.id, input: { enabled } })
              }
              onRollout={(rolloutPercentage) =>
                updateMut.mutate({
                  id: flag.id,
                  input: { rolloutPercentage },
                })
              }
              onRemove={() => {
                if (confirm(t("featureFlags.confirmDelete"))) {
                  removeMut.mutate(flag.id);
                }
              }}
              saving={updateMut.isPending || removeMut.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FlagRow({
  flag,
  onToggle,
  onRollout,
  onRemove,
  saving,
}: {
  flag: FeatureFlag;
  onToggle: (enabled: boolean) => void;
  onRollout: (pct: number) => void;
  onRemove: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [localRollout, setLocalRollout] = useState(flag.rolloutPercentage);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-0.5 rounded">
                {flag.key}
              </code>
              <span className="text-sm font-medium">{flag.name}</span>
            </div>
            {flag.description && (
              <p className="text-xs text-muted-foreground mt-1">
                {flag.description}
              </p>
            )}
            {flag.userAllowlist.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Users className="w-3 h-3" />
                {t("featureFlags.allowlistCount", {
                  n: String(flag.userAllowlist.length),
                })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={flag.enabled}
                onChange={(e) => onToggle(e.target.checked)}
                disabled={saving}
              />
              {t("featureFlags.enabled")}
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={onRemove}
              disabled={saving}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={localRollout}
              onChange={(e) => setLocalRollout(Number(e.target.value))}
              onMouseUp={() => {
                if (localRollout !== flag.rolloutPercentage) {
                  onRollout(localRollout);
                }
              }}
              onTouchEnd={() => {
                if (localRollout !== flag.rolloutPercentage) {
                  onRollout(localRollout);
                }
              }}
              className="w-full"
            />
          </div>
          <span className="text-xs font-mono w-12 text-right">
            {localRollout}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
