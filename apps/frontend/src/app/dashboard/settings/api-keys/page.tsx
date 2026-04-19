"use client";

// =============================================
// 🔑 API KEYS SETTINGS PAGE (Session 47)
// =============================================

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Trash2,
  RotateCw,
  Copy,
  AlertTriangle,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import {
  apiKeysService,
  API_KEY_SCOPES,
  type ApiKeyView,
  type CreateApiKeyInput,
  type IssuedApiKey,
} from "@/services/api-keys.service";

export default function ApiKeysSettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [issued, setIssued] = useState<IssuedApiKey | null>(null);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => apiKeysService.list(),
  });

  const createMut = useMutation({
    mutationFn: (input: CreateApiKeyInput) => apiKeysService.create(input),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setIssued(data);
      setIsCreating(false);
      toast.success(t("apiKeys.created"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rotateMut = useMutation({
    mutationFn: (id: string) => apiKeysService.rotate(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setIssued(data);
      toast.success(t("apiKeys.rotated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => apiKeysService.revoke(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success(t("apiKeys.revoked"));
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
          <h1 className="text-2xl font-bold">{t("apiKeys.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("apiKeys.subtitle")}
          </p>
        </div>
        <Button className="ml-auto" onClick={() => setIsCreating(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t("apiKeys.new")}
        </Button>
      </div>

      {issued && <IssuedKeyBanner issued={issued} onDismiss={() => setIssued(null)} />}

      {isCreating && (
        <ApiKeyForm
          onSubmit={(input) => createMut.mutate(input)}
          onCancel={() => setIsCreating(false)}
          submitting={createMut.isPending}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : keys.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-2">
            <p className="text-muted-foreground">{t("apiKeys.empty.title")}</p>
            <p className="text-sm text-muted-foreground">
              {t("apiKeys.empty.description")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <ApiKeyRow
              key={key.id}
              apiKey={key}
              onRotate={() => rotateMut.mutate(key.id)}
              onRevoke={() => revokeMut.mutate(key.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function IssuedKeyBanner({
  issued,
  onDismiss,
}: {
  issued: IssuedApiKey;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard
      .writeText(issued.plaintextKey)
      .then(() => {
        setCopied(true);
        toast.success(t("apiKeys.keyCopied"));
      })
      .catch(() => undefined);
  };

  return (
    <Card className="border-amber-500/50 bg-amber-500/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <div>
              <p className="font-semibold">{t("apiKeys.issuedTitle")}</p>
              <p className="text-sm text-muted-foreground">
                {t("apiKeys.issuedWarning")}
              </p>
            </div>
            <div className="flex items-center gap-2 bg-background border rounded px-3 py-2">
              <code className="flex-1 text-xs font-mono break-all">
                {issued.plaintextKey}
              </code>
              <Button size="sm" variant="ghost" onClick={copy}>
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            {t("common.dismiss")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ApiKeyRow({
  apiKey,
  onRotate,
  onRevoke,
}: {
  apiKey: ApiKeyView;
  onRotate: () => void;
  onRevoke: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate">{apiKey.name}</h3>
              {!apiKey.isActive && (
                <span className="text-xs px-2 py-0.5 bg-destructive/10 text-destructive rounded">
                  {t("apiKeys.revokedLabel")}
                </span>
              )}
              {apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date() && (
                <span className="text-xs px-2 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded">
                  {t("apiKeys.expired")}
                </span>
              )}
            </div>
            <code className="text-xs text-muted-foreground font-mono">
              {apiKey.keyPrefix}••••••••
            </code>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRotate}
              disabled={!apiKey.isActive}
              aria-label={t("apiKeys.rotate")}
            >
              <RotateCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRevoke}
              disabled={!apiKey.isActive}
              aria-label={t("apiKeys.revoke")}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {apiKey.scopes.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {apiKey.scopes.map((s) => (
              <code
                key={s}
                className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded"
              >
                {s}
              </code>
            ))}
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">
              {t("apiKeys.usageCount")}
            </p>
            <p>{apiKey.usageCount}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">{t("apiKeys.lastUsed")}</p>
            <p>
              {apiKey.lastUsedAt
                ? new Date(apiKey.lastUsedAt).toLocaleString()
                : t("apiKeys.never")}
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">
              {t("apiKeys.rateLimit")}
            </p>
            <p>
              {apiKey.rateLimitPerMin
                ? t("apiKeys.rateLimitValue", { n: apiKey.rateLimitPerMin })
                : t("apiKeys.planDefault")}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ApiKeyForm({
  onSubmit,
  onCancel,
  submitting,
}: {
  onSubmit: (input: CreateApiKeyInput) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [rateLimit, setRateLimit] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");

  const toggleScope = (s: string) => {
    setScopes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("apiKeys.new")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">{t("apiKeys.form.name")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder={t("apiKeys.form.namePlaceholder")}
            className="w-full px-3 py-2 border rounded bg-background"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">
            {t("apiKeys.form.scopes")}
          </label>
          <div className="grid sm:grid-cols-2 gap-2">
            {API_KEY_SCOPES.map((s) => (
              <label
                key={s}
                className="flex items-center gap-2 text-sm px-3 py-2 border rounded cursor-pointer hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={scopes.includes(s)}
                  onChange={() => toggleScope(s)}
                />
                <code className="text-xs">{s}</code>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("apiKeys.form.scopesHint")}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">
              {t("apiKeys.form.rateLimit")}
            </label>
            <input
              type="number"
              min={0}
              value={rateLimit}
              onChange={(e) => setRateLimit(e.target.value)}
              placeholder={t("apiKeys.form.rateLimitPlaceholder")}
              className="w-full px-3 py-2 border rounded bg-background"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">
              {t("apiKeys.form.expiresAt")}
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full px-3 py-2 border rounded bg-background"
            />
          </div>
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
                scopes: scopes.length > 0 ? scopes : undefined,
                rateLimitPerMin: rateLimit ? Number(rateLimit) : undefined,
                expiresAt: expiresAt
                  ? new Date(expiresAt).toISOString()
                  : undefined,
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
