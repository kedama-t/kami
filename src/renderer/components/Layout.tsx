import React from "react";

interface LayoutProps {
  title: string;
  children: React.ReactNode;
  currentPath?: string;
  scripts?: string[];
}

export function Layout({ title, children, currentPath }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col" data-theme="">
      {/* Navbar */}
      <header className="navbar bg-base-200 shadow-sm">
        <div className="flex-1">
          <a href="/" className="btn btn-ghost text-xl">
            kami
          </a>
        </div>
        <div className="flex-none gap-2">
          {/* Search form */}
          <form action="/search" method="GET" className="form-control">
            <input
              type="text"
              name="q"
              placeholder="Search…"
              className="input input-bordered input-sm w-40 md:w-64"
            />
          </form>

          {/* New article button */}
          <a href="/new" className="btn btn-primary btn-sm">
            New
          </a>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 container mx-auto px-4 py-6 max-w-4xl">
        {children}
      </main>

      {/* Footer */}
      <footer className="footer footer-center p-4 bg-base-200 text-base-content">
        <aside>
          <p>kami — Knowledge Agent Markdown Interface</p>
        </aside>
      </footer>
    </div>
  );
}
