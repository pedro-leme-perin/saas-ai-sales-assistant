"use client";

// =============================================
// 📁 SMART LISTS DRAWER (Session 48)
// =============================================
// Reusable sidebar for calls + whatsapp pages.
// Lists pinned + own + shared saved filters. Click → emits onSelect(filterJson).
// Create/update/pin/remove via inline modal.

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pin, PinOff, Plus, Trash2, Users, User as UserIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import {
  savedFiltersService,
  type FilterResource,
  type SavedFilter,
  type SavedFilterJson,
} from "@/services/saved-filters.service";

interface Props {
  resource: FilterResource;
  currentFilterJson?: SavedFilterJson;
  onSelect: (filter: SavedFilter) => void;
}

export function SmartListsDrawer({ resource, currentFilterJson, onSelect }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [shared, setShared] = useState(false);

  const { data: filters = [], isLoading } = useQuery({
    queryKey: ["saved-filters", resource],
    queryFn: () => savedFiltersService.list(resource),
  });

  const createMut = useMutation({
    mutationFn: () =>
      savedFiltersService.create({
        name: newName.trim(),
        resource,
        filterJson: currentFilterJson ?? {},
        shared,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-filters", resource] });
      setCreating(false);
      setNewName("");
      setShared(false);
      toast.success(t("savedFilters.created"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pinMut = useMutation({
    mutationFn: (id: string) => savedFiltersService.togglePin(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-filters", resource] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => savedFiltersService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-filters", resource] });
      toast.success(t("savedFilters.removed"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card className="w-full lg:w-72 flex-shrink-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{t("savedFilters.title")}</CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCreating((v) => !v)}
            aria-label={t("savedFilters.new")}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {creating && (
          <div className="p-2 border rounded space-y-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={60}
              placeholder={t("savedFilters.namePlaceholder")}
              className="w-full px-2 py-1 border rounded text-sm bg-background"
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={shared}
                onChange={(e) => setShared(e.target.checked)}
              />
              {t("savedFilters.sharedLabel")}
            </label>
            <div className="flex justify-end gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCreating(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                size="sm"
                disabled={!newName.trim() || createMut.isPending}
                onClick={() => createMut.mutate()}
              >
                {t("common.save")}
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            {t("common.loading")}
          </p>
        ) : filters.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            {t("savedFilters.empty")}
          </p>
        ) : (
          filters.map((f) => (
            <SavedFilterRow
              key={f.id}
              filter={f}
              onSelect={() => onSelect(f)}
              onPin={() => pinMut.mutate(f.id)}
              onRemove={() => removeMut.mutate(f.id)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function SavedFilterRow({
  filter,
  onSelect,
  onPin,
  onRemove,
}: {
  filter: SavedFilter;
  onSelect: () => void;
  onPin: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const isShared = filter.userId === null;

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-accent group">
      <button
        onClick={onSelect}
        className="flex-1 min-w-0 flex items-center gap-2 text-left"
      >
        {isShared ? (
          <Users className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <UserIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        )}
        <span className="text-sm truncate">{filter.name}</span>
      </button>
      <button
        onClick={onPin}
        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground"
        aria-label={filter.isPinned ? t("savedFilters.unpin") : t("savedFilters.pin")}
      >
        {filter.isPinned ? (
          <Pin className="w-3.5 h-3.5 fill-current" />
        ) : (
          <PinOff className="w-3.5 h-3.5" />
        )}
      </button>
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive"
        aria-label={t("common.remove")}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
