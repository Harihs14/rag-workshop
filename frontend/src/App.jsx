import { useEffect, useState } from "react";
import { BookOpen, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Chat from "@/components/Chat";
import UploadPanel from "@/components/UploadPanel";
import { getHealth } from "@/lib/api";

export default function App() {
  const [doc, setDoc] = useState(null);
  const [health, setHealth] = useState(null); // null = checking, false = backend down

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(false));
  }, []);

  return (
    <div className="grid h-screen grid-cols-1 md:grid-cols-[340px_1fr]">
      {/* ── Sidebar ── */}
      <aside className="glass-sidebar flex flex-col gap-6 overflow-y-auto border-b border-border/50 p-6 md:border-r md:border-b-0">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
            <BookOpen className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight">RAG AI Tutor</h1>
            <p className="text-xs text-muted-foreground">Ask your documents anything</p>
          </div>
        </div>

        {/* Upload area */}
        <UploadPanel doc={doc} onReady={setDoc} />

        {/* Status */}
        <div className="mt-auto space-y-2 text-sm">
          {health === null && (
            <p className="flex items-center gap-2 text-muted-foreground animate-fade-in">
              <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground animate-pulse" />
              Checking backend…
            </p>
          )}
          {health === false && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive animate-fade-in">
              <WifiOff className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium text-xs">Backend not reachable</p>
                <p className="text-xs opacity-80 mt-0.5">Run: uvicorn app.main:app --reload</p>
              </div>
            </div>
          )}
          {health && (
            <div className="flex items-center gap-2 animate-fade-in">
              <Wifi className="size-3.5 text-primary" />
              <Badge variant="primary">{health.provider} · {health.model}</Badge>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Chat ── */}
      <main className="chat-bg min-h-0">
        <Chat doc={doc} />
      </main>
    </div>
  );
}
