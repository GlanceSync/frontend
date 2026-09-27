/** Shape of every error the API returns. `fields` maps a form control name to its message. */
export interface ApiError {
  message: string;
  fields?: Record<string, string>;
}
