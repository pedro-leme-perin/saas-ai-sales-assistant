"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Search,
  Plus,
  Sparkles,
  Clock,
  MoreVertical,
  Mic,
  MicOff,
  X,
  MessageSquare,
  Timer,
  Copy,
  Check,
  ChevronRight,
  Download,
  Loader2,
  Play,
  Pause,
  Volume2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { callsService } from "@/services/api";
import { summariesService, type ConversationSummary } from "@/services/summaries.service";
import { SummaryModal } from "@/components/dashboard/summaries/summary-modal";
import {
  formatDuration,
  formatDateTime,
  formatPhone,
  getCallStatusColor,
} from "@/lib/utils";
import {
  CallStatus,
  CallDirection,
  type Call,
  type AISuggestion,
} from "@/types";
import { logger } from "@/lib/logger";

/** Extended Call type with relations loaded by getById */
interface CallDetail extends Call {
  aiSuggestions?: Array<AISuggestion & { wasUsed?: boolean; content?: string }>;
}
import {
  useActiveCallStore,
  useAISuggestionsStore,
  useUserStore,
} from "@/stores";
import { wsClient } from "@/lib/websocket";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/use-translation";

const SUGGESTION_TYPE_COLORS: Record<string, string> = {
  objection: "bg-amber-100 text-amber-700 border-amber-200",
  closing: "bg-green-100 text-green-700 border-green-200",
  question: "bg-blue-100 text-blue-700 border-blue-200",
  greeting: "bg-purple-100 text-purple-700 border-purple-200",
  general: "bg-slate-100 text-slate-700 border-slate-200",
};

function getSuggestionColor(type: string) {
  return SUGGESTION_TYPE_COLORS[type] || SUGGESTION_TYPE_COLORS.general;
}

// Barra de confianca visual
function ConfidenceBar({ value }: { value: number }) {
  const percentage = Math.round(value * 100);
  const color =
    percentage >= 80
      ? "bg-green-500"
      : percentage >= 60
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {percentage}%
      </span>
    </div>
  );
}

function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const time = parseFloat(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3 border">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => setIsPlaying(false)}
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={toggle}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>
      <span className="text-xs text-muted-foreground tabular-nums w-10">
        {fmt(currentTime)}
      </span>
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={currentTime}
        onChange={handleSeek}
        className="flex-1 h-1.5 accent-primary cursor-pointer"
      />
      <span className="text-xs text-muted-foreground tabular-nums w-10">
        {fmt(duration)}
      </span>
      <Volume2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </div>
  );
}

export default function CallsPage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [showNewCallModal, setShowNewCallModal] = useState(false);
  const [newCallPhone, setNewCallPhone] = useState("");
  const [copiedSuggestion, setCopiedSuggestion] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const {
    activeCallId,
    isInCall,
    callDuration,
    transcript,
    setActiveCall,
    setDuration,
    endCall,
  } = useActiveCallStore();
  const { isLoading: authLoading, user } = useUserStore();
  const { currentSuggestion, isGenerating } = useAISuggestionsStore();

  // Timer
  useEffect(() => {
    if (isInCall) {
      timerRef.current = setInterval(() => {
        setDuration(useActiveCallStore.getState().callDuration + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isInCall, setDuration]);

  // Focus no input quando modal abre
  useEffect(() => {
    if (showNewCallModal) {
      setTimeout(() => phoneInputRef.current?.focus(), 100);
    }
  }, [showNewCallModal]);

  // Escape fecha modais
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showNewCallModal) setShowNewCallModal(false);
        else if (selectedCall) setSelectedCall(null);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showNewCallModal, selectedCall]);

  // Queries
  const { data: callDetail } = useQuery<CallDetail>({
    queryKey: ["call-detail", selectedCall?.id],
    queryFn: () =>
      callsService.getById(selectedCall!.id) as Promise<CallDetail>,
    enabled: !!selectedCall,
  });

  const { data: callsData, isLoading } = useQuery({
    queryKey: [
      "calls",
      { status: statusFilter, direction: directionFilter, search: searchQuery },
    ],
    enabled: !authLoading && !!user,
    queryFn: async () => {
      const res = await callsService.getAll({
        status: statusFilter !== "all" ? statusFilter : undefined,
        direction: directionFilter !== "all" ? directionFilter : undefined,
        search: searchQuery || undefined,
        limit: 20,
      });
      return res as { data: Call[]; meta: { total: number } };
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["call-stats"],
    queryFn: () => callsService.getStats(),
  });

  // Mutations
  const startCallMutation = useMutation({
    mutationFn: (phoneNumber: string) =>
      callsService.create({ phoneNumber, direction: "OUTBOUND" }),
    onSuccess: (call) => {
      setActiveCall(call.id);
      wsClient.joinCall(call.id);
      queryClient.invalidateQueries({ queryKey: ["calls"] });
      setShowNewCallModal(false);
      setNewCallPhone("");
      toast.success(t("calls.callStarted"), {
        description: t("calls.dialingTo", {
          phone: formatPhone(call.phoneNumber),
        }),
      });
    },
    onError: (error: Error) => {
      toast.error(t("calls.errorStartCall"), {
        description: error.message || t("calls.tryAgain"),
      });
    },
  });

  const endCallMutation = useMutation({
    mutationFn: (callId: string) => callsService.endCall(callId),
    onSuccess: () => {
      if (activeCallId) wsClient.leaveCall(activeCallId);
      const duration = callDuration;
      endCall();
      queryClient.invalidateQueries({ queryKey: ["calls"] });
      toast.info(t("calls.callEnded"), {
        description: t("calls.duration", {
          duration: formatDuration(duration),
        }),
      });
    },
  });

  const analyzeCallMutation = useMutation({
    mutationFn: (callId: string) => callsService.analyzeCall(callId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["call-detail", selectedCall?.id],
      });
      toast.success(t("calls.analysisComplete"));
    },
  });

  // Handlers
  const handleStartCall = () => {
    if (!newCallPhone.trim()) return;
    startCallMutation.mutate(newCallPhone.trim());
  };

  const handleEndCall = () => {
    if (activeCallId) endCallMutation.mutate(activeCallId);
  };

  const handleCopySuggestion = useCallback(() => {
    if (!currentSuggestion?.suggestion) return;
    navigator.clipboard.writeText(currentSuggestion.suggestion);
    setCopiedSuggestion(true);
    toast.success(t("calls.suggestionCopied"));
    setTimeout(() => setCopiedSuggestion(false), 2000);
  }, [currentSuggestion, t]);

  const getCallIcon = (call: Call) => {
    if (call.status === "MISSED") return PhoneMissed;
    return call.direction === "INBOUND" ? PhoneIncoming : PhoneOutgoing;
  };

  const getCallIconColor = (call: Call) => {
    if (call.status === "MISSED") return "text-red-500 bg-red-50";
    return call.direction === "INBOUND"
      ? "text-blue-500 bg-blue-50"
      : "text-green-500 bg-green-50";
  };

  const getStatusLabel = (status: string) => {
    if (status === "COMPLETED") return t("calls.statusCompleted");
    if (status === "MISSED") return t("calls.statusMissed");
    if (status === "IN_PROGRESS") return t("calls.statusInProgress");
    return status;
  };

  const handleGenerateSummary = useCallback(async () => {
    if (!selectedCall) return;
    setSummary(null);
    setSummaryError(null);
    setSummaryLoading(true);
    setSummaryOpen(true);
    try {
      const result = await summariesService.summarizeCall(selectedCall.id);
      setSummary(result);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : t("summaries.errorGeneric");
      setSummaryError(msg);
      logger.api.error("Summary generation failed", error);
    } finally {
      setSummaryLoading(false);
    }
  }, [selectedCall, t]);

  const handleExportCsv = async () => {
    try {
      setExportingCsv(true);
      const csv = await callsService.exportCsv();

      // Create blob and download
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `calls-export-${Date.now()}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(t("calls.exportSuccess"));
    } catch (error) {
      logger.api.error("CSV export failed", error);
      toast.error(t("calls.exportError"));
    } finally {
      setExportingCsv(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {t("calls.title")}
          </h1>
          <p className="text-muted-foreground">{t("calls.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportCsv}
            disabled={exportingCsv}
          >
            {exportingCsv ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {t("calls.export")}
          </Button>
          <Button onClick={() => setShowNewCallModal(true)} disabled={isInCall}>
            <Plus className="mr-2 h-4 w-4" />
            {t("calls.newCall")}
          </Button>
        </div>
      </div>

      {/* Active Call Panel */}
      {isInCall && (
        <Card className="border-primary/50 bg-gradient-to-r from-primary/5 to-primary/10 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Call Info + Transcript */}
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Phone className="h-6 w-6" />
                    </div>
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500" />
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">
                      {t("calls.callInProgress")}
                    </h3>
                    <div className="flex items-center gap-2 text-sm">
                      <Timer className="h-4 w-4 text-primary" />
                      <span className="font-mono text-lg font-bold text-primary tabular-nums">
                        {formatDuration(callDuration)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Transcript */}
                <div className="bg-background/80 backdrop-blur rounded-lg p-4 max-h-48 overflow-y-auto mb-4 border">
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                    {t("calls.liveTranscript")}
                  </p>
                  {transcript.length > 0 ? (
                    <div className="space-y-2">
                      {transcript.slice(-5).map((entry, idx) => (
                        <div key={idx} className="flex gap-2">
                          <span
                            className={`text-xs font-semibold shrink-0 w-16 ${
                              entry.speaker === "customer"
                                ? "text-blue-600"
                                : "text-green-600"
                            }`}
                          >
                            {entry.speaker === "customer"
                              ? t("common.customer")
                              : t("common.you")}
                          </span>
                          <p className="text-sm leading-relaxed">
                            {entry.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="flex space-x-1">
                        <div className="h-2 w-2 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.3s]" />
                        <div className="h-2 w-2 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.15s]" />
                        <div className="h-2 w-2 rounded-full bg-primary/40 animate-bounce" />
                      </div>
                      {t("calls.waitingTranscript")}
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={t("calls.muteLabel")}
                    className="gap-2"
                  >
                    <Mic className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("calls.mute")}</span>
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleEndCall}
                    aria-label={t("calls.endCallLabel")}
                    className="gap-2"
                  >
                    <Phone className="h-4 w-4 rotate-[135deg]" />
                    {t("calls.endCall")}
                  </Button>
                </div>
              </div>

              {/* AI Suggestion Panel */}
              <div className="lg:w-80 bg-background/80 backdrop-blur rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h4 className="font-semibold">{t("ai.suggestion")}</h4>
                </div>

                {isGenerating ? (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground py-4">
                    <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                    {t("ai.generating")}
                  </div>
                ) : currentSuggestion ? (
                  <div className="space-y-3">
                    <p className="text-sm leading-relaxed">
                      {currentSuggestion.suggestion}
                    </p>

                    {/* Tag */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${getSuggestionColor(currentSuggestion.type)}`}
                      >
                        {t(`ai.tags.${currentSuggestion.type}`) ||
                          currentSuggestion.type}
                      </span>
                    </div>

                    <ConfidenceBar value={currentSuggestion.confidence} />

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={handleCopySuggestion}
                    >
                      {copiedSuggestion ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-green-500" />{" "}
                          {t("ai.copied")}
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />{" "}
                          {t("ai.copySuggestion")}
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="py-4 text-center">
                    <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {t("ai.continueForSuggestions")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("calls.total")}
                </p>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
              </div>
              <Phone className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("calls.completed")}
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {stats?.byStatus?.COMPLETED || 0}
                </p>
              </div>
              <PhoneOutgoing className="h-8 w-8 text-green-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("calls.missed")}
                </p>
                <p className="text-2xl font-bold text-red-600">
                  {stats?.byStatus?.MISSED || 0}
                </p>
              </div>
              <PhoneMissed className="h-8 w-8 text-red-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("calls.avgDuration")}
                </p>
                <p className="text-2xl font-bold">
                  {formatDuration(stats?.avgDuration || 0)}
                </p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t("calls.searchPlaceholder")}
            className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="px-4 py-2 border rounded-lg bg-background text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">{t("calls.allStatuses")}</option>
          <option value="COMPLETED">{t("calls.completed")}</option>
          <option value="MISSED">{t("calls.missed")}</option>
          <option value="IN_PROGRESS">{t("calls.inProgress")}</option>
        </select>
        <select
          className="px-4 py-2 border rounded-lg bg-background text-sm"
          value={directionFilter}
          onChange={(e) => setDirectionFilter(e.target.value)}
        >
          <option value="all">{t("calls.allDirections")}</option>
          <option value="INBOUND">{t("calls.inbound")}</option>
          <option value="OUTBOUND">{t("calls.outbound")}</option>
        </select>
      </div>

      {/* Calls List */}
      <Card>
        <CardHeader>
          <CardTitle>{t("calls.callHistory")}</CardTitle>
          <CardDescription>
            {callsData?.meta?.total || 0} {t("calls.callsFound")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 rounded-lg border animate-pulse"
                >
                  <div className="h-10 w-10 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-24 bg-muted rounded" />
                  </div>
                  <div className="space-y-2 text-right">
                    <div className="h-4 w-16 bg-muted rounded ml-auto" />
                    <div className="h-3 w-20 bg-muted rounded ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          ) : callsData?.data && callsData.data.length > 0 ? (
            <div className="space-y-2">
              {callsData.data.map((call) => {
                const CallIcon = getCallIcon(call);
                return (
                  <div
                    key={call.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer group"
                    onClick={() => setSelectedCall(call)}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${getCallIconColor(call)}`}
                      >
                        <CallIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {call.contactName || formatPhone(call.phoneNumber)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDateTime(call.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-mono">
                          {formatDuration(call.duration)}
                        </p>
                        <p
                          className={`text-xs ${getCallStatusColor(call.status)}`}
                        >
                          {getStatusLabel(call.status)}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Phone className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <h3 className="text-lg font-medium mb-2">{t("calls.noCalls")}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("calls.noCallsHint")}
              </p>
              <Button onClick={() => setShowNewCallModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t("calls.newCall")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Nova Ligacao */}
      {showNewCallModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowNewCallModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("calls.newCall")}
            className="bg-background rounded-xl shadow-2xl w-full max-w-md m-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-lg font-semibold">{t("calls.newCall")}</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowNewCallModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  {t("calls.phoneNumber")}
                </label>
                <input
                  ref={phoneInputRef}
                  type="tel"
                  placeholder={t("calls.phonePlaceholder")}
                  className="w-full px-4 py-3 border rounded-lg bg-background text-lg font-mono"
                  value={newCallPhone}
                  onChange={(e) => setNewCallPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleStartCall()}
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  {t("calls.phoneHint")}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowNewCallModal(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={handleStartCall}
                  disabled={!newCallPhone.trim() || startCallMutation.isPending}
                >
                  {startCallMutation.isPending ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      {t("calls.dialing")}
                    </>
                  ) : (
                    <>
                      <Phone className="h-4 w-4" />
                      {t("calls.dial")}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Detalhe da Ligacao */}
      {selectedCall && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedCall(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("calls.callDetails")}
            className="bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto m-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-background/95 backdrop-blur z-10">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold">
                    {selectedCall.contactName ||
                      formatPhone(selectedCall.phoneNumber)}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(selectedCall.createdAt)} ·{" "}
                    {formatDuration(selectedCall.duration)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {callDetail?.transcript && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleGenerateSummary}
                    disabled={summaryLoading}
                  >
                    <Sparkles className="h-4 w-4" />
                    {t("summaries.generate")}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedCall(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Transcript */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium">{t("calls.transcript")}</h3>
                </div>
                {callDetail?.transcript ? (
                  <div className="bg-muted/50 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap border">
                    {callDetail.transcript}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    {t("calls.noTranscript")}
                  </p>
                )}
              </div>

              {/* Recording Playback */}
              {callDetail?.recordingUrl && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-medium">{t("calls.recording")}</h3>
                  </div>
                  <AudioPlayer src={callDetail.recordingUrl} />
                </div>
              )}

              {/* AI Suggestions */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="font-medium">{t("calls.aiSuggestions")}</h3>
                </div>
                {callDetail?.aiSuggestions &&
                callDetail.aiSuggestions.length > 0 ? (
                  <div className="space-y-2">
                    {callDetail.aiSuggestions.map((s, i) => (
                      <div
                        key={i}
                        className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2"
                      >
                        <p className="text-sm leading-relaxed">{s.content}</p>
                        <ConfidenceBar value={s.confidence || 0.8} />
                        {s.wasUsed && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600">
                            <Check className="h-3 w-3" /> {t("common.used")}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <p className="text-sm text-muted-foreground italic">
                      {t("ai.noSuggestions")}
                    </p>
                    {callDetail?.transcript && (
                      <Button
                        onClick={() =>
                          analyzeCallMutation.mutate(selectedCall!.id)
                        }
                        disabled={analyzeCallMutation.isPending}
                        size="sm"
                        className="gap-2"
                      >
                        {analyzeCallMutation.isPending ? (
                          <>
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                            {t("calls.analyzing")}
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            {t("calls.analyzeWithAI")}
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal (AI-generated) */}
      <SummaryModal
        isOpen={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        summary={summary}
        loading={summaryLoading}
        error={summaryError}
        title={t("summaries.callTitle")}
      />
    </div>
  );
}
