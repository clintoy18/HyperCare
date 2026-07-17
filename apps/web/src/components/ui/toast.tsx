import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { Button } from "./button";
import { cn } from "../../lib/utils";

export type ToastMessage = {
  id: string;
  title: string;
  description?: string;
  variant?: "success" | "error" | "info";
};

const toastStyles = {
  success: {
    container: "border-emerald-200 bg-white",
    icon: "text-emerald-600",
    Icon: CheckCircle2
  },
  error: {
    container: "border-red-200 bg-white",
    icon: "text-red-600",
    Icon: AlertTriangle
  },
  info: {
    container: "border-sky-200 bg-white",
    icon: "text-sky-600",
    Icon: Info
  }
};

export function ToastViewport({ messages, onDismiss }: { messages: ToastMessage[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed right-4 top-4 z-[60] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3">
      {messages.map((message) => {
        const variant = message.variant ?? "info";
        const Icon = toastStyles[variant].Icon;

        return (
          <div
            key={message.id}
            className={cn("flex items-start gap-3 rounded-lg border p-4 shadow-lg", toastStyles[variant].container)}
            role="status"
          >
            <Icon className={cn("mt-0.5 h-5 w-5 flex-none", toastStyles[variant].icon)} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-950">{message.title}</p>
              {message.description && <p className="mt-1 text-sm leading-5 text-muted-foreground">{message.description}</p>}
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 flex-none" onClick={() => onDismiss(message.id)} aria-label="Dismiss notification">
              <X className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
