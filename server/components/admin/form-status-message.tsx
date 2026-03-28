import { cn } from "@/lib/utils"

interface FormStatusMessageProps {
  status: "idle" | "success" | "error"
  message: string
}

export function FormStatusMessage({
  status,
  message,
}: FormStatusMessageProps) {
  if (status === "idle" || !message) {
    return null
  }

  return (
    <p
      aria-live="polite"
      className={cn(
        "text-sm",
        status === "success" ? "text-emerald-600" : "text-destructive"
      )}
    >
      {message}
    </p>
  )
}
