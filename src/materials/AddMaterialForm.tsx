// The form behind "Add a file or photo": pick a file, then lesson title, subject and grade.

import { useId, useRef, useState, type FormEvent } from "react";
import { GRADES, OTHER_GRADES, OTHER_LEVELS } from "../api/types";
import { MAX_SUBJECT_LENGTH, SUBJECT_CHIPS, isSuggestedSubject } from "../data/subjects";
import { useUi } from "../i18n/UiContext";
import {
  ACCEPT_ATTR,
  ACCEPTED_TYPES,
  MAX_FILE_BYTES,
  MAX_TITLE_LENGTH,
  type Grade,
  type MaterialDetails,
} from "./types";
import { formatBytes } from "./format";

interface Props {
  /** Prefill from the lesson request screen (P2·1) or the "Couldn't be made" screen (P2·3). */
  initial?: Partial<MaterialDetails>;
  onSubmit: (file: File, details: MaterialDetails) => Promise<void>;
  onCancel: () => void;
}

export function AddMaterialForm({ initial, onSubmit, onCancel }: Props) {
  const ids = useId();
  const { t } = useUi();
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState(initial?.lessonTitle ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [otherSubject, setOtherSubject] = useState(
    () => !!initial?.subject && !isSuggestedSubject(initial.subject),
  );
  const [grade, setGrade] = useState<Grade | null>(initial?.grade ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const titleTrimmed = lessonTitle.trim();
  const missing = {
    file: !file,
    title: titleTrimmed.length === 0,
    subject: subject.trim().length === 0,
    grade: grade === null, // 0 is Kindergarten, so never test with !grade
  };
  const valid = !missing.file && !missing.title && !missing.subject && !missing.grade;

  function pick(f: File | undefined) {
    setFileError(null);
    if (!f) return;
    if (!ACCEPTED_TYPES[f.type]) {
      setFileError(t.matBadType);
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setFileError(t.matTooBig(formatBytes(f.size), formatBytes(MAX_FILE_BYTES)));
      return;
    }
    setFile(f);
    // Suggest a title from the file name if the teacher hasn't typed one.
    if (!lessonTitle.trim()) {
      setLessonTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, MAX_TITLE_LENGTH));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setShowErrors(true);
    if (!valid || !file || grade === null) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(file, { lessonTitle: titleTrimmed, subject: subject.trim(), grade });
    } catch (err) {
      // The API's reason (e.g. a quota message) when it gave one; otherwise a general line.
      setSubmitError(err instanceof Error && err.message ? err.message : t.matUploadFailed);
      setSubmitting(false);
    }
  }

  const typeLabel = file ? ACCEPTED_TYPES[file.type]?.label : null;

  return (
    <form className="mat-form" onSubmit={handleSubmit} noValidate>
      <div className="mat-form-head">
        <button type="button" className="mat-link" onClick={onCancel}>
          {t.cancel}
        </button>
      </div>

      <h1 className="mat-title">{t.matAddTitle}</h1>
      <p className="mat-sub">{t.matAddSub}</p>

      {/* File */}
      <div className="mat-field">
        <span className="mat-label">{t.matFileLabel}</span>
        {file ? (
          <div className="mat-file">
            <i className="mat-file-icon">{typeLabel}</i>
            <div className="mat-file-text">
              <div className="mat-file-name">{file.name}</div>
              <div className="mat-meta">{formatBytes(file.size)}</div>
            </div>
            <button type="button" className="mat-link" onClick={() => setFile(null)}>
              {t.matChange}
            </button>
          </div>
        ) : (
          <div className="mat-pick">
            <button type="button" className="mat-pick-btn" onClick={() => fileInput.current?.click()}>
              ＋ {t.matChooseFile}
              <small>{t.matFileHint(formatBytes(MAX_FILE_BYTES))}</small>
            </button>
            <button type="button" className="mat-pick-btn" onClick={() => cameraInput.current?.click()}>
              {t.matTakePhoto}
              <small>{t.matTakePhotoHint}</small>
            </button>
          </div>
        )}
        <input
          ref={fileInput}
          id={`${ids}-file`}
          type="file"
          accept={ACCEPT_ATTR}
          hidden
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={cameraInput}
          id={`${ids}-camera`}
          type="file"
          accept="image/jpeg,image/png"
          capture="environment"
          hidden
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {fileError && <p className="mat-error">{fileError}</p>}
        {showErrors && missing.file && !fileError && <p className="mat-error">{t.matNeedFile}</p>}
      </div>

      {/* Lesson title */}
      <div className="mat-field">
        <label className="mat-label" htmlFor={`${ids}-title`}>
          {t.matLessonTitle}
        </label>
        <input
          id={`${ids}-title`}
          className="mat-input"
          value={lessonTitle}
          maxLength={MAX_TITLE_LENGTH}
          placeholder={t.matTitlePlaceholder}
          autoComplete="off"
          onChange={(e) => setLessonTitle(e.target.value)}
          aria-invalid={showErrors && missing.title}
        />
        {showErrors && missing.title && <p className="mat-error">{t.matNeedTitle}</p>}
      </div>

      {/* Subject */}
      <div className="mat-field" role="radiogroup" aria-labelledby={`${ids}-subject`}>
        <span className="mat-label" id={`${ids}-subject`}>
          {t.subject}
        </span>
        <div className="mat-subjects">
          {SUBJECT_CHIPS.map((s) => {
            const on = !otherSubject && subject.toLowerCase() === s.toLowerCase();
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={on}
                className={on ? "on" : ""}
                onClick={() => {
                  setOtherSubject(false);
                  setSubject(s);
                }}
              >
                {s}
              </button>
            );
          })}
          <button
            type="button"
            role="radio"
            aria-checked={otherSubject}
            className={otherSubject ? "on" : ""}
            onClick={() => {
              setOtherSubject(true);
              if (isSuggestedSubject(subject)) setSubject("");
            }}
          >
            {t.subjectOther}
          </button>
        </div>
        {otherSubject && (
          <input
            id={`${ids}-subject-other`}
            className="mat-input"
            value={subject}
            maxLength={MAX_SUBJECT_LENGTH}
            placeholder={t.subjectOtherPlaceholder}
            aria-label={t.subjectOtherLabel}
            autoComplete="off"
            autoFocus
            onChange={(e) => setSubject(e.target.value)}
            aria-invalid={showErrors && missing.subject}
          />
        )}
        {showErrors && missing.subject && (
          <p className="mat-error">{otherSubject ? t.matTypeSubject : t.matPickSubject}</p>
        )}
      </div>

      {/* Grade */}
      <div className="mat-field" role="radiogroup" aria-labelledby={`${ids}-grade`}>
        <span className="mat-label" id={`${ids}-grade`}>
          {t.grade}
        </span>
        <div className="mat-grades">
          {GRADES.map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={grade === g}
              aria-label={t.gradeN(g)}
              className={grade === g ? "on" : ""}
              onClick={() => setGrade(g)}
            >
              {g}
            </button>
          ))}
        </div>
        <label className="other-grade">
          <span>{t.otherGrade}</span>
          <select
            id={`${ids}-grade-other`}
            className={grade !== null && OTHER_GRADES.includes(grade) ? "on" : ""}
            value={grade !== null && OTHER_GRADES.includes(grade) ? String(grade) : ""}
            onChange={(e) => setGrade(e.target.value === "" ? null : (Number(e.target.value) as Grade))}
          >
            <option value="">{t.chooseGrade}</option>
            {OTHER_LEVELS.map(({ group, grades }) => {
              const options = grades.map((g) => (
                <option key={g} value={g}>
                  {t.gradeN(g)}
                </option>
              ));
              if (group === "kinder") return options;
              const label = { jhs: t.levelGroupJhs, shs: t.levelGroupShs, college: t.levelGroupCollege }[group];
              return (
                <optgroup key={group} label={label}>
                  {options}
                </optgroup>
              );
            })}
          </select>
        </label>
        {showErrors && missing.grade && <p className="mat-error">{t.matPickGrade}</p>}
      </div>

      <div className="mat-spacer" />
      {submitError && <p className="mat-error mat-error-box">{submitError}</p>}
      <button type="submit" className="mat-btn" disabled={submitting}>
        {submitting ? t.matStartingUpload : t.matUpload}
      </button>
    </form>
  );
}
