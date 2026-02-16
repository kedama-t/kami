import React from "react";
import type { Scope } from "@/types/scope.ts";

interface ScopeBadgeProps {
  scope: Scope;
}

export function ScopeBadge({ scope }: ScopeBadgeProps) {
  const className =
    scope === "local" ? "badge badge-primary" : "badge badge-secondary";
  return <span className={className}>{scope}</span>;
}
