"use client";

// =============================================
// 🔔 WEBHOOKS SETTINGS PAGE (Session 46)
// =============================================

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  RotateCw,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Copy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import {
  webhooksService,
  type CreateWebhookInput,
  type WebhookEndpoint,
  type WebhookEvent,
} from "@/services/webhooks.service";

const ALL_EVENTS: WebhookEvent[] = [
  "CALL_COMPLETED",
  "CHAT_MESSAGE_RECEIVED",
  "SUMMARY_READY",
  "COACHING_REPORT_CREATED",
];

export default function WebhooksSettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  const { data: endpoints = [], isLoading } = useQuery({
    queryKey: ["webhooks"],
    queryFn: webhooksService.list,
  });

  const createMut = useMutation({
    mutationFn: webhooksService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success(t("webhooks.created"));
      setIsCreating(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMut = useMutation({
    mutationFn: webhooksService.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success(t("webhooks.deleted"));
    },
  });

  const rotateMut = useMutation({
    mutationFn: webhooksService.rotateSecret,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success(t("webhooks.secretRotated"));
      navigator.clipboard.writeText(res.secret).catch(() => undefined);
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
          <h1 className="text-2xl font-bold">{t("webhooks.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("webhooks.subtitle")}
          </p>
        </div>
        <Button className="ml-auto" onClick={() => setIsCreating(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t("webhooks.newEndpoint")}
        </Button>
      </div>

      {isCreating && (
        <CreateEndpointForm
          onSubmit={(input) => createMut.mutate(input)}
          onCancel={() => setIsCreating(false)}
          submitting={createMut.isPending}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : endpoints.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-2">
            <p className="text-muted-foreground">{t("webhooks.empty.title")}</p>
            <p className="text-sm text-muted-foreground">
              {t("webhooks.empty.description")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {endpoints.map((ep) => (
            <EndpointRow
              key={ep.id}
              endpoint={ep}
              onDelete={() => removeMut.mutate(ep.id)}
              onRotate={() => rotateMut.mutate(ep.id)}
            />
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("webhooks.signingGuide.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>{t("webhooks.signingGuide.header")}</p>
          <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`X-TheIAdvisor-Signature: t=<unix>,v1=<hmac_sha256(secret, body)>
X-TheIAdvisor-Event: <event_name>
X-TheIAdvisor-Delivery: <delivery_id>`}
          </pre>
          <p>{t("webhooks.signingGuide.retries")}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function CreateEndpointForm({
  onSubmit,
  onCancel,
  submitting,
}: {
  onSubmit: (input: CreateWebhookInput) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>([]);

  const toggleEvent = (e: WebhookEvent) => {
    setEvents((curr) =>
      curr.includes(e) ? curr.filter((x) => x !== e) : [...curr, e],
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("webhooks.newEndpoint")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">{t("webhooks.form.url")}</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/webhooks/theiadvisor"
            className="w-full px-3 py-2 border rounded bg-background"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">
            {t("webhooks.form.description")}
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("webhooks.form.descriptionPlaceholder")}
            className="w-full px-3 py-2 border rounded bg-background"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("webhooks.form.events")}</label>
          <div className="grid grid-cols-2 gap-2">
            {ALL_EVENTS.map((e) => (
              <label
                key={e}
                className="flex items-center gap-2 text-sm p-2 border rounded cursor-pointer hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={events.includes(e)}
                  onChange={() => toggleEvent(e)}
                />
                <code className="text-xs">{e}</code>
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!url || events.length === 0 || submitting}
            onClick={() =>
              onSubmit({
                url,
                description: description || undefined,
                events,
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

function EndpointRow({
  endpoint,
  onDelete,
  onRotate,
}: {
  endpoint: WebhookEndpoint;
  onDelete: () => void;
  onRotate: () => void;
}) {
  const { t } = useTranslation();
  const [showSecret, setShowSecret] = useState(false);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {endpoint.isActive ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-muted-foreground" />
              )}
              <code className="text-sm font-mono truncate">{endpoint.url}</code>
            </div>
            {endpoint.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {endpoint.description}
              </p>
            )}
            <div className="flex gap-1 flex-wrap mt-2">
              {endpoint.events.map((e) => (
                <span
                  key={e}
                  className="text-xs px-2 py-0.5 bg-accent rounded font-mono"
                >
                  {e}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRotate}
              title={t("webhooks.rotateSecret")}
            >
              <RotateCw className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              title={t("common.delete")}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            {t("webhooks.secret")}:
          </span>
          <code className="font-mono bg-muted px-2 py-0.5 rounded">
            {showSecret ? endpoint.secret : `${endpoint.secret.slice(0, 12)}…`}
          </code>
          <button
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setShowSecret((v) => !v)}
          >
            {showSecret ? t("common.hide") : t("common.show")}
          </button>
          <button
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              navigator.clipboard.writeText(endpoint.secret).catch(() => undefined);
              toast.success(t("webhooks.secretCopied"));
            }}
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>

        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {t("webhooks.lastSuccess")}:{" "}
            {endpoint.lastSuccessAt
              ? new Date(endpoint.lastSuccessAt).toLocaleString()
              : "—"}
          </span>
          <span>
            {t("webhooks.failures")}: {endpoint.failureCount}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
