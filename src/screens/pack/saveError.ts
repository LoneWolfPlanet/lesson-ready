import type { ApiError } from "../../api/http";
import type { Strings } from "../../i18n/strings";

/** A friendly message for a failed save. `invalid` is the message for a 422 from the API. */
export function saveErrorText(err: ApiError, t: Strings, invalid: string): string {
  if (err.kind === "invalid") return /same words/i.test(err.detail ?? "") ? t.editDuplicate : invalid;
  if (err.kind === "offline") return t.editOffline;
  if (err.kind === "notfound") return t.errNotFound;
  if (err.kind === "conflict") return t.errConflict;
  if (err.kind === "signin") return t.errSignin;
  if (err.kind === "busy") return t.errBusy;
  return t.errServer;
}
