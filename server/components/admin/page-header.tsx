import { Badge } from "@/components/ui/badge"

interface PageHeaderProps {
  title: string
  description: string
  badge?: string
}

export function PageHeader({ title, description, badge }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {badge ? <Badge variant="outline">{badge}</Badge> : null}
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

