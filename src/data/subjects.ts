/** Suggested subjects, shown as chips on the New screen and the materials form.
 *  Teachers can always type any other subject via "Other…". */
export const SUBJECT_CHIPS = ["Science", "Math", "English", "Filipino", "AP", "MAPEH", "ESP"] as const;

export const MAX_SUBJECT_LENGTH = 60;

export function isSuggestedSubject(s: string): boolean {
  return SUBJECT_CHIPS.some((c) => c.toLowerCase() === s.trim().toLowerCase());
}
