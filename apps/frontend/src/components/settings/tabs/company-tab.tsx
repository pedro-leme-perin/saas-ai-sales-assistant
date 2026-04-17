"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { UseMutationResult } from "@tanstack/react-query";
import { Save, Building2, Globe, MapPin, Upload, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { uploadService } from "@/services/api";
import { toast } from "sonner";

interface CompanyFormData {
  name: string;
  website: string;
  industry: string;
  timezone: string;
}

interface CompanyTabProps {
  company?: {
    name?: string;
    slug?: string;
    website?: string;
    industry?: string;
    timezone?: string;
    plan?: string;
    logoUrl?: string;
    metadata?: Record<string, unknown>;
  };
  updateMutation: UseMutationResult<
    unknown,
    Error,
    Record<string, unknown>,
    unknown
  >;
  t: (key: string) => string;
}

const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Belem",
  "America/Fortaleza",
  "America/Recife",
  "America/Bahia",
  "America/Cuiaba",
  "America/Porto_Velho",
  "America/Rio_Branco",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Lisbon",
  "Europe/Berlin",
  "Asia/Tokyo",
];

export default function CompanyTab({
  company,
  updateMutation,
  t,
}: CompanyTabProps) {
  const [form, setForm] = useState<CompanyFormData>({
    name: "",
    website: "",
    industry: "",
    timezone: "America/Sao_Paulo",
  });
  const [isDirty, setIsDirty] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name || "",
        website: company.website || "",
        industry: company.industry || "",
        timezone: company.timezone || "America/Sao_Paulo",
      });
      setLogoUrl(company.logoUrl || "");
    }
  }, [company]);

  const handleChange = useCallback(
    (field: keyof CompanyFormData, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setIsDirty(true);
    },
    [],
  );

  const handleLogoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        toast.error(t("settings.company.logoTooLarge"));
        return;
      }

      if (
        !["image/jpeg", "image/png", "image/webp", "image/svg+xml"].includes(
          file.type,
        )
      ) {
        toast.error(t("settings.company.logoInvalidType"));
        return;
      }

      setIsUploading(true);
      try {
        const publicUrl = await uploadService.uploadFile(file, "logos");
        setLogoUrl(publicUrl);
        updateMutation.mutate({ logoUrl: publicUrl });
        toast.success(t("settings.company.logoUploaded"));
      } catch {
        toast.error(t("settings.company.logoUploadError"));
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [t, updateMutation],
  );

  const handleSave = useCallback(() => {
    const payload: Record<string, unknown> = {};
    if (form.name.trim() && form.name !== company?.name) {
      payload.name = form.name.trim();
    }
    if (form.website !== (company?.website || "")) {
      payload.website = form.website || undefined;
    }
    if (form.industry !== (company?.industry || "")) {
      payload.industry = form.industry || undefined;
    }
    if (form.timezone !== (company?.timezone || "America/Sao_Paulo")) {
      payload.timezone = form.timezone;
    }

    if (Object.keys(payload).length === 0) return;

    updateMutation.mutate(payload, {
      onSuccess: () => setIsDirty(false),
    });
  }, [form, company, updateMutation]);

  return (
    <div className="space-y-6">
      {/* Company Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {t("settings.company.title")}
          </CardTitle>
          <CardDescription>{t("settings.company.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Logo Upload */}
          <div className="flex items-center gap-4 pb-4 border-b">
            <div className="relative h-16 w-16 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center overflow-hidden bg-muted">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="h-full w-full object-cover rounded-lg"
                />
              ) : (
                <Building2 className="h-8 w-8 text-muted-foreground/50" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">
                {t("settings.company.logo")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("settings.company.logoHint")}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <Button
                variant="outline"
                size="sm"
                className="mt-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                )}
                {isUploading
                  ? t("common.loading")
                  : t("settings.company.uploadLogo")}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">
                {t("settings.company.name")}
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="w-full mt-1 px-4 py-2 border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                {t("settings.company.slug")}
              </label>
              <input
                type="text"
                defaultValue={company?.slug || ""}
                className="w-full mt-1 px-4 py-2 border rounded-lg bg-muted text-muted-foreground cursor-not-allowed"
                disabled
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium flex items-center gap-1">
                <Globe className="h-3.5 w-3.5" />
                {t("settings.company.website")}
              </label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => handleChange("website", e.target.value)}
                placeholder={t("settings.company.websitePlaceholder")}
                className="w-full mt-1 px-4 py-2 border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                {t("settings.company.industry")}
              </label>
              <select
                value={form.industry}
                onChange={(e) => handleChange("industry", e.target.value)}
                className="w-full mt-1 px-4 py-2 border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">
                  {t("settings.company.industryPlaceholder")}
                </option>
                <option value="technology">
                  {t("settings.company.industries.technology")}
                </option>
                <option value="retail">
                  {t("settings.company.industries.retail")}
                </option>
                <option value="services">
                  {t("settings.company.industries.services")}
                </option>
                <option value="healthcare">
                  {t("settings.company.industries.healthcare")}
                </option>
                <option value="finance">
                  {t("settings.company.industries.finance")}
                </option>
                <option value="education">
                  {t("settings.company.industries.education")}
                </option>
                <option value="other">
                  {t("settings.company.industries.other")}
                </option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {t("settings.company.timezone")}
              </label>
              <select
                value={form.timezone}
                onChange={(e) => handleChange("timezone", e.target.value)}
                className="w-full mt-1 px-4 py-2 border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">
                {t("settings.company.plan")}
              </label>
              <input
                type="text"
                value={company?.plan || "STARTER"}
                className="w-full mt-1 px-4 py-2 border rounded-lg bg-muted text-muted-foreground cursor-not-allowed"
                disabled
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSave}
              disabled={!isDirty || updateMutation.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              {updateMutation.isPending
                ? t("common.loading")
                : t("common.saveChanges")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Integrations Overview */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.company.integrations")}</CardTitle>
          <CardDescription>
            {t("settings.company.integrationsDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <IntegrationCard
              name="Twilio"
              description={t("settings.company.integrationTwilio")}
              connected={true}
              t={t}
            />
            <IntegrationCard
              name="WhatsApp Business"
              description={t("settings.company.integrationWhatsApp")}
              connected={true}
              t={t}
            />
            <IntegrationCard
              name="Stripe"
              description={t("settings.company.integrationStripe")}
              connected={true}
              t={t}
            />
            <IntegrationCard
              name="OpenAI"
              description={t("settings.company.integrationOpenAI")}
              connected={true}
              t={t}
            />
            <IntegrationCard
              name="Deepgram"
              description={t("settings.company.integrationDeepgram")}
              connected={true}
              t={t}
            />
            <IntegrationCard
              name="Sentry"
              description={t("settings.company.integrationSentry")}
              connected={true}
              t={t}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function IntegrationCard({
  name,
  description,
  connected,
  t,
}: {
  name: string;
  description: string;
  connected: boolean;
  t: (key: string) => string;
}) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-semibold">{name}</h4>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {description}
        </p>
      </div>
      <span
        className={`ml-3 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          connected
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
        }`}
      >
        {connected
          ? t("settings.company.connected")
          : t("settings.company.disconnected")}
      </span>
    </div>
  );
}
