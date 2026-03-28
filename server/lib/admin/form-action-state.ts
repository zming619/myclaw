export type AdminFormActionState = {
  status: "idle" | "success" | "error"
  message: string
  submittedAt: number | null
}

export const initialAdminFormActionState: AdminFormActionState = {
  status: "idle",
  message: "",
  submittedAt: null,
}
