import React from "react";
import type { Scope } from "@/types/scope.ts";
import { ScopeBadge } from "./ScopeBadge.tsx";

interface BacklinkItem {
  slug: string;
  scope: Scope;
  title: string;
  folder: string;
}

interface BacklinkListProps {
  backlinks: BacklinkItem[];
}

export function BacklinkList({ backlinks }: BacklinkListProps) {
  if (backlinks.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 pt-4 border-t border-base-300">
      <h2 className="text-lg font-semibold mb-3">Backlinks</h2>
      <ul className="list">
        {backlinks.map((link) => (
          <li key={`${link.scope}-${link.slug}`} className="list-row">
            <a
              href={`/articles/${link.scope}/${link.folder}/${link.slug}`}
              className="link link-hover flex items-center gap-2"
            >
              <ScopeBadge scope={link.scope} />
              {link.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
