"use client";

// =============================================
// ⚡ MACRO BUTTON (Session 56 — Feature A2)
// =============================================
// Dropdown to trigger saved macros against a chat.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { macrosService, type Macro } from "@/services/macros.service";
import { useTranslation } from "@/i18n/use-translation";

interface Props {
  chatId: string;
}

export function MacroButton({ chatId }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: macros = [] } = useQuery({
    queryKey: ["macros"],
    queryFn: () => macrosService.list(),
    staleTime: 60_000,
  });

  const activeMacros = macros.filter((m: Macro) => m.isActive);

  const exec = useMutation({
    mutationFn: (macroId: string) => macrosService.execute(macroId, chatId),
    onSuccess: (res) => {
      const failed = res.executed.filter((a) => !a.success).length;
      if (failed === 0) {
        toast.success(t("macros.toast.executeOk"));
      } else {
        toast.warning(
          t("macros.toast.executePartial", {
            done: String(res.executed.length - failed),
            total: String(res.executed.length),
          }),
        );
      }
      qc.invalidateQueries({ queryKey: ["whatsapp", "chat", chatId] });
      qc.invalidateQueries({ queryKey: ["whatsapp", "messages", chatId] });
      qc.invalidateQueries({ queryKey: ["macros"] });
    },
    onError: () => {
      toast.error(t("macros.toast.executeErr"));
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Zap className="w-4 h-4" />
          {t("macros.run")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>{t("macros.pickMacro")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {activeMacros.length === 0 ? (
          <div className="px-2 py-3 text-xs text-muted-foreground text-center">
            {t("macros.empty")}
          </div>
        ) : (
          activeMacros.map((macro: Macro) => (
            <DropdownMenuItem
              key={macro.id}
              disabled={exec.isPending}
              onClick={() => exec.mutate(macro.id)}
              className="flex flex-col items-start gap-0.5 cursor-pointer"
            >
              <span className="font-medium text-sm">{macro.name}</span>
              <span className="text-[11px] text-muted-foreground">
                {macro.actions.length} {t("macros.actionsShort")} ·{" "}
                {macro.usageCount}x
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default MacroButton;
