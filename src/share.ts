import type { Pack } from "./api/types";
import type { Strings } from "./i18n/strings";

/** A, B, C… for answer i. */
export const letter = (i: number) => String.fromCharCode(65 + i);

/** Plain-text version of a pack for Messenger / Viber (no formatting survives there). */
function packAsText(pack: Pack, t: Strings): string {
  const lines: string[] = [`${pack.topic} · ${t.gradeN(pack.grade)}`];
  if (pack.objectives.length) {
    lines.push("", t.objectives.toUpperCase());
    for (const o of pack.objectives) lines.push(`• ${o}`);
  }
  if (pack.sections.length) {
    lines.push("", t.tabLesson.toUpperCase());
    pack.sections.forEach((s, i) => lines.push(`${i + 1}. ${s.title}`, s.body));
  }
  if (pack.activity) {
    lines.push("", `${t.activity.toUpperCase()}: ${pack.activity.title}`);
    if (pack.activity.materials.length) lines.push(`${t.materials}: ${pack.activity.materials.join(", ")}`);
    pack.activity.steps.forEach((st, i) => lines.push(`${i + 1}. ${st}`));
  }
  if (pack.quiz.length) {
    lines.push("", t.tabQuiz.toUpperCase());
    pack.quiz.forEach((q, i) => {
      lines.push(`${i + 1}. ${q.prompt}`);
      q.options.forEach((o, j) => lines.push(`   ${letter(j)}. ${o}`));
    });
    lines.push("", `${t.answerLabel}: ${pack.quiz.map((q, i) => `${i + 1}${letter(q.answer)}`).join(" ")}`);
  }
  lines.push("", `— ${t.appName}`);
  return lines.join("\n");
}

/** Uses the phone's share sheet (Messenger, Viber…) or copies the text as a fallback. */
export async function sharePack(pack: Pack, t: Strings): Promise<"shared" | "copied" | "cancelled"> {
  const text = packAsText(pack, t);
  if (navigator.share) {
    try {
      await navigator.share({ title: pack.topic, text });
      return "shared";
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return "cancelled";
    }
  }
  await navigator.clipboard.writeText(text);
  return "copied";
}
