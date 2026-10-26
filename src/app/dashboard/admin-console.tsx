"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_RESOURCES } from "@/lib/admin-resources";

type AdminRow = Record<string, unknown>;
type StoredFile = {
  id: string;
  name: string;
  offering_id: string;
  file_type: string;
  created_at: string;
  url: string;
};

const resourceKeys = Object.keys(ADMIN_RESOURCES);

function formatValue(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export default function AdminConsole({ email }: { email: string }) {
  const [resource, setResource] = useState(resourceKeys[0]);
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [json, setJson] = useState('{\n  \n}');
  const [editing, setEditing] = useState<AdminRow | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const router = useRouter();

  const selected = ADMIN_RESOURCES[resource];
  const loadRows = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/data?resource=${encodeURIComponent(resource)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load records.");
      setError("");
      setRows(result.rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load records.");
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, [resource]);

  const loadFiles = useCallback(async () => {
    const response = await fetch("/api/admin/files");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Could not load files.");
    setFiles(result.files);
  }, []);

  useEffect(() => {
    let current = true;
    async function fetchRows() {
      try {
        const response = await fetch(
          `/api/admin/data?resource=${encodeURIComponent(resource)}`,
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load records.");
        if (current) {
          setError("");
          setRows(result.rows);
        }
      } catch (cause) {
        if (current) {
          setError(cause instanceof Error ? cause.message : "Could not load records.");
          setRows([]);
        }
      } finally {
        if (current) setBusy(false);
      }
    }

    void fetchRows();
    if (resource === "images") {
      void fetch("/api/admin/files")
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? "Could not load files.");
          return result.files as StoredFile[];
        })
        .then((loadedFiles) => {
          if (current) setFiles(loadedFiles);
        })
        .catch((cause: unknown) => {
          if (current) {
            setError(cause instanceof Error ? cause.message : "Could not load files.");
          }
        });
    }
    return () => {
      current = false;
    };
  }, [loadFiles, resource]);

  function beginCreate() {
    setEditing(null);
    setJson('{\n  \n}');
    setNotice("");
  }

  function beginEdit(row: AdminRow) {
    setEditing(row);
    setJson(formatValue(row));
    setNotice("");
  }

  async function saveRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    let record: unknown;
    try {
      record = JSON.parse(json);
    } catch {
      setError("Enter valid JSON before saving.");
      return;
    }
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      setError("A record must be a JSON object.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/admin/data", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resource, record, original: editing }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save the record.");
      setEditing(null);
      setNotice(editing ? "Record updated." : "Record created.");
      await loadRows();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the record.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteRecord(row: AdminRow) {
    if (!window.confirm("Delete this record? This action cannot be undone.")) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/data", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resource, original: row }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not delete the record.");
      setNotice("Record deleted.");
      await loadRows();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete the record.");
    }
  }

  async function uploadFile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = (new FormData(form).get("file") as File | null) ?? null;
    const offeringId = String(new FormData(form).get("offering_id") ?? "").trim();
    if (!file) return;
    setFileBusy(true);
    setError("");
    setNotice("");
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("offering_id", offeringId);
      const response = await fetch("/api/admin/files", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Upload failed.");
      form.reset();
      setNotice("File uploaded.");
      await loadFiles();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
    } finally {
      setFileBusy(false);
    }
  }

  async function deleteFile(id: string) {
    if (!window.confirm("Delete this syllabus and its stored PDF? This action cannot be undone.")) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/files?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not delete file.");
      setNotice("Syllabus and stored PDF deleted.");
      await loadFiles();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete file.");
    }
  }

  async function signOut() {
    try {
      const response = await fetch("/api/admin/sign-out", { method: "POST" });
      if (!response.ok) throw new Error("Sign-out could not be completed.");
      router.replace("/login");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-out could not be completed.");
    }
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <h1>Beyond Syllabus Admin</h1>
          <p>Signed in as {email}</p>
        </div>
        <button className="secondary" onClick={signOut}>Sign out</button>
      </header>
      <nav className="resource-nav" aria-label="Admin resources">
        {resourceKeys.map((key) => (
          <button
            className={resource === key ? "selected" : ""}
            key={key}
            onClick={() => {
              setResource(key);
              setEditing(null);
              setJson('{\n  \n}');
              setNotice("");
              setError("");
            }}
          >
            {ADMIN_RESOURCES[key].label}
          </button>
        ))}
      </nav>
      <section className="resource-panel">
        <div className="resource-title">
          <div>
            <h2>{selected.label}</h2>
            <p>{selected.description ?? `Manage ${selected.table} records.`}</p>
          </div>
          {!selected.readOnly ? (
            <button onClick={beginCreate}>Create record</button>
          ) : null}
        </div>
        {error ? <p className="message error" role="alert">{error}</p> : null}
        {notice ? <p className="message success" role="status">{notice}</p> : null}
        {resource === "images" ? (
          <section className="file-panel">
            <h3>Syllabus PDFs</h3>
            <p>Upload a PDF for an existing course offering. Files are stored privately and linked to its syllabus record.</p>
            <form className="upload-form" onSubmit={uploadFile}>
              <input
                aria-label="Offering ID"
                name="offering_id"
                placeholder="Offering UUID"
                required
              />
              <input name="file" type="file" accept="application/pdf" required />
              <button disabled={fileBusy}>{fileBusy ? "Uploading…" : "Upload file"}</button>
            </form>
            <div className="file-list">
              {files.map((file) => (
                <article className="file-row" key={file.name}>
                  <a href={file.url} target="_blank" rel="noreferrer">
                    Offering {file.offering_id}: {file.name}
                  </a>
                  <span>{new Date(file.created_at).toLocaleDateString()}</span>
                  <button className="danger" onClick={() => void deleteFile(file.id)}>Delete file</button>
                </article>
              ))}
            </div>
          </section>
        ) : null}
        {!selected.readOnly ? (
          <form className="record-form" onSubmit={saveRecord}>
            <label htmlFor="record-json">
              {editing ? "Edit record JSON" : "New record JSON"}
            </label>
            <textarea
              id="record-json"
              value={json}
              onChange={(event) => setJson(event.target.value)}
              spellCheck={false}
            />
            <div className="form-actions">
              <button disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Create"}</button>
              {editing ? <button className="secondary" type="button" onClick={beginCreate}>Cancel</button> : null}
            </div>
          </form>
        ) : null}
        <div className="records-heading">
          <h3>Records</h3>
          <button className="secondary" onClick={() => void loadRows()} disabled={busy}>Refresh</button>
        </div>
        {busy && !rows.length ? <p>Loading records…</p> : null}
        {!busy && !error && !rows.length ? <p>No records found.</p> : null}
        <div className="record-list">
          {rows.map((row, index) => (
            <article className="record-card" key={String(row.id ?? row.email ?? row.domain ?? index)}>
              <pre>{formatValue(row)}</pre>
              <div className="record-links">
                {Object.entries(row)
                  .filter(([key, value]) => typeof value === "string" && /^https?:\/\//i.test(value) && /url|image|media|file/i.test(key))
                  .map(([key, value]) => (
                    <a href={value as string} key={key} target="_blank" rel="noreferrer">{key}</a>
                  ))}
              </div>
              {!selected.readOnly ? (
                <div className="form-actions">
                  <button className="secondary" onClick={() => beginEdit(row)}>Edit</button>
                  <button className="danger" onClick={() => void deleteRecord(row)}>Delete</button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
