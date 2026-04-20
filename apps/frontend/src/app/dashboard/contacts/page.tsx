"use client";

// =============================================
// 👥 Contacts List Page (Session 50)
// =============================================

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, UserRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Badge } from "@/components/ui/index";
import { useTranslation } from "@/i18n/use-translation";
import { contactsService, type Contact } from "@/services/contacts.service";

export default function ContactsPage() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [queryText, setQueryText] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["contacts", "list", queryText],
    queryFn: () => contactsService.list({ q: queryText || undefined, limit: 50 }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("contacts.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("contacts.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setQueryText(q.trim());
              }}
              className="flex w-full gap-2"
            >
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("contacts.searchPlaceholder")}
                className="flex-1"
              />
              <Button type="submit" size="sm">
                {t("contacts.searchPlaceholder").split(" ")[0] || "Search"}
              </Button>
            </form>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !data || data.data.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("contacts.empty")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left">{t("contacts.columns.name")}</th>
                    <th className="px-2 py-2 text-left">{t("contacts.columns.phone")}</th>
                    <th className="px-2 py-2 text-left">{t("contacts.columns.email")}</th>
                    <th className="px-2 py-2 text-right">{t("contacts.columns.calls")}</th>
                    <th className="px-2 py-2 text-right">{t("contacts.columns.chats")}</th>
                    <th className="px-2 py-2 text-left">{t("contacts.columns.tags")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((c: Contact) => (
                    <tr key={c.id} className="border-b hover:bg-muted/50">
                      <td className="px-2 py-2">
                        <Link
                          href={`/dashboard/contacts/${c.id}`}
                          className="flex items-center gap-2 font-medium text-primary hover:underline"
                        >
                          <UserRound className="h-4 w-4 text-muted-foreground" />
                          {c.name || "—"}
                        </Link>
                      </td>
                      <td className="px-2 py-2 font-mono text-xs">{c.phone}</td>
                      <td className="px-2 py-2">{c.email || "—"}</td>
                      <td className="px-2 py-2 text-right">{c.totalCalls}</td>
                      <td className="px-2 py-2 text-right">{c.totalChats}</td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-1">
                          {c.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
