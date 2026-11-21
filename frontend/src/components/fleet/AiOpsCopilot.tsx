"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  AI_CHIPS,
  buildMorningBrief,
  parseOpsIntent,
  type AiIntent,
  type FleetBriefInput,
  type HealthFilter,
  type OpsTab,
} from "@/lib/ops-ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

export type AiCopilotHandlers = {
  onNavigate: (tab: OpsTab) => void;
  onFilterHealth: (filter: HealthFilter) => void;
  onOptimize: () => void;
  onQueueReassign: (vehicleHint?: string) => void;
  onQueueWorkshop: () => void;
};

type Msg = { id: string; role: "user" | "assistant"; text: string };

export function AiOpsCopilot({
  brief,
  handlers,
}: {
  brief: FleetBriefInput;
  handlers: AiCopilotHandlers;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceOut, setVoiceOut] = useState(true);
  const [interim, setInterim] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>(() => [
    {
      id: "welcome",
      role: "assistant",
      text: buildMorningBrief(brief),
    },
  ]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [voiceSupported, setVoiceSupported] = useState(false);

  useEffect(() => {
    setVoiceSupported(
      !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    );
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, interim]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function speak(text: string) {
    if (!voiceOut || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  }

  function applyIntent(intent: AiIntent) {
    switch (intent.type) {
      case "navigate":
        handlers.onNavigate(intent.tab);
        break;
      case "filter_health":
        handlers.onFilterHealth(intent.filter);
        handlers.onNavigate("health");
        break;
      case "optimize":
        handlers.onOptimize();
        handlers.onNavigate("allocation");
        break;
      case "queue_reassign":
        handlers.onQueueReassign(intent.vehicleHint);
        handlers.onNavigate("health");
        break;
      case "queue_workshop":
        handlers.onQueueWorkshop();
        handlers.onNavigate("service");
        break;
      case "brief":
      case "unknown":
        break;
    }
  }

  function runCommand(raw: string) {
    const text = raw.trim();
    if (!text) return;
    const intent = parseOpsIntent(text, brief);
    setMsgs((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", text },
      { id: `a-${Date.now() + 1}`, role: "assistant", text: intent.reply },
    ]);
    setInput("");
    setInterim("");
    applyIntent(intent);
    speak(intent.reply);
  }

  function toggleListen() {
    if (!voiceSupported) {
      toast.message("Voice not supported. Type a command.");
      setOpen(true);
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    recognitionRef.current = rec;
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-IN";

    rec.onresult = (ev) => {
      let finalText = "";
      let interimText = "";
      for (let i = 0; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (interimText) setInterim(interimText);
      if (finalText.trim()) {
        setOpen(true);
        runCommand(finalText);
      }
    };
    rec.onerror = (ev) => {
      setListening(false);
      if (ev.error !== "aborted" && ev.error !== "no-speech") {
        toast.message("Mic issue", { description: ev.error });
      }
    };
    rec.onend = () => setListening(false);

    try {
      rec.start();
      setListening(true);
      setOpen(true);
      toast.message("Listening…", { description: "Try “how's the board” or “open service”" });
    } catch {
      toast.message("Could not start microphone");
      setListening(false);
    }
  }

  return (
    <>
      <div className="fixed right-3 bottom-[4.75rem] z-50 flex flex-col items-end gap-3 sm:right-5 lg:bottom-6">
        {open && (
          <div className="ai-panel flex w-[min(100vw-2rem,380px)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Sparkles className="size-3.5" />
                </span>
                <div>
                  <p className="text-sm font-semibold leading-none">Hub help</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Voice or type a floor command
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8"
                  onClick={() => setVoiceOut((v) => !v)}
                  aria-label={voiceOut ? "Mute replies" : "Unmute replies"}
                >
                  {voiceOut ? (
                    <Volume2 className="size-3.5" />
                  ) : (
                    <VolumeX className="size-3.5" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>

            <div ref={listRef} className="max-h-64 space-y-2 overflow-y-auto px-3 py-3">
              {msgs.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[92%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                    m.role === "assistant"
                      ? "bg-muted/70 text-foreground"
                      : "ml-auto bg-primary text-primary-foreground",
                  )}
                >
                  {m.text}
                </div>
              ))}
              {interim && (
                <div className="max-w-[92%] rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                  {interim}…
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 border-t border-border px-3 py-2">
              {AI_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => runCommand(chip)}
                  className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {chip}
                </button>
              ))}
            </div>

            <form
              className="flex items-center gap-1.5 border-t border-border p-2"
              onSubmit={(e) => {
                e.preventDefault();
                runCommand(input);
              }}
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the board…"
                className="h-9 flex-1 border-0 bg-muted/50 shadow-none focus-visible:ring-0"
              />
              <Button
                type="button"
                size="icon-sm"
                variant={listening ? "default" : "outline"}
                className={cn("size-9 shrink-0", listening && "ai-mic-pulse")}
                onClick={toggleListen}
                aria-label={listening ? "Stop listening" : "Start voice"}
              >
                {listening ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
              </Button>
              <Button type="submit" size="icon-sm" className="size-9 shrink-0" aria-label="Send">
                <Send className="size-3.5" />
              </Button>
            </form>
          </div>
        )}

        {!open && (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              toggleListen();
            }}
            className={cn(
              "grid size-10 place-items-center rounded-full border border-border bg-white/95 text-muted-foreground shadow-[var(--shadow-soft)] backdrop-blur-md transition-colors hover:text-foreground",
              listening && "ai-mic-pulse border-primary bg-primary text-primary-foreground",
            )}
            aria-label="Help"
            title="Help"
          >
            {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          </button>
        )}
      </div>
    </>
  );
}
