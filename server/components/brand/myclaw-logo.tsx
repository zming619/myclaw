import Image from "next/image"

import { cn } from "@/lib/utils"

interface MyClawLogoProps {
  className?: string
  markClassName?: string
  titleClassName?: string
  subtitleClassName?: string
  showSubtitle?: boolean
}

export function MyClawLogo({
  className,
  markClassName,
  titleClassName,
  subtitleClassName,
  showSubtitle = false,
}: MyClawLogoProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors duration-200 hover:bg-accent/70",
        className
      )}
    >
      <div
        className={cn("flex size-10 items-center justify-center", markClassName)}
      >
        <Image
          src="/myclaw-claw.svg"
          alt="MyClaw claw logo"
          width={36}
          height={36}
          className="size-9"
          priority
        />
      </div>
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          showSubtitle ? "gap-1" : "gap-0"
        )}
      >
        <div
          className={cn(
            "truncate text-sm font-semibold tracking-tight transition-colors duration-200 group-hover:text-foreground",
            titleClassName
          )}
        >
          MyClaw
        </div>
        {showSubtitle ? (
          <div
            className={cn(
              "truncate text-xs text-muted-foreground",
              subtitleClassName
            )}
          >
            微信自动回复 / 模型设置 / RAG
          </div>
        ) : null}
      </div>
    </div>
  )
}
