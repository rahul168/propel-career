export function Footer() {
  const year = new Date().getFullYear();
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";
  const commit = process.env.NEXT_PUBLIC_COMMIT_SHA ?? "dev";

  return (
    <footer className="border-t border-slate-100 bg-white">
      <div className="max-w-6xl mx-auto px-4 h-10 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          © {year} Propel8. All rights reserved.
        </span>
        <span className="text-xs text-slate-400 font-mono">
          v{version} · {commit}
        </span>
      </div>
    </footer>
  );
}
