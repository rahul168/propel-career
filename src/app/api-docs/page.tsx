"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

const HIDDEN_TAGS = new Set(["Admin", "Stripe"]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filterSpec(spec: any): any {
  const filteredPaths: Record<string, unknown> = {};

  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pathItem = item as Record<string, any>;
    const filteredItem: Record<string, unknown> = {};

    for (const method of ["get", "post", "put", "patch", "delete"]) {
      const op = pathItem[method];
      if (!op) continue;
      const tags: string[] = op.tags ?? [];
      if (tags.some((t) => HIDDEN_TAGS.has(t))) continue;
      filteredItem[method] = op;
    }

    if (Object.keys(filteredItem).length > 0) {
      filteredPaths[path] = filteredItem;
    }
  }

  return { ...spec, paths: filteredPaths };
}

export default function ApiDocsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [spec, setSpec] = useState<any>(null);

  useEffect(() => {
    fetch("/api/docs")
      .then((r) => r.json())
      .then((raw) => setSpec(filterSpec(raw)));
  }, []);

  return (
    <div className="min-h-screen">
      {spec && <SwaggerUI spec={spec} />}
    </div>
  );
}
