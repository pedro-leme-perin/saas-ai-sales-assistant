"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { UserPlus, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import { UserRole } from "@/types";

export interface InviteData {
  email: string;
  role: UserRole;
  message?: string;
}

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (data: InviteData) => Promise<void>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ASSIGNABLE_ROLES = [
  { value: UserRole.VENDOR, labelKey: "team.invite.roleVendor" },
  { value: UserRole.MANAGER, labelKey: "team.invite.roleManager" },
  { value: UserRole.ADMIN, labelKey: "team.invite.roleAdmin" },
] as const;

export function InviteMemberModal({
  isOpen,
  onClose,
  onInvite,
}: InviteMemberModalProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.VENDOR);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState("");
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Focus email input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => emailInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setEmail("");
      setRole(UserRole.VENDOR);
      setMessage("");
      setEmailError("");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const validateEmail = useCallback(
    (value: string): boolean => {
      if (!value.trim()) {
        setEmailError(t("team.invite.emailRequired"));
        return false;
      }
      if (!EMAIL_REGEX.test(value)) {
        setEmailError(t("team.invite.emailInvalid"));
        return false;
      }
      setEmailError("");
      return true;
    },
    [t],
  );

  const handleSubmit = async () => {
    if (!validateEmail(email)) return;

    setIsSubmitting(true);
    try {
      await onInvite({
        email: email.trim(),
        role,
        message: message.trim() || undefined,
      });
      onClose();
    } catch {
      // Error handling is expected to be done by the parent via onInvite
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (emailError) {
      // Clear error when user starts typing again
      setEmailError("");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-modal-title"
        className="bg-background rounded-xl shadow-2xl w-full max-w-md m-4 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <UserPlus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 id="invite-modal-title" className="text-lg font-semibold">
                {t("team.invite.title")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("team.invite.subtitle")}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("common.close")}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Email */}
          <div>
            <label
              htmlFor="invite-email"
              className="text-sm font-medium mb-1.5 block"
            >
              {t("team.invite.emailLabel")}
            </label>
            <input
              id="invite-email"
              ref={emailInputRef}
              type="email"
              placeholder={t("team.invite.emailPlaceholder")}
              className={`w-full px-4 py-2.5 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                emailError
                  ? "border-red-500 focus:ring-red-500"
                  : "border-input"
              }`}
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              onBlur={() => email && validateEmail(email)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
            {emailError && (
              <p className="text-xs text-red-500 mt-1">{emailError}</p>
            )}
          </div>

          {/* Role */}
          <div>
            <label
              htmlFor="invite-role"
              className="text-sm font-medium mb-1.5 block"
            >
              {t("team.invite.roleLabel")}
            </label>
            <select
              id="invite-role"
              className="w-full px-4 py-2.5 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {t(r.labelKey)}
                </option>
              ))}
            </select>
          </div>

          {/* Optional message */}
          <div>
            <label
              htmlFor="invite-message"
              className="text-sm font-medium mb-1.5 block"
            >
              {t("team.invite.messageLabel")}
              <span className="text-muted-foreground font-normal ml-1">
                ({t("team.invite.optional")})
              </span>
            </label>
            <textarea
              id="invite-message"
              placeholder={t("team.invite.messagePlaceholder")}
              className="w-full px-4 py-2.5 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows={3}
              maxLength={500}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {message.length}/500
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handleSubmit}
              disabled={!email.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {t("team.invite.submit")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
