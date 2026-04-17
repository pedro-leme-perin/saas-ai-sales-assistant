"use client";

import { Shield, ShieldCheck, Users, User } from "lucide-react";
import { UserRole } from "@/types";

interface RoleBadgeProps {
  role: UserRole;
}

const roleConfig: Record<
  UserRole,
  {
    icon: React.ComponentType<{ className?: string }>;
    colors: string;
    label: string;
  }
> = {
  [UserRole.OWNER]: {
    icon: Shield,
    colors:
      "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700",
    label: "Owner",
  },
  [UserRole.ADMIN]: {
    icon: ShieldCheck,
    colors:
      "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
    label: "Admin",
  },
  [UserRole.MANAGER]: {
    icon: Users,
    colors:
      "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
    label: "Manager",
  },
  [UserRole.VENDOR]: {
    icon: User,
    colors:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-600",
    label: "Vendor",
  },
};

export function RoleBadge({ role }: RoleBadgeProps) {
  const config = roleConfig[role];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${config.colors}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
