"use client";

import { Key, Shield } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SecurityTabProps {
  t: (key: string) => string;
}

export default function SecurityTab({ t }: SecurityTabProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.security.authentication")}</CardTitle>
          <CardDescription>
            {t("settings.security.authSubtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Key className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {t("settings.security.twoFactor")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("settings.security.twoFactorDesc")}
                </p>
              </div>
            </div>
            <Button variant="outline">{t("common.configure")}</Button>
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {t("settings.security.activeSessions")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("settings.security.activeSessionsDesc")}
                </p>
              </div>
            </div>
            <Button variant="outline">{t("common.viewSessions")}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.security.apiKeys")}</CardTitle>
          <CardDescription>
            {t("settings.security.apiKeysDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div>
              <p className="font-mono text-sm">sk_live_••••••••••••••••</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("settings.security.createdAt")}
              </p>
            </div>
            <Button variant="outline" size="sm">
              {t("common.regenerate")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
