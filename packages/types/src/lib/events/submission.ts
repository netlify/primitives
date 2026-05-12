export interface FormSubmittedEvent {
  data: Record<string, string>
}

export type FormSubmittedHandler = (event: FormSubmittedEvent) => void | Promise<void>
