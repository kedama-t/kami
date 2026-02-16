import React from "react";

interface TagBadgeProps {
  tag: string;
  count?: number;
  href?: string;
}

export function TagBadge({ tag, count, href }: TagBadgeProps) {
  const badge = (
    <span className="badge badge-outline">
      {tag}
      {count != null && ` (${count})`}
    </span>
  );

  if (href) {
    return <a href={href}>{badge}</a>;
  }

  return badge;
}
