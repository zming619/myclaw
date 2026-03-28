export function formatDateTime(value: Date | null | undefined) {
  if (!value) {
    return "未记录"
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value)
}

export function formatTokenCount(total: number | null, prompt?: number | null, completion?: number | null) {
  if (!total && !prompt && !completion) {
    return "-"
  }

  if (prompt || completion) {
    return `${total ?? (prompt ?? 0) + (completion ?? 0)} / P${prompt ?? 0} C${completion ?? 0}`
  }

  return `${total}`
}

