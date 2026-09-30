import { useEffect, useRef, useState } from "react";
import { BookOpen, FileText, Loader2, SendHorizontal, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askQuestion } from "@/lib/api";

const STARTERS = [
  "Summarize this document in 5 bullets",
  "What are the key terms I should know?",
  "Explain the main idea like I'm new to it",
];

/* ── Skeleton loader while the LLM is thinking ── */
function SkeletonResponse() {
  return (
    <div className="max-w-[85%] space-y-4 animate-fade-in">
      {/* Avatar + label row */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles className="size-3.5 text-primary" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">Thinking</span>
        <div className="thinking-dots flex gap-1 ml-1">
          <span /><span /><span />
        </div>
      </div>
      {/* Shimmer lines */}
      <div className="space-y-3 pl-9">
        <div className="skeleton-line h-4 w-full" />
        <div className="skeleton-line h-4 w-[92%]" />
        <div className="skeleton-line h-4 w-[78%]" />
        <div className="skeleton-line h-4 w-[85%]" style={{ animationDelay: "0.1s" }} />
        <div className="skeleton-line h-4 w-[60%]" style={{ animationDelay: "0.2s" }} />
      </div>
      {/* Source skeleton */}
      <div className="pl-9 mt-3 space-y-2">
        <div className="skeleton-line h-3 w-24" style={{ animationDelay: "0.3s" }} />
        <div className="flex gap-2">
          <div className="skeleton-line h-6 w-16 rounded-md" style={{ animationDelay: "0.35s" }} />
          <div className="skeleton-line h-6 w-16 rounded-md" style={{ animationDelay: "0.4s" }} />
        </div>
      </div>
    </div>
  );
}

/* ── Inline citations: clickable page badges ── */
function CitationBadges({ sources, onCitationClick }) {
  if (!sources?.length) return null;

  // Deduplicate pages and keep the best score for each
  const pageMap = new Map();
  for (const s of sources) {
    const existing = pageMap.get(s.page);
    if (!existing || s.score > existing.score) {
      pageMap.set(s.page, s);
    }
  }
  const uniquePages = [...pageMap.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <div className="flex flex-wrap gap-1.5 mt-2 pl-9">
      {uniquePages.map(([page, src]) => (
        <Badge
          key={page}
          variant="citation"
          role="button"
          tabIndex={0}
          title={`Jump to page ${page} source (score: ${src.score})`}
          onClick={() => onCitationClick(page)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onCitationClick(page); }}
        >
          <FileText className="size-3" />
          p.{page}
        </Badge>
      ))}
    </div>
  );
}

/* ── Expanded source panel (scrolls into view when a citation is clicked) ── */
function Sources({ sources, highlightPage }) {
  if (!sources?.length) return null;

  return (
    <div className="mt-3 pl-9 space-y-2 animate-fade-in">
      <p className="text-xs font-medium text-muted-foreground">
        Sources ({sources.length} passages)
      </p>
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {sources.map((s, i) => (
          <div
            key={i}
            id={`source-page-${s.page}-${i}`}
            data-page={s.page}
            className={`rounded-lg border p-3 text-sm transition-all duration-300 ${
              highlightPage === s.page
                ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                : "border-border/50 bg-card/50"
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Badge variant="outline" className="text-[10px]">Page {s.page}</Badge>
              <span className="text-[10px] text-muted-foreground">· match {s.score}</span>
            </div>
            <p className="font-serif text-xs leading-relaxed text-muted-foreground line-clamp-4">
              <mark className="bg-highlight/20 text-foreground px-0.5 rounded">{s.text}</mark>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main Chat Component ── */
export default function Chat({ doc }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [expandedSources, setExpandedSources] = useState(null); // index of message whose sources are open
  const [highlightPage, setHighlightPage] = useState(null);
  const endRef = useRef(null);
  const sourcesContainerRef = useRef(null);

  // New PDF = fresh conversation
  useEffect(() => { setMessages([]); setExpandedSources(null); setHighlightPage(null); }, [doc?.doc_id]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  function handleCitationClick(msgIndex, page) {
    setExpandedSources(msgIndex);
    setHighlightPage(page);

    // Scroll the matching source into view after render
    requestAnimationFrame(() => {
      const el = document.querySelector(`#source-page-${page}-0`) ||
                 document.querySelector(`[data-page="${page}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });

    // Clear highlight after animation
    setTimeout(() => { setHighlightPage(null); }, 2000);
  }

  async function send(question) {
    const q = question.trim();
    if (!q || busy || !doc) return;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setBusy(true);
    setExpandedSources(null);
    try {
      const res = await askQuestion(doc.doc_id, q);
      setMessages((m) => [...m, { role: "assistant", content: res.answer, sources: res.sources }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: e.message, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* ── Message area ── */}
      <div className="flex-1 space-y-5 overflow-y-auto p-6">

        {/* Empty state — no document */}
        {!doc && (
          <div className="flex flex-col items-center justify-center h-full gap-4 animate-fade-in">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <BookOpen className="size-8 text-primary" />
            </div>
            <div className="text-center max-w-sm">
              <p className="font-serif text-xl text-foreground">Add a PDF to get started</p>
              <p className="text-sm text-muted-foreground mt-1">
                Upload a document and ask it anything. Answers come only from your document.
              </p>
            </div>
          </div>
        )}

        {/* Empty state — document loaded, no messages yet */}
        {doc && messages.length === 0 && (
          <div className="mx-auto mt-12 max-w-md space-y-4 animate-fade-in">
            <div className="text-center">
              <p className="font-serif text-xl">Ask about <span className="text-primary">{doc.filename}</span></p>
              <p className="text-sm text-muted-foreground mt-1">Try one of these prompts to get started</p>
            </div>
            <div className="space-y-2">
              {STARTERS.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-3 px-4"
                  onClick={() => send(s)}
                >
                  <Sparkles className="size-4 shrink-0 text-primary mr-2" />
                  {s}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* ── Messages ── */}
        {messages.map((m, i) =>
          m.role === "user" ? (
            /* ── User bubble ── */
            <div key={i} className="flex justify-end animate-message-in" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="max-w-[75%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-md shadow-primary/10">
                {m.content}
              </div>
            </div>
          ) : (
            /* ── Assistant message ── */
            <div key={i} className="space-y-1 animate-message-in" style={{ animationDelay: `${i * 0.05}s` }}>
              {/* Avatar row */}
              <div className="flex items-center gap-2 mb-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                  <Sparkles className="size-3.5 text-primary" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">AI Tutor</span>
              </div>
              {/* Answer text */}
              <div className="pl-9 max-w-[85%]">
                <p className={`whitespace-pre-wrap font-serif text-base leading-relaxed ${m.error ? "text-destructive" : ""}`}>
                  {m.content}
                </p>
              </div>
              {/* Inline citation badges */}
              {!m.error && (
                <CitationBadges
                  sources={m.sources}
                  onCitationClick={(page) => handleCitationClick(i, page)}
                />
              )}
              {/* Expandable source panel */}
              {expandedSources === i && (
                <div ref={sourcesContainerRef}>
                  <Sources sources={m.sources} highlightPage={highlightPage} />
                </div>
              )}
            </div>
          )
        )}

        {/* Skeleton while loading */}
        {busy && <SkeletonResponse />}

        <div ref={endRef} />
      </div>

      {/* ── Input bar ── */}
      <div className="border-t border-border/50 bg-card/50 backdrop-blur-sm p-4">
        <form
          className="mx-auto flex max-w-3xl gap-2"
          onSubmit={(e) => { e.preventDefault(); send(input); }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!doc || busy}
            placeholder={doc ? "Ask a question about your PDF…" : "Add a PDF first"}
            aria-label="Your question"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!doc || busy || !input.trim()}
            aria-label="Send question"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <SendHorizontal className="size-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
