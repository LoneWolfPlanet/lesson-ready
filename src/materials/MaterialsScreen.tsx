// "My materials" tab (design P2·2). Same layout as MyPacksScreen: content in <main className="screen">,
// BottomNav outside it so it stays at the bottom of the screen.

import { useMemo, useState } from "react";
import { AccountButton, BottomNav, LangToggle } from "../components/ui";
import { AddMaterialForm } from "./AddMaterialForm";
import { MaterialRow } from "./MaterialRow";
import type { TokenGetter } from "./api";
import { type MaterialDetails, type Subject } from "./types";
import { useMaterials } from "./useMaterials";
import "./materials.css";

interface Props {
  getToken: TokenGetter;
  /** Open straight into the add form, e.g. from "Use my materials" (P2·1) or "Add my material" (P2·3). */
  startAdding?: Partial<MaterialDetails>;
}

export function MaterialsScreen({ getToken, startAdding }: Props) {
  const { materials, local, loading, loadError, refresh, add, retry, remove } = useMaterials(getToken);
  const [adding, setAdding] = useState<Partial<MaterialDetails> | null>(startAdding ?? null);
  const [filter, setFilter] = useState<Subject | "All">("All");

  // Only show subject chips the teacher actually has files for.
  const subjectsInUse = useMemo(
    () => [...new Set(materials.map((m) => m.subject))].sort((a, b) => a.localeCompare(b)),
    [materials],
  );
  const visible = filter === "All" ? materials : materials.filter((m) => m.subject === filter);

  if (adding) {
    return (
      <>
        <main className="screen mat-screen">
          <AddMaterialForm
            initial={adding}
            onCancel={() => setAdding(null)}
            onSubmit={async (file, details) => {
              await add(file, details);
              setFilter("All");
              setAdding(null);
            }}
          />
        </main>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <main className="screen mat-screen">
        <div className="row">
          <h1 className="title">My materials</h1>
          <div className="row gap-sm">
            <LangToggle />
            <AccountButton />
          </div>
        </div>
        <p className="mat-sub">Lessons on these topics will use your files first.</p>

        {subjectsInUse.length > 1 && (
          <div className="mat-chips" role="tablist" aria-label="Filter by subject">
            {(["All", ...subjectsInUse] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={filter === s}
                className={filter === s ? "on" : ""}
                onClick={() => setFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {loading && <p className="mat-meta">Loading your materials…</p>}

        {loadError && (
          <div className="mat-error-box">
            <p className="mat-error">{loadError}</p>
            <button type="button" className="mat-link" onClick={() => void refresh()}>
              Try again
            </button>
          </div>
        )}

        {!loading && !loadError && materials.length === 0 && (
          <div className="mat-empty">
            <b>No materials yet</b>
            <span className="mat-sub">
              Add a module, handout or a photo of a printed page. We'll write lessons from it.
            </span>
          </div>
        )}

        <ul className="mat-list">
          {visible.map((m) => (
            <MaterialRow
              key={m.id}
              material={m}
              local={local[m.id]}
              onRetry={() => void retry(m.id)}
              onRemove={() => remove(m.id)}
            />
          ))}
        </ul>

        <div className="mat-spacer" />
        <button type="button" className="mat-btn" onClick={() => setAdding({})}>
          ＋ Add a file or photo
        </button>
      </main>
      <BottomNav />
    </>
  );
}