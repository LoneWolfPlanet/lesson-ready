import { useState, type FormEvent, type ReactNode } from "react";
import { asApiError } from "../../api/http";
import type { Activity, LessonDraft, LessonSection, Pack, VocabularyItem } from "../../api/types";
import { Icon } from "../../components/Icon";
import type { Strings } from "../../i18n/strings";
import { saveErrorText } from "./saveError";

/** "Edited by you" badge plus Edit, above the Lesson and Notes tabs. Sign-off is "Mark as reviewed" on the pack. */
export function EditTools({
  t,
  checked,
  edited,
  editLabel,
  canEdit,
  onEdit,
}: {
  t: Strings;
  checked?: boolean;
  edited?: boolean;
  editLabel: string;
  canEdit: boolean;
  onEdit(): void;
}) {
  return (
    <div className="stack gap-sm">
      <div className="q-tools top">
        <button type="button" className="btn ghost small" disabled={!canEdit} onClick={onEdit}>
          <Icon name="edit" size={16} /> {editLabel}
        </button>
        {checked && (
          <span className="q-checked">
            <Icon name="check" size={14} strokeWidth={3} /> {edited ? t.editedByYou : t.checkedByYou}
          </span>
        )}
      </div>
      {!canEdit && <p className="hint">{t.editOffline}</p>}
    </div>
  );
}

/** The form shell shared by both editors: title, fields, error, and a Save / Cancel bar that stays in view. */
function EditorForm({
  title,
  t,
  saving,
  canSave,
  error,
  onSubmit,
  onCancel,
  children,
}: {
  title: string;
  t: Strings;
  saving: boolean;
  canSave: boolean;
  error: string;
  onSubmit(e: FormEvent): void;
  onCancel(): void;
  children: ReactNode;
}) {
  return (
    <form className="pack-editor" onSubmit={onSubmit} noValidate>
      <h2 className="q-editor-title">{title}</h2>
      {children}
      <div className="editor-bar">
        {error && (
          <p className="error-inline" role="alert">
            {error}
          </p>
        )}
        {!canSave && <p className="hint">{t.editOffline}</p>}
        <div className="q-tools">
          <button type="submit" className="btn small" disabled={saving || !canSave}>
            {saving ? t.saving : t.save}
          </button>
          <button type="button" className="btn ghost small" disabled={saving} onClick={onCancel}>
            {t.cancel}
          </button>
        </div>
      </div>
    </form>
  );
}

/** An editable list of short texts: goals, materials, steps, tips. */
function TextListField({
  id,
  label,
  items,
  onChange,
  addLabel,
  itemLabel,
  t,
  numbered,
  multiline,
  max = 20,
}: {
  id: string;
  label: string;
  items: string[];
  onChange(items: string[]): void;
  addLabel: string;
  /** Names one row for screen readers, e.g. "Step". */
  itemLabel: string;
  t: Strings;
  numbered?: boolean;
  multiline?: boolean;
  max?: number;
}) {
  return (
    <fieldset className="field">
      <legend className="label">{label}</legend>
      <ul className="text-list">
        {items.map((value, i) => (
          <li key={i} className="text-row">
            {numbered && <span className="row-n">{i + 1}</span>}
            {multiline ? (
              <textarea
                id={`${id}-${i}`}
                className="input"
                rows={2}
                maxLength={500}
                value={value}
                aria-label={`${itemLabel} ${i + 1}`}
                onChange={(e) => onChange(items.map((x, k) => (k === i ? e.target.value : x)))}
              />
            ) : (
              <input
                id={`${id}-${i}`}
                className="input"
                maxLength={300}
                value={value}
                aria-label={`${itemLabel} ${i + 1}`}
                onChange={(e) => onChange(items.map((x, k) => (k === i ? e.target.value : x)))}
              />
            )}
            <button
              type="button"
              className="icon-btn"
              aria-label={t.removeItem(itemLabel, i + 1)}
              onClick={() => onChange(items.filter((_, k) => k !== i))}
            >
              <Icon name="close" size={18} />
            </button>
          </li>
        ))}
      </ul>
      {items.length < max && (
        <button type="button" className="link-btn" onClick={() => onChange([...items, ""])}>
          <Icon name="plus" size={16} /> {addLabel}
        </button>
      )}
    </fieldset>
  );
}

const filled = (s: string) => s.trim().length > 0;
const move = <T,>(list: T[], from: number, to: number) => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

/** The whole Lesson tab as a form: summary, goals, parts, activity, key words. */
export function LessonEditor({
  pack,
  t,
  canSave,
  onCancel,
  onSave,
}: {
  pack: Pack;
  t: Strings;
  canSave: boolean;
  onCancel(): void;
  /** Throws on failure; the form shows the error and keeps the teacher's text. */
  onSave(draft: LessonDraft): Promise<void>;
}) {
  const [overview, setOverview] = useState(pack.overview ?? "");
  const [objectives, setObjectives] = useState(pack.objectives.length ? pack.objectives : [""]);
  const [sections, setSections] = useState<LessonSection[]>(pack.sections.length ? pack.sections : [{ title: "", body: "" }]);
  const [activity, setActivity] = useState<Activity | undefined>(pack.activity);
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>(pack.vocabulary);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setSection = (i: number, patch: Partial<LessonSection>) =>
    setSections(sections.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const setVocab = (i: number, patch: Partial<VocabularyItem>) =>
    setVocabulary(vocabulary.map((v, k) => (k === i ? { ...v, ...patch } : v)));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // Rows left completely empty are dropped; half-filled rows are the teacher's to finish.
    const parts = sections.filter((s) => filled(s.title) || filled(s.body));
    const words = vocabulary.filter((v) => filled(v.term) || filled(v.definition));
    const act =
      activity && (filled(activity.title) || activity.steps.some(filled) || activity.materials.some(filled)) ? activity : undefined;

    if (!objectives.some(filled)) return setError(t.editNeedObjective);
    if (!parts.length) return setError(t.editNeedSection);
    if (parts.some((s) => !filled(s.title) || !filled(s.body))) return setError(t.editIncompletePart);
    if (words.some((v) => !filled(v.term) || !filled(v.definition))) return setError(t.editIncompleteVocab);
    if (act && (!filled(act.title) || !act.steps.some(filled))) return setError(t.editIncompleteActivity);

    setSaving(true);
    setError("");
    try {
      await onSave({
        overview: pack.overview !== undefined || filled(overview) ? overview : undefined,
        objectives,
        sections: parts,
        vocabulary: words,
        activity: act,
      });
    } catch (err) {
      setError(saveErrorText(asApiError(err), t, t.editInvalidLesson));
      setSaving(false);
    }
  };

  return (
    <EditorForm title={t.lessonEditTitle} t={t} saving={saving} canSave={canSave} error={error} onSubmit={submit} onCancel={onCancel}>
      {pack.overview !== undefined && (
        <label className="field" htmlFor="lesson-overview">
          <span className="label">{t.overviewField}</span>
          <textarea
            id="lesson-overview"
            className="input"
            rows={3}
            maxLength={1500}
            value={overview}
            onChange={(e) => setOverview(e.target.value)}
          />
        </label>
      )}

      <TextListField
        id="lesson-objective"
        label={t.objectives}
        items={objectives}
        onChange={setObjectives}
        addLabel={t.addObjective}
        itemLabel={t.objectives}
        t={t}
        max={10}
      />

      <fieldset className="field">
        <legend className="label">{t.sectionsField}</legend>
        <ol className="part-list">
          {sections.map((s, i) => (
            <li key={i} className="part-edit">
              <div className="row">
                <b className="part-n">{t.partN(i + 1)}</b>
                <div className="part-tools">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t.moveUp(i + 1)}
                    disabled={i === 0}
                    onClick={() => setSections(move(sections, i, i - 1))}
                  >
                    <Icon name="chevron" size={18} style={{ transform: "rotate(-90deg)" }} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t.moveDown(i + 1)}
                    disabled={i === sections.length - 1}
                    onClick={() => setSections(move(sections, i, i + 1))}
                  >
                    <Icon name="chevron" size={18} style={{ transform: "rotate(90deg)" }} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t.removePart(i + 1)}
                    disabled={sections.length === 1}
                    onClick={() => setSections(sections.filter((_, k) => k !== i))}
                  >
                    <Icon name="close" size={18} />
                  </button>
                </div>
              </div>
              <input
                id={`lesson-part-${i}-title`}
                className="input"
                maxLength={200}
                placeholder={t.partTitle}
                aria-label={`${t.partN(i + 1)}: ${t.partTitle}`}
                value={s.title}
                onChange={(e) => setSection(i, { title: e.target.value })}
              />
              <textarea
                id={`lesson-part-${i}-body`}
                className="input"
                rows={5}
                maxLength={5000}
                placeholder={t.partBody}
                aria-label={`${t.partN(i + 1)}: ${t.partBody}`}
                value={s.body}
                onChange={(e) => setSection(i, { body: e.target.value })}
              />
            </li>
          ))}
        </ol>
        {sections.length < 20 && (
          <button type="button" className="link-btn" onClick={() => setSections([...sections, { title: "", body: "" }])}>
            <Icon name="plus" size={16} /> {t.addPart}
          </button>
        )}
      </fieldset>

      <fieldset className="field">
        <legend className="label">{t.activity}</legend>
        {activity ? (
          <div className="stack gap-sm activity-edit">
            <input
              id="lesson-activity-title"
              className="input"
              maxLength={200}
              aria-label={t.activityTitle}
              placeholder={t.activityTitle}
              value={activity.title}
              onChange={(e) => setActivity({ ...activity, title: e.target.value })}
            />
            <TextListField
              id="lesson-activity-material"
              label={t.materials}
              items={activity.materials}
              onChange={(materials) => setActivity({ ...activity, materials })}
              addLabel={t.addMaterial}
              itemLabel={t.materials}
              t={t}
            />
            <TextListField
              id="lesson-activity-step"
              label={t.stepsField}
              items={activity.steps}
              onChange={(steps) => setActivity({ ...activity, steps })}
              addLabel={t.addStep}
              itemLabel={t.stepsField}
              t={t}
              numbered
              multiline
            />
            <button type="button" className="link-btn danger" onClick={() => setActivity(undefined)}>
              <Icon name="close" size={16} /> {t.removeActivity}
            </button>
          </div>
        ) : (
          <button type="button" className="link-btn" onClick={() => setActivity({ title: "", materials: [], steps: [""] })}>
            <Icon name="plus" size={16} /> {t.addActivity}
          </button>
        )}
      </fieldset>

      <fieldset className="field">
        <legend className="label">{t.vocabulary}</legend>
        <ul className="text-list">
          {vocabulary.map((v, i) => (
            <li key={i} className="vocab-edit">
              <input
                id={`lesson-vocab-${i}-term`}
                className="input"
                maxLength={100}
                placeholder={t.vocabTerm}
                aria-label={`${t.vocabTerm} ${i + 1}`}
                value={v.term}
                onChange={(e) => setVocab(i, { term: e.target.value })}
              />
              <input
                id={`lesson-vocab-${i}-def`}
                className="input"
                maxLength={500}
                placeholder={t.vocabDefinition}
                aria-label={`${t.vocabDefinition} ${i + 1}`}
                value={v.definition}
                onChange={(e) => setVocab(i, { definition: e.target.value })}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={t.removeItem(t.vocabTerm, i + 1)}
                onClick={() => setVocabulary(vocabulary.filter((_, k) => k !== i))}
              >
                <Icon name="close" size={18} />
              </button>
            </li>
          ))}
        </ul>
        {vocabulary.length < 30 && (
          <button type="button" className="link-btn" onClick={() => setVocabulary([...vocabulary, { term: "", definition: "" }])}>
            <Icon name="plus" size={16} /> {t.addVocab}
          </button>
        )}
      </fieldset>
    </EditorForm>
  );
}

/** The Notes tab as a form: the teacher's preparation checklist. */
export function NotesEditor({
  pack,
  t,
  canSave,
  onCancel,
  onSave,
}: {
  pack: Pack;
  t: Strings;
  canSave: boolean;
  onCancel(): void;
  onSave(notes: string[]): Promise<void>;
}) {
  const [notes, setNotes] = useState(pack.notes.length ? pack.notes : [""]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(notes.map((n) => n.trim()).filter(Boolean));
    } catch (err) {
      setError(saveErrorText(asApiError(err), t, t.editInvalidLesson));
      setSaving(false);
    }
  };

  return (
    <EditorForm title={t.notesEditTitle} t={t} saving={saving} canSave={canSave} error={error} onSubmit={submit} onCancel={onCancel}>
      <TextListField
        id="notes-tip"
        label={t.tipsField}
        items={notes}
        onChange={setNotes}
        addLabel={t.addTip}
        itemLabel={t.tipsField}
        t={t}
        multiline
      />
    </EditorForm>
  );
}
