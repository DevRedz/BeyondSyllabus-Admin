"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type UserRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  is_banned: boolean;
  generation_count: number;
  course_count: number;
};

type CourseRow = {
  id: string;
  course_code: string;
  title: string;
  department: string;
  positive_votes: number;
};

type CourseOutput = {
  id: string;
  target_role: string;
  generated_resume_bullet: unknown;
  generated_skillset: unknown;
  generated_text: string | null;
  item_type: string;
  category: string | null;
  evidence: string | null;
  created_at: string;
  is_public: boolean;
  positive_votes: number;
};

type CourseDetail = {
  course: Pick<CourseRow, "id" | "course_code" | "title">;
  outputs: CourseOutput[];
};

type Offering = {
  id: string;
  course_id: string;
  semester: string;
  year: number;
  course: { course_code: string; title: string } | null;
};

type StoredFile = {
  id: string;
  name: string;
  offering_id: string;
  file_type: string;
  created_at: string;
  processing_status: string;
  verification_status: string;
  is_public: boolean;
  offering: Offering | null;
  url: string;
};

type Tab = "users" | "courses" | "syllabi";

async function readJson<T>(response: Response): Promise<T> {
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error ?? "The request could not be completed.");
  }
  return result as T;
}

function displayName(user: UserRow) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
  return name || user.email || "Anonymous user";
}

function initials(user: UserRow) {
  const name = displayName(user);
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function relativeDate(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function textValue(value: unknown) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(String).join("\n");
  if (value == null) return "";
  return JSON.stringify(value, null, 2);
}

function messageFrom(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

export default function AdminConsole({ email }: { email: string }) {
  const [tab, setTab] = useState<Tab>("users");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userField, setUserField] = useState("all");
  const [userStatus, setUserStatus] = useState("all");
  const [createdRange, setCreatedRange] = useState("all");
  const [userPage, setUserPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [courseSearch, setCourseSearch] = useState("");
  const [coursePage, setCoursePage] = useState(1);
  const [courseTotal, setCourseTotal] = useState(0);
  const [selectedCourse, setSelectedCourse] = useState<CourseDetail | null>(null);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [fileSearch, setFileSearch] = useState("");
  const [fileBusy, setFileBusy] = useState(false);
  const router = useRouter();

  const loadUsers = useCallback(async () => {
    setBusy(true);
    try {
      const params = new URLSearchParams({
        page: String(userPage),
        perPage: "50",
        search: userSearch,
        field: userField,
        status: userStatus,
        createdRange,
      });
      const result = await readJson<{
        rows: UserRow[];
        total: number;
      }>(await fetch(`/api/admin/users?${params}`));
      setUsers(result.rows);
      setUserTotal(result.total);
      setError("");
    } catch (cause) {
      setError(messageFrom(cause, "Could not load users."));
      setUsers([]);
    } finally {
      setBusy(false);
    }
  }, [createdRange, userField, userPage, userSearch, userStatus]);

  const loadCourses = useCallback(async () => {
    setBusy(true);
    try {
      const params = new URLSearchParams({
        page: String(coursePage),
        perPage: "25",
        search: courseSearch,
      });
      const result = await readJson<{
        rows: CourseRow[];
        total: number;
      }>(await fetch(`/api/admin/courses?${params}`));
      setCourses(result.rows);
      setCourseTotal(result.total);
      setError("");
    } catch (cause) {
      setError(messageFrom(cause, "Could not load courses."));
      setCourses([]);
    } finally {
      setBusy(false);
    }
  }, [coursePage, courseSearch]);

  const loadFiles = useCallback(async () => {
    setBusy(true);
    try {
      const result = await readJson<{
        files: StoredFile[];
        offerings: Offering[];
      }>(await fetch("/api/admin/files"));
      setFiles(result.files);
      setOfferings(result.offerings);
      setError("");
    } catch (cause) {
      setError(messageFrom(cause, "Could not load syllabus files."));
      setFiles([]);
      setOfferings([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (tab === "users") void loadUsers();
      if (tab === "courses") void loadCourses();
      if (tab === "syllabi") void loadFiles();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadCourses, loadFiles, loadUsers, tab]);

  async function showCourse(course: CourseRow) {
    setBusy(true);
    setSelectedCourse(null);
    setError("");
    try {
      const result = await readJson<CourseDetail>(
        await fetch(`/api/admin/courses?course_id=${encodeURIComponent(course.id)}`),
      );
      setSelectedCourse(result);
    } catch (cause) {
      setError(messageFrom(cause, "Could not load course outputs."));
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");
    const offeringId = String(formData.get("offering_id") ?? "");
    if (!(file instanceof File) || !file.size) {
      setError("Choose a PDF file to upload.");
      return;
    }
    if (!offeringId) {
      setError("Choose a course offering.");
      return;
    }

    setFileBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/files", {
        method: "POST",
        body: formData,
      });
      await readJson<{ name: string }>(response);
      form.reset();
      setNotice("Syllabus uploaded.");
      await loadFiles();
    } catch (cause) {
      setError(messageFrom(cause, "Upload failed."));
    } finally {
      setFileBusy(false);
    }
  }

  async function deleteFile(file: StoredFile) {
    const label = file.offering?.course
      ? `${file.offering.course.course_code} syllabus`
      : "this syllabus";
    if (!window.confirm(`Delete ${label} and its stored PDF? This cannot be undone.`)) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/files?id=${encodeURIComponent(file.id)}`, {
        method: "DELETE",
      });
      await readJson<{ ok: boolean }>(response);
      setNotice("Syllabus and stored PDF deleted.");
      await loadFiles();
    } catch (cause) {
      setError(messageFrom(cause, "Could not delete the syllabus."));
    }
  }

  async function signOut() {
    try {
      const response = await fetch("/api/admin/sign-out", { method: "POST" });
      if (!response.ok) throw new Error("Sign-out could not be completed.");
      router.replace("/login");
      router.refresh();
    } catch (cause) {
      setError(messageFrom(cause, "Sign-out could not be completed."));
    }
  }

  const userPages = Math.max(1, Math.ceil(userTotal / 50));
  const coursePages = Math.max(1, Math.ceil(courseTotal / 25));
  const visibleFiles = files.filter((file) => {
    const label = [
      file.name,
      file.offering?.course?.course_code,
      file.offering?.course?.title,
      file.offering?.semester,
      file.offering?.year,
      file.verification_status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return label.includes(fileSearch.toLowerCase());
  });

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">B</div>
          <div>
            <p className="eyebrow">BEYOND SYLLABUS</p>
            <h1>Admin Console</h1>
          </div>
        </div>
        <div className="admin-account">
          <span className="account-email">{email}</span>
          <button className="button button-quiet" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="resource-nav" aria-label="Admin sections">
        {([
          ["users", "User Management"],
          ["courses", "Popular Courses"],
          ["syllabi", "Syllabus Files"],
        ] as const).map(([key, label]) => (
          <button
            aria-current={tab === key ? "page" : undefined}
            className={tab === key ? "selected" : ""}
            key={key}
            onClick={() => {
              setTab(key);
              setError("");
              setNotice("");
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {error ? <p className="message error" role="alert">{error}</p> : null}
      {notice ? <p className="message success" role="status">{notice}</p> : null}

      {tab === "users" ? (
        <section className="resource-panel">
          <div className="resource-title">
            <div>
              <p className="eyebrow">ACCOUNTS</p>
              <h2>User Management</h2>
              <p>Search accounts and review signup and activity details.</p>
            </div>
            <div className="summary-chip">
              <strong>{userTotal.toLocaleString()}</strong>
              <span>registered users</span>
            </div>
          </div>

          <div className="table-controls user-controls">
            <label className="search-field">
              <span className="sr-only">Search users</span>
              <span aria-hidden="true">⌕</span>
              <input
                onChange={(event) => {
                  setUserPage(1);
                  setUserSearch(event.target.value);
                }}
                placeholder="Search users..."
                value={userSearch}
              />
            </label>
            <select
              aria-label="Search fields"
              onChange={(event) => {
                setUserPage(1);
                setUserField(event.target.value);
              }}
              value={userField}
            >
              <option value="all">All fields</option>
              <option value="name">Name</option>
              <option value="email">Email</option>
            </select>
            <select
              aria-label="Filter by account status"
              onChange={(event) => {
                setUserPage(1);
                setUserStatus(event.target.value);
              }}
              value={userStatus}
            >
              <option value="all">All users</option>
              <option value="active">Not banned</option>
              <option value="banned">Banned</option>
            </select>
            <select
              aria-label="Filter by signup date"
              onChange={(event) => {
                setUserPage(1);
                setCreatedRange(event.target.value);
              }}
              value={createdRange}
            >
              <option value="all">Any signup date</option>
              <option value="30">Joined in 30 days</option>
              <option value="90">Joined in 90 days</option>
              <option value="365">Joined in a year</option>
            </select>
            <span className="per-page">50 per page</span>
          </div>

          <div className="table-wrap">
            <table className="data-table users-table">
              <thead>
                <tr>
                  <th>User information</th>
                  <th>Activity</th>
                  <th>Signup date</th>
                  <th>Account</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const banned = user.is_banned;
                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="user-cell">
                          <span className="avatar">{initials(user)}</span>
                          <span>
                            <strong>{displayName(user)}</strong>
                            <small>{user.email || "No email address"}</small>
                            <small className="user-last-active">
                              Last active · {relativeDate(user.last_sign_in_at)}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="activity-stats">
                          <span aria-label={`${user.generation_count} generated outputs`}>
                            <span aria-hidden="true">▧</span> {user.generation_count}
                          </span>
                          <span aria-label={`${user.course_count} courses`}>
                            <span aria-hidden="true">▤</span> {user.course_count}
                          </span>
                        </div>
                      </td>
                      <td>{formatDate(user.created_at)}</td>
                      <td>
                        <span className={`status-pill ${banned ? "status-warn" : "status-good"}`}>
                          {banned ? "Banned" : "Active"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!busy && !users.length ? (
                  <tr><td className="empty-cell" colSpan={4}>No users match these filters.</td></tr>
                ) : null}
              </tbody>
            </table>
            {busy && !users.length ? <p className="loading-state">Loading users...</p> : null}
          </div>
          <Pagination
            from={userTotal ? (userPage - 1) * 50 + 1 : 0}
            to={Math.min(userPage * 50, userTotal)}
            total={userTotal}
            page={userPage}
            pages={userPages}
            onPage={setUserPage}
          />
        </section>
      ) : null}

      {tab === "courses" ? (
        <section className="resource-panel">
          <div className="resource-title">
            <div>
              <p className="eyebrow">COMMUNITY PICKS</p>
              <h2>Popular Courses</h2>
              <p>Courses ranked by positive votes on resume bullets and skillsets.</p>
            </div>
          </div>
          <div className="table-controls">
            <label className="search-field course-search">
              <span className="sr-only">Search courses</span>
              <span aria-hidden="true">⌕</span>
              <input
                onChange={(event) => {
                  setCoursePage(1);
                  setCourseSearch(event.target.value);
                }}
                placeholder="Search by course, title, or department..."
                value={courseSearch}
              />
            </label>
            <span className="per-page">Most recommended first</span>
          </div>
          <div className="course-layout">
            <div className="table-wrap">
              <table className="data-table courses-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Course</th>
                    <th>Department</th>
                    <th>Recommendations</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course, index) => (
                    <tr
                      aria-selected={selectedCourse?.course.id === course.id}
                      className="clickable-row"
                      key={course.id}
                      onClick={() => void showCourse(course)}
                    >
                      <td className="rank-cell">{(coursePage - 1) * 25 + index + 1}</td>
                      <td>
                        <strong>{course.course_code}</strong>
                        <small className="table-subtitle">{course.title}</small>
                      </td>
                      <td>{course.department}</td>
                      <td><span className="vote-count">↑ {course.positive_votes}</span></td>
                    </tr>
                  ))}
                  {!busy && !courses.length ? (
                    <tr><td className="empty-cell" colSpan={4}>No courses found.</td></tr>
                  ) : null}
                </tbody>
              </table>
              {busy && !courses.length ? <p className="loading-state">Loading courses...</p> : null}
              <Pagination
                from={courseTotal ? (coursePage - 1) * 25 + 1 : 0}
                to={Math.min(coursePage * 25, courseTotal)}
                total={courseTotal}
                page={coursePage}
                pages={coursePages}
                onPage={setCoursePage}
              />
            </div>

            <aside className="detail-panel">
              {selectedCourse ? (
                <>
                  <div className="detail-heading">
                    <div>
                      <p className="eyebrow">COURSE DETAILS</p>
                      <h3>{selectedCourse.course.course_code}</h3>
                      <p>{selectedCourse.course.title}</p>
                    </div>
                    <button
                      aria-label="Close course details"
                      className="button button-quiet close-detail"
                      onClick={() => setSelectedCourse(null)}
                    >
                      ×
                    </button>
                  </div>
                  <h4>Generated outputs <span>{selectedCourse.outputs.length}</span></h4>
                  <div className="output-list">
                    {selectedCourse.outputs.map((output) => (
                      <article className="output-card" key={output.id}>
                        <div className="output-meta">
                          <span className="status-pill">
                            {output.item_type === "skill" ? "Skillset" : "Resume bullet"}
                          </span>
                          <span>{formatDate(output.created_at)}</span>
                        </div>
                        <p className="output-role">For {output.target_role}</p>
                        {textValue(output.generated_resume_bullet) ? (
                          <div className="output-copy">
                            <strong>Resume bullets</strong>
                            <p>{textValue(output.generated_resume_bullet)}</p>
                          </div>
                        ) : null}
                        {textValue(output.generated_skillset) ? (
                          <div className="output-copy">
                            <strong>Skillsets</strong>
                            <p>{textValue(output.generated_skillset)}</p>
                          </div>
                        ) : null}
                        {!textValue(output.generated_resume_bullet) &&
                        !textValue(output.generated_skillset) ? (
                          <p className="output-copy">{output.generated_text || "No output text"}</p>
                        ) : null}
                        {output.evidence ? <p className="output-evidence">{output.evidence}</p> : null}
                        <div className="output-footer">
                          <span>↑ {output.positive_votes} recommendations</span>
                          <span>{output.is_public ? "Public" : "Private"}</span>
                        </div>
                      </article>
                    ))}
                    {!selectedCourse.outputs.length ? (
                      <p className="muted">No generated outputs for this course yet.</p>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="detail-placeholder">
                  <span aria-hidden="true">↗</span>
                  <h3>Explore course outputs</h3>
                  <p>Select a course to review generated resume bullets and skillsets.</p>
                </div>
              )}
            </aside>
          </div>
        </section>
      ) : null}

      {tab === "syllabi" ? (
        <section className="resource-panel">
          <div className="resource-title">
            <div>
              <p className="eyebrow">COURSE MATERIALS</p>
              <h2>Syllabus Files</h2>
              <p>Upload, preview, and remove private syllabus PDFs by course offering.</p>
            </div>
            <div className="summary-chip">
              <strong>{files.length}</strong>
              <span>recent files</span>
            </div>
          </div>
          <section className="file-panel">
            <form className="upload-form" onSubmit={(event) => void uploadFile(event)}>
              <label>
                <span>Course offering</span>
                <select name="offering_id" required defaultValue="">
                  <option disabled value="">Select a course offering</option>
                  {offerings.map((offering) => (
                    <option key={offering.id} value={offering.id}>
                      {offering.course
                        ? `${offering.course.course_code} — ${offering.course.title}`
                        : "Course"}{" "}
                      · {offering.semester} {offering.year}
                    </option>
                  ))}
                </select>
              </label>
              <label className="file-picker">
                <span>PDF file <small>(max 4 MB)</small></span>
                <input name="file" type="file" accept="application/pdf" required />
              </label>
              <button className="button button-primary" disabled={fileBusy || !offerings.length}>
                {fileBusy ? "Uploading..." : "Upload syllabus"}
              </button>
            </form>
            {!offerings.length && !busy ? (
              <p className="message error">No course offerings are available for upload.</p>
            ) : null}
          </section>

          <div className="records-heading">
            <div>
              <h3>Stored syllabi</h3>
              <p>{files.length} most recently uploaded files</p>
            </div>
            <label className="search-field file-search">
              <span className="sr-only">Search syllabi</span>
              <span aria-hidden="true">⌕</span>
              <input
                onChange={(event) => setFileSearch(event.target.value)}
                placeholder="Search course or file..."
                value={fileSearch}
              />
            </label>
          </div>
          <div className="syllabus-list">
            {visibleFiles.map((file) => (
              <article className="syllabus-card" key={file.id}>
                <div className="pdf-icon" aria-hidden="true">PDF</div>
                <div className="syllabus-info">
                  <strong>
                    {file.offering?.course
                      ? `${file.offering.course.course_code} — ${file.offering.course.title}`
                      : file.name.split("/").pop()}
                  </strong>
                  <span>
                    {file.offering
                      ? `${file.offering.semester} ${file.offering.year}`
                      : `Offering ${file.offering_id}`}
                    {" · "}{formatDate(file.created_at)}
                  </span>
                  <div className="syllabus-badges">
                    <span className={`status-pill status-${file.processing_status}`}>
                      {file.processing_status}
                    </span>
                    <span className={`status-pill status-${file.verification_status}`}>
                      {file.verification_status}
                    </span>
                  </div>
                </div>
                <div className="syllabus-actions">
                  <a className="button button-secondary" href={file.url} target="_blank" rel="noreferrer">
                    Open PDF
                  </a>
                  <button className="button button-danger" onClick={() => void deleteFile(file)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
            {!busy && !visibleFiles.length ? (
              <div className="empty-state">
                <h3>{files.length ? "No matching syllabi" : "No syllabus files yet"}</h3>
                <p>Upload a PDF and choose the course offering it belongs to.</p>
              </div>
            ) : null}
            {busy && !files.length ? <p className="loading-state">Loading syllabus files...</p> : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function Pagination({
  from,
  to,
  total,
  page,
  pages,
  onPage,
}: {
  from: number;
  to: number;
  total: number;
  page: number;
  pages: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="pagination">
      <span>Showing <strong>{from}–{to}</strong> of <strong>{total.toLocaleString()}</strong></span>
      <div className="pagination-actions">
        <button
          className="button button-secondary"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </button>
        <span>Page {page} of {pages}</span>
        <button
          className="button button-secondary"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
