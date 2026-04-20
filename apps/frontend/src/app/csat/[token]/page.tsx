"use client";

// =============================================
// ⭐ Public CSAT Survey Page (Session 50) — no auth
// =============================================

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import { csatService, type CsatPublicLookup } from "@/services/csat.service";

export default function PublicCsatPage() {
  const { t } = useTranslation();
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [lookup, setLookup] = useState<CsatPublicLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) return;
    csatService
      .publicLookup(token)
      .then((data) => setLookup(data))
      .catch(() => setError(t("csat.public.invalid")))
      .finally(() => setLoading(false));
  }, [token, t]);

  const handleSubmit = async () => {
    if (score < 1 || score > 5) return;
    setSubmitting(true);
    try {
      await csatService.publicSubmit(token, score, comment.trim() || undefined);
      setSubmitted(true);
    } catch {
      setError(t("csat.public.submitErr"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-2xl">
            <Star className="h-6 w-6 text-amber-500" />
            {t("csat.public.title")}
          </CardTitle>
          {lookup?.companyName && (
            <p className="mt-1 text-sm text-muted-foreground">
              {lookup.companyName}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : error ? (
            <p className="py-6 text-center text-sm text-destructive">{error}</p>
          ) : !lookup ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("csat.public.invalid")}
            </p>
          ) : lookup.status === "RESPONDED" || submitted ? (
            <div className="space-y-2 py-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
              <p className="text-lg font-semibold">
                {t("csat.public.thanksTitle")}
              </p>
              <p className="text-sm text-muted-foreground">
                {submitted
                  ? t("csat.public.thanksSubtitle")
                  : t("csat.public.alreadyResponded")}
              </p>
            </div>
          ) : lookup.status === "EXPIRED" ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("csat.public.expired")}
            </p>
          ) : (
            <>
              <p className="text-center text-sm text-muted-foreground">
                {t("csat.public.subtitle")}
              </p>
              <div>
                <p className="mb-2 text-center text-xs uppercase text-muted-foreground">
                  {t("csat.public.scoreLabel")}
                </p>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onMouseEnter={() => setHover(n)}
                      onMouseLeave={() => setHover(0)}
                      onClick={() => setScore(n)}
                      className="transition-transform hover:scale-110"
                      aria-label={`${n} stars`}
                    >
                      <Star
                        className={`h-10 w-10 ${
                          (hover || score) >= n
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/40"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground">
                  {t("csat.public.commentLabel")}
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t("csat.public.commentPlaceholder")}
                  rows={3}
                  maxLength={1000}
                  className="mt-1 w-full rounded border bg-background p-2 text-sm"
                />
              </div>
              <Button
                className="w-full"
                disabled={score < 1 || submitting}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("csat.public.submit")
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
