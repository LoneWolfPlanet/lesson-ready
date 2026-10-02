// The form behind "Add a file or photo": pick a file, then lesson title, subject and grade.

import { useId, useRef, useState, type FormEvent } from "react";
import {
  ACCEPT_ATTR,
  ACCEPTED_TYPES,
  GRADES,
  MAX_FILE_BYTES,
  MAX_TITLE_LENGTH,
  SUBJECTS,
  type Grade,
  type MaterialDetails,
  type Subject,
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
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState(initial?.lessonTitle ?? "");
  const [subject, setSubject] = useState<Subject | null>(initial?.subject ?? null);
  const [grade, setGrade] = useState<Grade | null>(initial?.grade ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const titleTrimmed = lessonTitle.trim();
  const missing = {
    file: !file,
    title: titleTrimmed.length === 0,
    subject: !subject,
    grade: !grade,
  };
  const valid = !missing.file && !missing.title && !missing.subject && !missing.grade;

  function pick(f: File | undefined) {
    setFileError(null);
    if (!f) return;
    if (!ACCEPTED_TYPES[f.type]) {
      setFileError("Use a PDF, a Word file (.docx), or a JPG or PNG photo.");
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setFileError(`This file is ${formatBytes(f.size)}. The limit is ${formatBytes(MAX_FILE_BYTES)}.`);
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
    if (!valid || !file || !subject || !grade) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(file, { lessonTitle: titleTrimmed, subject, grade });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Couldn't start the upload. Please try again.");
      setSubmitting(false);
    }
  }

  const typeLabel = file ? ACCEPTED_TYPES[file.type]?.label : null;

  return (
    <form className="mat-form" onSubmit={handleSubmit} noValidate>
      <div className="mat-form-head">
        <button type="button" className="mat-link" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <h1 className="mat-title">Add your material</h1>
      <p className="mat-sub">We'll use it first when you make a lesson on this topic.</p>

      {/* File */}
      <div className="mat-field">
        <span className="mat-label">File or photo</span>
        {file ? (
          <div className="mat-file">
            <i className="mat-file-icon">{typeLabel}</i>
            <div className="mat-file-text">
              <div className="mat-file-name">{file.name}</div>
              <div className="mat-meta">{formatBytes(file.size)}</div>
            </div>
            <button type="button" className="mat-link" onClick={() => setFile(null)}>
              Change
            </button>
          </div>
        ) : (
          <div className="mat-pick">
            <button type="button" className="mat-pick-btn" onClick={() => fileInput.current?.click()}>
              ＋ Choose a file
              <small>PDF, Word or photo · up to {formatBytes(MAX_FILE_BYTES)}</small>
            </button>
            <button type="button" className="mat-pick-btn" onClick={() => cameraInput.current?.click()}>
              Take a photo
              <small>Of a printed page</small>
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
        {showErrors && missing.file && !fileError && <p className="mat-error">Choose a file or take a photo.</p>}
      </div>

      {/* Lesson title */}
      <div className="mat-field">
        <label className="mat-label" htmlFor={`${ids}-title`}>
          Lesson title
        </label>
        <input
          id={`${ids}-title`}
          className="mat-input"
          value={lessonTitle}
          maxLength={MAX_TITLE_LENGTH}
          placeholder="e.g. Parts of a plant"
          autoComplete="off"
          onChange={(e) => setLessonTitle(e.target.value)}
          aria-invalid={showErrors && missing.title}
        />
        {showErrors && missing.title && <p className="mat-error">Add a lesson title.</p>}
      </div>

      {/* Subject */}
      <div className="mat-field" role="radiogroup" aria-labelledby={`${ids}-subject`}>
        <span className="mat-label" id={`${ids}-subject`}>
          Subject
        </span>
        <div className="mat-subjects">
          {SUBJECTS.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={subject === s}
              className={subject === s ? "on" : ""}
              onClick={() => setSubject(s)}
            >
              {s}
            </button>
          ))}
        </div>
        {showErrors && missing.subject && <p className="mat-error">Pick a subject.</p>}
      </div>

      {/* Grade */}
      <div className="mat-field" role="radiogroup" aria-labelledby={`${ids}-grade`}>
        <span className="mat-label" id={`${ids}-grade`}>
          Grade
        </span>
        <div className="mat-grades">
          {GRADES.map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={grade === g}
              aria-label={`Grade ${g}`}
              className={grade === g ? "on" : ""}
              onClick={() => setGrade(g)}
            >
              {g}
            </button>
          ))}
        </div>
        {showErrors && missing.grade && <p className="mat-error">Pick a grade.</p>}
      </div>

      <div className="mat-spacer" />
      {submitError && <p className="mat-error mat-error-box">{submitError}</p>}
      <button type="submit" className="mat-btn" disabled={submitting}>
        {submitting ? "Starting upload…" : "Upload"}
      </button>
    </form>
  );
}
