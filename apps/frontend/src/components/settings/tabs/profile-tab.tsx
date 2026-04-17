"use client";

import { useCallback } from "react";
import { UserResource } from "@clerk/types";
import { Save } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ProfileTabProps {
  user?: UserResource | null;
  t: (key: string) => string;
}

export default function ProfileTab({ user, t }: ProfileTabProps) {
  const handleSave = useCallback(() => {
    toast.success(t("common.saveChanges"));
  }, [t]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.profile.title")}</CardTitle>
        <CardDescription>{t("settings.profile.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
            {user?.firstName?.[0]}
            {user?.lastName?.[0]}
          </div>
          <div>
            <p className="font-medium">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-sm text-muted-foreground">
              {user?.primaryEmailAddress?.emailAddress}
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium">
              {t("settings.profile.firstName")}
            </label>
            <input
              type="text"
              defaultValue={user?.firstName || ""}
              className="w-full mt-1 px-4 py-2 border rounded-lg bg-background"
            />
          </div>
          <div>
            <label className="text-sm font-medium">
              {t("settings.profile.lastName")}
            </label>
            <input
              type="text"
              defaultValue={user?.lastName || ""}
              className="w-full mt-1 px-4 py-2 border rounded-lg bg-background"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium">
              {t("settings.profile.email")}
            </label>
            <input
              type="email"
              defaultValue={user?.primaryEmailAddress?.emailAddress || ""}
              className="w-full mt-1 px-4 py-2 border rounded-lg bg-background"
              disabled
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t("settings.profile.emailHint")}
            </p>
          </div>
        </div>
        <Button onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          {t("common.saveChanges")}
        </Button>
      </CardContent>
    </Card>
  );
}
