const STORAGE_KEYS = {
  assignments: "lms_assignments",
  submissions: "lms_submissions",
  currentStudent: "lms_current_student",
  currentFaculty: "lms_current_faculty",
  createDraft: "lms_create_assignment_draft",
  lastSelectedAssignment: "lms_last_selected_assignment",
  uiTheme: "lms_ui_theme",
};

const THEME_ORDER = ["aurora", "neon", "midnight"];
const API_BASE_URL = window.LMS_API_BASE_URL || "http://localhost:5000/api";

document.addEventListener("DOMContentLoaded", async () => {
  setupTheme();
  setupPageTransitions();
  seedDefaultData();

  try {
    await syncAssignmentsWithServer();
    await syncSubmissionsWithServer();
  } catch (error) {
    console.error("Initial API sync failed:", error);
  }

  injectAppChrome();
  setupLogoutHandlers();
  setupStudentLogin();
  setupFacultyLogin();
  setupStudentSignup();
  setupFacultySignup();
  setupStudentDashboard();
  setupUploadForm();
  setupFacultyDashboard();
  setupCreateAssignmentForm();
  setupViewSubmissions();
  setupStudentResultsPage();
  setupAssignmentRoadmapPage();
  setupFacultyAnalyticsPage();
  setupAssignmentStudioPage();
  setupFacultyReportPage();
  injectCardBadges();
  injectGlobalDock();
  setupThemeSwitcher();
});

async function syncAssignmentsWithServer() {
  const localAssignments = getData(STORAGE_KEYS.assignments, []).map(normalizeAssignment);
  const remoteAssignments = await fetchAssignmentsFromServer();

  if (remoteAssignments === null) {
    return;
  }

  if (remoteAssignments.length === 0 && localAssignments.length > 0) {
    const seededAssignments = [];

    for (const assignment of localAssignments) {
      const created = await createAssignmentOnServer(assignment);
      if (created) {
        seededAssignments.push(normalizeAssignment(created));
      }
    }

    if (seededAssignments.length > 0) {
      setData(STORAGE_KEYS.assignments, seededAssignments);
      return;
    }
  }

  setData(STORAGE_KEYS.assignments, remoteAssignments.map(normalizeAssignment));
}

async function fetchAssignmentsFromServer() {
  try {
    const response = await fetch(`${API_BASE_URL}/assignments`);
    if (!response.ok) {
      throw new Error(`GET /assignments failed with ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item) => normalizeAssignment({ ...item, id: item.id || item._id }));
  } catch (error) {
    console.warn("Assignments API unavailable, using localStorage fallback.", error);
    return null;
  }
}

async function syncSubmissionsWithServer() {
  const assignments = getData(STORAGE_KEYS.assignments, []).map(normalizeAssignment);
  const localSubmissions = getData(STORAGE_KEYS.submissions, []).map((item) =>
    normalizeSubmission(item, assignments.find((entry) => entry.id === item.assignmentId))
  );
  const remoteSubmissions = await fetchSubmissionsFromServer();

  if (remoteSubmissions === null) {
    return;
  }

  if (remoteSubmissions.length === 0 && localSubmissions.length > 0) {
    const seededSubmissions = [];

    for (const submission of localSubmissions) {
      const created = await createOrUpdateSubmissionOnServer(submission);
      if (created) {
        seededSubmissions.push(created);
      }
    }

    if (seededSubmissions.length > 0) {
      setData(STORAGE_KEYS.submissions, seededSubmissions);
      return;
    }
  }

  setData(STORAGE_KEYS.submissions, remoteSubmissions);
}

async function fetchSubmissionsFromServer() {
  const assignments = getData(STORAGE_KEYS.assignments, []).map(normalizeAssignment);

  try {
    const response = await fetch(`${API_BASE_URL}/submissions`);
    if (!response.ok) {
      throw new Error(`GET /submissions failed with ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item) =>
      normalizeSubmission(
        { ...item, id: item.id || item._id },
        assignments.find((entry) => entry.id === item.assignmentId)
      )
    );
  } catch (error) {
    console.warn("Submissions API unavailable, using localStorage fallback.", error);
    return null;
  }
}

async function createOrUpdateSubmissionOnServer(submission) {
  const assignments = getData(STORAGE_KEYS.assignments, []).map(normalizeAssignment);

  try {
    const response = await fetch(`${API_BASE_URL}/submissions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(submission),
    });

    if (!response.ok) {
      throw new Error(`POST /submissions failed with ${response.status}`);
    }

    const data = await response.json();
    return normalizeSubmission(
      { ...data, id: data.id || data._id },
      assignments.find((entry) => entry.id === data.assignmentId)
    );
  } catch (error) {
    console.error("Failed to save submission in API:", error);
    return null;
  }
}

async function updateSubmissionOnServer(submissionId, updates) {
  const assignments = getData(STORAGE_KEYS.assignments, []).map(normalizeAssignment);

  try {
    const response = await fetch(`${API_BASE_URL}/submissions/${encodeURIComponent(submissionId)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`PUT /submissions/${submissionId} failed with ${response.status}`);
    }

    const data = await response.json();
    return normalizeSubmission(
      { ...data, id: data.id || data._id },
      assignments.find((entry) => entry.id === data.assignmentId)
    );
  } catch (error) {
    console.error("Failed to update submission in API:", error);
    return null;
  }
}

async function createAssignmentOnServer(assignment) {
  try {
    const response = await fetch(`${API_BASE_URL}/assignments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(assignment),
    });

    if (!response.ok) {
      throw new Error(`POST /assignments failed with ${response.status}`);
    }

    const data = await response.json();
    return normalizeAssignment({ ...data, id: data.id || data._id });
  } catch (error) {
    console.error("Failed to create assignment in API:", error);
    return null;
  }
}

async function updateAssignmentOnServer(assignmentId, updates) {
  try {
    const response = await fetch(`${API_BASE_URL}/assignments/${encodeURIComponent(assignmentId)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`PUT /assignments/${assignmentId} failed with ${response.status}`);
    }

    const data = await response.json();
    return normalizeAssignment({ ...data, id: data.id || data._id });
  } catch (error) {
    console.error("Failed to update assignment in API:", error);
    return null;
  }
}

async function deleteAssignmentOnServer(assignmentId) {
  try {
    const response = await fetch(`${API_BASE_URL}/assignments/${encodeURIComponent(assignmentId)}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(`DELETE /assignments/${assignmentId} failed with ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error("Failed to delete assignment in API:", error);
    return false;
  }
}

async function loginStudentOnServer(regNo, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/student-login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ regNo, password }),
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error("Student login API error:", error);
    return null;
  }
}

async function loginFacultyOnServer(email, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/faculty-login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error("Faculty login API error:", error);
    return null;
  }
}

async function signupStudentOnServer(name, regNo, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/student-signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, regNo, password }),
    });

    const data = await response.json();
    return {
      ok: response.ok && data?.ok,
      message: data?.message || "",
      user: data?.user || null,
    };
  } catch (error) {
    console.error("Student signup API error:", error);
    return { ok: false, message: "Backend not reachable" };
  }
}

async function signupFacultyOnServer(name, email, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/faculty-signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await response.json();
    return {
      ok: response.ok && data?.ok,
      message: data?.message || "",
      user: data?.user || null,
    };
  } catch (error) {
    console.error("Faculty signup API error:", error);
    return { ok: false, message: "Backend not reachable" };
  }
}

function injectAppChrome() {
  if (document.querySelector(".app-chrome")) {
    return;
  }

  const chrome = document.createElement("header");
  chrome.className = "app-chrome";
  const pageLabel = getPageLabel();
  const modeLabel = themeLabel(document.body.dataset.theme || "aurora");
  const summary = buildChromeSummary();

  chrome.innerHTML = `
    <div class="app-chrome-left">
      <span class="chrome-kicker">Vijaya Learning Cloud</span>
      <strong>${escapeHtml(pageLabel)}</strong>
    </div>
    <div class="app-chrome-center">
      <span class="chrome-dot"></span>
      <span>Live data</span>
      <span class="chrome-divider"></span>
      <span>${escapeHtml(summary)}</span>
    </div>
    <div class="app-chrome-right">
      <span class="chrome-pill">${escapeHtml(modeLabel)}</span>
    </div>
  `;

  document.body.prepend(chrome);
  document.body.classList.add("has-app-chrome");
}

function buildChromeSummary() {
  const assignments = getData(STORAGE_KEYS.assignments, []);
  const submissions = getData(STORAGE_KEYS.submissions, []);
  const student = getData(STORAGE_KEYS.currentStudent, null);
  const faculty = getData(STORAGE_KEYS.currentFaculty, null);

  if (student) {
    const totalStudent = submissions.filter((item) => item.regNo === student.regNo).length;
    return `${assignments.length} assignments · ${totalStudent} uploads`;
  }

  if (faculty) {
    return `${assignments.length} assignments · ${submissions.length} submissions`;
  }

  return `${assignments.length} assignments · ${submissions.length} submissions`;
}

function getPageLabel() {
  const path = window.location.pathname.split("/").pop() || "index.html";
  const labels = {
    "index.html": "Home Launchpad",
    "student-login.html": "Student Sign In",
    "student-signup.html": "Student Sign Up",
    "faculty-login.html": "Faculty Sign In",
    "faculty-signup.html": "Faculty Sign Up",
    "student-dashboard.html": "Student Dashboard",
    "student-results.html": "Student Results Center",
    "assignment-roadmap.html": "Assignment Roadmap",
    "upload-assignment.html": "Upload Assignment",
    "faculty-dashboard.html": "Faculty Dashboard",
    "create-assignment.html": "Create Assignment",
    "view-submissions.html": "View Submissions",
    "faculty-analytics.html": "Faculty Analytics",
    "assignment-studio.html": "Assignment Studio",
    "faculty-report.html": "Faculty Report",
  };

  return labels[path] || "Learning Portal";
}

function injectCardBadges() {
  const badgeMap = [
    { selector: ".stat-card", icon: "∿" },
    { selector: ".action-card", icon: "⚡" },
    { selector: ".assignment-card", icon: "⌁" },
    { selector: ".submission-card", icon: "✎" },
    { selector: ".list-item", icon: "◆" },
    { selector: ".hero-card", icon: "✦" },
    { selector: ".form-card", icon: "◌" },
  ];

  badgeMap.forEach(({ selector, icon }) => {
    document.querySelectorAll(selector).forEach((card) => {
      if (card.querySelector(":scope > .card-badge")) {
        return;
      }

      const badge = document.createElement("span");
      badge.className = "card-badge";
      badge.textContent = icon;
      card.prepend(badge);
      card.classList.add("has-card-badge");
    });
  });
}

function setupPageTransitions() {
  document.body.classList.add("page-loading");
  window.requestAnimationFrame(() => {
    document.body.classList.add("page-loaded");
    document.body.classList.remove("page-loading");
  });

  document.addEventListener("click", (event) => {
    const anchor = event.target.closest("a");
    if (!anchor) {
      return;
    }

    if (anchor.hasAttribute("download")) {
      return;
    }

    const href = anchor.getAttribute("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      return;
    }

    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) {
      return;
    }

    event.preventDefault();
    document.body.classList.add("page-leaving");
    window.setTimeout(() => {
      window.location.href = url.href;
    }, 140);
  });
}

function injectGlobalDock() {
  if (document.querySelector(".global-dock")) {
    return;
  }

  const dock = document.createElement("nav");
  dock.className = "global-dock";
  dock.setAttribute("aria-label", "Global navigation");
  dock.innerHTML = `
    <a href="index.html">Home</a>
    <a href="student-dashboard.html">Student</a>
    <a href="student-results.html">Results</a>
    <a href="assignment-roadmap.html">Roadmap</a>
    <a href="faculty-dashboard.html">Faculty</a>
    <a href="faculty-analytics.html">Analytics</a>
    <a href="assignment-studio.html">Studio</a>
    <a href="view-submissions.html">Review</a>
    <a href="faculty-report.html">Report</a>
  `;
  document.body.appendChild(dock);
  document.body.classList.add("has-global-dock");
}

function setupTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.uiTheme) || "aurora";
  document.body.dataset.theme = THEME_ORDER.includes(savedTheme) ? savedTheme : "aurora";
}

function setupThemeSwitcher() {
  if (document.querySelector(".theme-switcher")) {
    return;
  }

  const switcher = document.createElement("button");
  switcher.type = "button";
  switcher.className = "theme-switcher";
  switcher.setAttribute("aria-label", "Switch theme");
  switcher.textContent = themeLabel(document.body.dataset.theme || "aurora");
  switcher.addEventListener("click", () => {
    const currentTheme = document.body.dataset.theme || "aurora";
    const currentIndex = THEME_ORDER.indexOf(currentTheme);
    const nextTheme = THEME_ORDER[(currentIndex + 1) % THEME_ORDER.length];
    document.body.dataset.theme = nextTheme;
    localStorage.setItem(STORAGE_KEYS.uiTheme, nextTheme);
    switcher.textContent = themeLabel(nextTheme);
  });

  document.body.appendChild(switcher);
}

function themeLabel(theme) {
  if (theme === "neon") {
    return "Neo Neon";
  }

  if (theme === "midnight") {
    return "Midnight Flux";
  }

  return "Aurora Grid";
}

function seedDefaultData() {
  const existingAssignments = getData(STORAGE_KEYS.assignments, []);
  if (existingAssignments.length === 0) {
    const today = new Date();
    const firstDeadline = formatDate(addDays(today, 7));
    const secondDeadline = formatDate(addDays(today, 12));
    const thirdDeadline = formatDate(addDays(today, 1));

    setData(
      STORAGE_KEYS.assignments,
      [
        {
          id: "A1",
          title: "DBMS Assignment",
          subject: "Database Systems",
          description: "Write short notes on normalization.",
          deadline: firstDeadline,
          maxScore: 10,
          priority: "High",
          tags: ["concept", "internal"],
          createdAt: new Date().toISOString(),
        },
        {
          id: "A2",
          title: "Java Assignment",
          subject: "Object Oriented Programming",
          description: "Create a simple class for student details.",
          deadline: secondDeadline,
          maxScore: 10,
          priority: "Medium",
          tags: ["code", "practice"],
          createdAt: new Date().toISOString(),
        },
        {
          id: "A3",
          title: "Web Tech Assignment",
          subject: "Web Technology",
          description: "Build a basic form using HTML and CSS.",
          deadline: thirdDeadline,
          maxScore: 10,
          priority: "High",
          tags: ["frontend", "lab"],
          createdAt: new Date().toISOString(),
        },
      ].map(normalizeAssignment)
    );
  } else {
    setData(STORAGE_KEYS.assignments, existingAssignments.map(normalizeAssignment));
  }

  const existingSubmissions = getData(STORAGE_KEYS.submissions, []);
  if (existingSubmissions.length === 0) {
    const assignments = getData(STORAGE_KEYS.assignments, []).map(normalizeAssignment);
    const dbms = assignments.find((item) => item.id === "A1") || assignments[0];
    const seededAt = new Date().toISOString();
    const lateInfo = computeLateInfo(seededAt, dbms?.deadline || formatDate(new Date()));

    setData(STORAGE_KEYS.submissions, [
      normalizeSubmission(
        {
          id: safeUUID(),
          assignmentId: dbms?.id || "A1",
          assignmentTitle: dbms?.title || "DBMS Assignment",
          studentName: "Rahul",
          regNo: "22101",
          fileName: "dbms-notes.pdf",
          submittedAt: seededAt,
          score: "8",
          feedback: "Good attempt. Improve diagram clarity.",
          hoursSpent: "2.5",
          note: "Focused on 1NF to BCNF examples.",
          isOwnWork: true,
          maxScore: dbms?.maxScore || 10,
          onTime: lateInfo.onTime,
          lateDays: lateInfo.lateDays,
        },
        dbms
      ),
    ]);
  } else {
    const assignments = getData(STORAGE_KEYS.assignments, []).map(normalizeAssignment);
    setData(
      STORAGE_KEYS.submissions,
      existingSubmissions.map((item) => {
        const assignment = assignments.find((entry) => entry.id === item.assignmentId);
        return normalizeSubmission(item, assignment);
      })
    );
  }
}

function setupStudentLogin() {
  const form = document.getElementById("studentLoginForm");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const regNo = document.getElementById("studentRegNo").value.trim();
    const password = document.getElementById("studentPassword").value.trim();
    const message = document.getElementById("studentLoginMessage");

    const result = await loginStudentOnServer(regNo, password);
    if (result?.ok && result.user) {
      setData(STORAGE_KEYS.currentStudent, result.user);
      toast("Student login successful", "success");
      window.location.href = "student-dashboard.html";
      return;
    }

    showMessage(message, "Invalid credentials or backend not running.", "error");
  });
}

function setupFacultyLogin() {
  const form = document.getElementById("facultyLoginForm");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("facultyEmail").value.trim();
    const password = document.getElementById("facultyPassword").value.trim();
    const message = document.getElementById("facultyLoginMessage");

    const result = await loginFacultyOnServer(email, password);
    if (result?.ok && result.user) {
      setData(STORAGE_KEYS.currentFaculty, { email: result.user.email });
      toast("Faculty login successful", "success");
      window.location.href = "faculty-dashboard.html";
      return;
    }

    showMessage(message, "Invalid credentials or backend not running.", "error");
  });
}

function setupStudentSignup() {
  const form = document.getElementById("studentSignupForm");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = document.getElementById("studentSignupName").value.trim();
    const regNo = document.getElementById("studentSignupRegNo").value.trim();
    const password = document.getElementById("studentSignupPassword").value.trim();
    const message = document.getElementById("studentSignupMessage");

    if (!name || !regNo || !password) {
      showMessage(message, "Please fill all fields.", "error");
      return;
    }

    const result = await signupStudentOnServer(name, regNo, password);
    if (!result.ok) {
      showMessage(message, result.message || "Signup failed.", "error");
      return;
    }

    setData(STORAGE_KEYS.currentStudent, result.user);
    toast("Student signup successful", "success");
    window.location.href = "student-dashboard.html";
  });
}

function setupFacultySignup() {
  const form = document.getElementById("facultySignupForm");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = document.getElementById("facultySignupName").value.trim();
    const email = document.getElementById("facultySignupEmail").value.trim().toLowerCase();
    const password = document.getElementById("facultySignupPassword").value.trim();
    const message = document.getElementById("facultySignupMessage");

    if (!name || !email || !password) {
      showMessage(message, "Please fill all fields.", "error");
      return;
    }

    const result = await signupFacultyOnServer(name, email, password);
    if (!result.ok) {
      showMessage(message, result.message || "Signup failed.", "error");
      return;
    }

    setData(STORAGE_KEYS.currentFaculty, { email: result.user.email });
    toast("Faculty signup successful", "success");
    window.location.href = "faculty-dashboard.html";
  });
}

function setupStudentDashboard() {
  const list = document.getElementById("studentAssignmentList");
  if (!list) {
    return;
  }

  const searchInput = document.getElementById("studentSearchInput");
  const statusFilter = document.getElementById("studentStatusFilter");
  const subjectFilter = document.getElementById("studentSubjectFilter");
  const sortFilter = document.getElementById("studentSortFilter");
  const upcomingList = document.getElementById("studentUpcomingList");
  const performancePanel = document.getElementById("studentPerformancePanel");
  const welcome = document.getElementById("studentWelcome");

  const student = getData(STORAGE_KEYS.currentStudent, null);
  if (!student) {
    window.location.href = "student-login.html";
    return;
  }

  if (welcome) {
    welcome.textContent = `${student.name} (${student.regNo}) - stay consistent and submit on time.`;
  }

  renderStudentAssignments();

  searchInput?.addEventListener("input", renderStudentAssignments);
  statusFilter?.addEventListener("change", renderStudentAssignments);
  subjectFilter?.addEventListener("change", renderStudentAssignments);
  sortFilter?.addEventListener("change", renderStudentAssignments);

  function renderStudentAssignments() {
    const assignments = getData(STORAGE_KEYS.assignments, []).map(normalizeAssignment);
    const submissions = getData(STORAGE_KEYS.submissions, []).map((item) =>
      normalizeSubmission(item, assignments.find((entry) => entry.id === item.assignmentId))
    );
    const studentSubmissions = submissions.filter((item) => item.regNo === student.regNo);
    const reviewedSubmissions = studentSubmissions.filter((item) => item.score !== "");
    const searchText = (searchInput?.value || "").trim().toLowerCase();
    const selectedStatus = statusFilter?.value || "all";
    const selectedSubject = subjectFilter?.value || "all";
    const selectedSort = sortFilter?.value || "deadlineAsc";

    populateStudentSubjects(assignments, subjectFilter);

    updateText("studentTotalAssignments", assignments.length);
    updateText("studentSubmittedCount", studentSubmissions.length);

    const pendingCount = Math.max(assignments.length - studentSubmissions.length, 0);
    updateText("studentPendingCount", pendingCount);
    updateStudentProgress(assignments.length, studentSubmissions.length);

    const averageScore = calculateAverageScore(reviewedSubmissions);
    updateText("studentAverageScore", averageScore === null ? "-" : averageScore);

    const upcoming = assignments
      .filter((assignment) => {
        const warning = deadlineWarning(assignment.deadline);
        const hasSubmission = studentSubmissions.some((item) => item.assignmentId === assignment.id);
        return !hasSubmission && ["Deadline tomorrow", "Deadline today", "Due in 2 days", "Due in 3 days"].includes(warning);
      })
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    updateText("studentUpcomingCount", upcoming.length);
    renderStudentUpcoming(upcoming, upcomingList);
    renderStudentPerformance(reviewedSubmissions, studentSubmissions, performancePanel);

    const filtered = assignments
      .filter((assignment) => {
        const hasSubmission = studentSubmissions.some((sub) => sub.assignmentId === assignment.id);
        const assignmentStatus = hasSubmission ? "submitted" : "pending";
        const matchesStatus = selectedStatus === "all" || selectedStatus === assignmentStatus;
        const matchesSearch =
          assignment.title.toLowerCase().includes(searchText) ||
          assignment.subject.toLowerCase().includes(searchText) ||
          assignment.tags.join(" ").toLowerCase().includes(searchText);
        const matchesSubject = selectedSubject === "all" || assignment.subject === selectedSubject;
        return matchesStatus && matchesSearch && matchesSubject;
      })
      .sort((a, b) => sortAssignments(a, b, selectedSort));

    if (filtered.length === 0) {
      list.innerHTML = `<article class="card empty-state"><p>No assignments match your filter.</p></article>`;
      return;
    }

    list.innerHTML = filtered
      .map((assignment) => {
        const existingSubmission = studentSubmissions.find(
          (submission) => submission.assignmentId === assignment.id
        );
        const statusText = existingSubmission ? "Submitted" : "Pending";
        const badgeClass = existingSubmission ? "badge-submitted" : "badge-pending";
        const warning = deadlineWarning(assignment.deadline);
        const scoreText =
          existingSubmission && existingSubmission.score !== ""
            ? `${existingSubmission.score}/${assignment.maxScore}`
            : "Not graded yet";

        return `
          <article class="card assignment-card">
            <h3>${escapeHtml(assignment.title)}</h3>
            <p><span class="subject-chip">${escapeHtml(assignment.subject)}</span> <span class="priority-chip ${assignment.priority.toLowerCase()}">${escapeHtml(assignment.priority)}</span></p>
            <p><strong>Deadline:</strong> ${formatDisplayDate(assignment.deadline)}</p>
            <p><strong>Max Score:</strong> ${assignment.maxScore}</p>
            <p>${escapeHtml(assignment.description)}</p>
            <p>${assignment.tags.map((tag) => `<span class="tag-chip">#${escapeHtml(tag)}</span>`).join(" ")}</p>
            <p><span class="badge ${badgeClass}">${statusText}</span> ${existingSubmission?.score !== "" ? `<span class="badge badge-reviewed">Reviewed</span>` : ""}</p>
            <p><strong>Score:</strong> ${escapeHtml(scoreText)}</p>
            ${warning ? `<p class="warning">${warning}</p>` : ""}
            <a class="btn btn-primary" href="upload-assignment.html?id=${encodeURIComponent(
              assignment.id
            )}">${existingSubmission ? "Re-upload" : "Upload"}</a>
          </article>
        `;
      })
      .join("");
  }
}

function setupUploadForm() {
  const form = document.getElementById("uploadForm");
  if (!form) {
    return;
  }

  const student = getData(STORAGE_KEYS.currentStudent, null);
  if (!student) {
    window.location.href = "student-login.html";
    return;
  }

  const assignmentInput = document.getElementById("assignmentTitle");
  const message = document.getElementById("uploadMessage");
  const metaPanel = document.getElementById("selectedAssignmentMeta");
  const params = new URLSearchParams(window.location.search);
  const assignmentId = params.get("id");
  const assignments = getData(STORAGE_KEYS.assignments, []).map(normalizeAssignment);
  const lastSelected = getData(STORAGE_KEYS.lastSelectedAssignment, "");
  const defaultAssignmentId = assignmentId || lastSelected || (assignments[0] ? assignments[0].id : "");

  if (!assignmentInput || assignments.length === 0) {
    if (assignmentInput) {
      assignmentInput.innerHTML = `<option value="">No assignment found</option>`;
    }
    return;
  }

  assignmentInput.innerHTML = assignments
    .map(
      (item) =>
        `<option value="${escapeHtml(item.id)}" ${item.id === defaultAssignmentId ? "selected" : ""}>${escapeHtml(
          item.title
        )}</option>`
    )
    .join("");

  renderAssignmentMeta(assignmentInput.value, assignments, metaPanel);

  assignmentInput.addEventListener("change", () => {
    setData(STORAGE_KEYS.lastSelectedAssignment, assignmentInput.value);
    renderAssignmentMeta(assignmentInput.value, assignments, metaPanel);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fileInput = document.getElementById("assignmentFile");
    const hoursInput = document.getElementById("uploadHours");
    const noteInput = document.getElementById("uploadNote");
    const ownWorkInput = document.getElementById("ownWorkDeclaration");
    const file = fileInput.files[0];
    const selectedAssignment = assignments.find((item) => item.id === assignmentInput.value);

    if (!file) {
      showMessage(message, "Please choose a file first.", "error");
      toast("Please choose a file first", "error");
      return;
    }

    if (!selectedAssignment) {
      showMessage(message, "Please select an assignment.", "error");
      toast("Select an assignment to continue", "error");
      return;
    }

    if (!ownWorkInput?.checked) {
      showMessage(message, "Please confirm own work declaration.", "error");
      toast("Declaration required", "error");
      return;
    }

    const submissions = getData(STORAGE_KEYS.submissions, []).map((item) =>
      normalizeSubmission(item, assignments.find((entry) => entry.id === item.assignmentId))
    );
    const existingIndex = submissions.findIndex(
      (entry) => entry.assignmentId === selectedAssignment.id && entry.regNo === student.regNo
    );

    const nowIso = new Date().toISOString();
    const lateInfo = computeLateInfo(nowIso, selectedAssignment.deadline);
    const previousSubmission = existingIndex >= 0 ? submissions[existingIndex] : null;

    const newSubmission = normalizeSubmission(
      {
        id: previousSubmission ? previousSubmission.id : safeUUID(),
        assignmentId: selectedAssignment.id,
        assignmentTitle: selectedAssignment.title,
        studentName: student.name,
        regNo: student.regNo,
        fileName: file.name,
        submittedAt: nowIso,
        score: previousSubmission ? previousSubmission.score : "",
        feedback: previousSubmission ? previousSubmission.feedback : "",
        hoursSpent: hoursInput?.value || "",
        note: noteInput?.value.trim() || "",
        isOwnWork: true,
        maxScore: selectedAssignment.maxScore,
        onTime: lateInfo.onTime,
        lateDays: lateInfo.lateDays,
      },
      selectedAssignment
    );

    const savedSubmission = await createOrUpdateSubmissionOnServer(newSubmission);
    if (!savedSubmission) {
      showMessage(message, "Could not save submission to MongoDB API.", "error");
      toast("Failed to save submission", "error");
      return;
    }

    if (existingIndex >= 0) {
      submissions[existingIndex] = savedSubmission;
    } else {
      submissions.push(savedSubmission);
    }

    setData(STORAGE_KEYS.submissions, submissions);
    setData(STORAGE_KEYS.lastSelectedAssignment, selectedAssignment.id);
    showMessage(message, "Assignment submitted successfully.", "success");
    toast("Assignment submitted successfully", "success");
    form.reset();
    assignmentInput.value = selectedAssignment.id;
    if (ownWorkInput) {
      ownWorkInput.checked = false;
    }
    renderAssignmentMeta(assignmentInput.value, assignments, metaPanel);
  });
}

function setupFacultyDashboard() {
  const assignmentCount = document.getElementById("facultyAssignmentCount");
  if (!assignmentCount) {
    return;
  }

  const faculty = getData(STORAGE_KEYS.currentFaculty, null);
  if (!faculty) {
    window.location.href = "faculty-login.html";
    return;
  }

  const assignments = getData(STORAGE_KEYS.assignments, []).map(normalizeAssignment);
  const submissions = getData(STORAGE_KEYS.submissions, []).map((item) =>
    normalizeSubmission(item, assignments.find((entry) => entry.id === item.assignmentId))
  );
  const pendingReview = submissions.filter((item) => item.score === "");
  const reviewed = submissions.filter((item) => item.score !== "");
  const recentAssignmentsWrap = document.getElementById("facultyRecentAssignments");

  assignmentCount.textContent = String(assignments.length);
  updateText("facultySubmissionCount", submissions.length);
  updateText("facultyPendingReviewCount", pendingReview.length);

  const averageScore = calculateAverageScore(reviewed);
  updateText("facultyAverageScore", averageScore === null ? "-" : averageScore);

  const onTimeCount = submissions.filter((item) => item.onTime).length;
  const onTimeRate = submissions.length === 0 ? 0 : Math.round((onTimeCount / submissions.length) * 100);
  updateText("facultyOnTimeRate", `${onTimeRate}%`);

  const topSubject = findTopSubject(assignments);
  updateText("facultyTopSubject", topSubject || "N/A");

  renderFacultyRecentActivity(submissions, assignments);

  if (recentAssignmentsWrap) {
    const recent = [...assignments]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 4);
    if (recent.length === 0) {
      recentAssignmentsWrap.innerHTML = `<article class="card empty-state"><p>No assignments created yet.</p></article>`;
      return;
    }

    recentAssignmentsWrap.innerHTML = recent
      .map(
        (assignment) => `
          <article class="card assignment-card">
            <h3>${escapeHtml(assignment.title)}</h3>
            <p><span class="subject-chip">${escapeHtml(assignment.subject)}</span> <span class="priority-chip ${assignment.priority.toLowerCase()}">${escapeHtml(assignment.priority)}</span></p>
            <p><strong>Deadline:</strong> ${formatDisplayDate(assignment.deadline)}</p>
            <p><strong>Max Score:</strong> ${assignment.maxScore}</p>
            <p>${escapeHtml(assignment.description)}</p>
          </article>
        `
      )
      .join("");
  }
}

function setupCreateAssignmentForm() {
  const form = document.getElementById("createAssignmentForm");
  if (!form) {
    return;
  }

  const faculty = getData(STORAGE_KEYS.currentFaculty, null);
  if (!faculty) {
    window.location.href = "faculty-login.html";
    return;
  }

  const message = document.getElementById("createAssignmentMessage");
  const titleInput = document.getElementById("newAssignmentTitle");
  const subjectInput = document.getElementById("newAssignmentSubject");
  const descriptionInput = document.getElementById("newAssignmentDescription");
  const maxScoreInput = document.getElementById("newAssignmentMaxScore");
  const priorityInput = document.getElementById("newAssignmentPriority");
  const tagsInput = document.getElementById("newAssignmentTags");
  const deadlineInput = document.getElementById("newAssignmentDeadline");
  const draftStatus = document.getElementById("createDraftStatus");

  hydrateCreateDraft(
    titleInput,
    subjectInput,
    descriptionInput,
    maxScoreInput,
    priorityInput,
    tagsInput,
    deadlineInput,
    draftStatus
  );
  setupCreateDraftAutoSave(
    titleInput,
    subjectInput,
    descriptionInput,
    maxScoreInput,
    priorityInput,
    tagsInput,
    deadlineInput,
    draftStatus
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    const subject = subjectInput.value.trim();
    const description = descriptionInput.value.trim();
    const maxScore = Number(maxScoreInput.value);
    const priority = priorityInput.value;
    const tags = splitTags(tagsInput.value);
    const deadline = deadlineInput.value;

    if (!title || !subject || !description || !deadline || Number.isNaN(maxScore) || maxScore <= 0) {
      showMessage(message, "Please fill all required fields with valid values.", "error");
      toast("Please fill all fields", "error");
      return;
    }

    const newAssignment = normalizeAssignment({
      id: `A${Date.now()}`,
      title,
      subject,
      description,
      maxScore,
      priority,
      tags,
      deadline,
      createdAt: new Date().toISOString(),
    });

    const createdAssignment = await createAssignmentOnServer(newAssignment);
    if (!createdAssignment) {
      showMessage(message, "Could not connect to MongoDB API. Keep server running on port 5000.", "error");
      toast("Failed to create assignment in DB", "error");
      return;
    }

    const assignments = getData(STORAGE_KEYS.assignments, []).map(normalizeAssignment);
    assignments.push(createdAssignment);
    setData(STORAGE_KEYS.assignments, assignments);
    localStorage.removeItem(STORAGE_KEYS.createDraft);
    showMessage(message, "Assignment created successfully.", "success");
    if (draftStatus) {
      draftStatus.textContent = "Draft cleared after successful create.";
    }
    toast("Assignment created successfully", "success");
    form.reset();
    maxScoreInput.value = "10";
    priorityInput.value = "Medium";
  });
}

function setupViewSubmissions() {
  const list = document.getElementById("submissionList");
  if (!list) {
    return;
  }

  const faculty = getData(STORAGE_KEYS.currentFaculty, null);
  if (!faculty) {
    window.location.href = "faculty-login.html";
    return;
  }

  const searchInput = document.getElementById("submissionSearchInput");
  const statusFilter = document.getElementById("submissionStatusFilter");
  const lateFilter = document.getElementById("submissionLateFilter");
  const assignmentFilter = document.getElementById("submissionAssignmentFilter");
  const sortFilter = document.getElementById("submissionSortFilter");
  const exportButton = document.getElementById("exportSubmissionsCsv");

  syncSubmissionsWithServer().then(() => {
    populateAssignmentFilter();
    renderSubmissions();
  });

  searchInput?.addEventListener("input", renderSubmissions);
  statusFilter?.addEventListener("change", renderSubmissions);
  lateFilter?.addEventListener("change", renderSubmissions);
  assignmentFilter?.addEventListener("change", renderSubmissions);
  sortFilter?.addEventListener("change", renderSubmissions);

  exportButton?.addEventListener("click", () => {
    const rows = getFilteredSubmissions();
    if (rows.length === 0) {
      toast("No submissions to export", "error");
      return;
    }

    exportCsv(rows);
    toast("CSV export completed", "success");
  });

  list.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains("reviewForm")) {
      return;
    }

    event.preventDefault();
    const submissionId = form.dataset.submissionId;
    const scoreInput = form.querySelector(".scoreInput");
    const feedbackInput = form.querySelector(".feedbackInput");
    const maxScore = Number(form.dataset.maxScore || "10");

    if (!(scoreInput instanceof HTMLInputElement) || !(feedbackInput instanceof HTMLTextAreaElement)) {
      return;
    }

    const scoreValue = scoreInput.value.trim();
    if (scoreValue !== "") {
      const numericScore = Number(scoreValue);
      if (Number.isNaN(numericScore) || numericScore < 0 || numericScore > maxScore) {
        toast(`Score must be between 0 and ${maxScore}`, "error");
        return;
      }
    }

    const assignments = getData(STORAGE_KEYS.assignments, []).map(normalizeAssignment);
    const submissions = getData(STORAGE_KEYS.submissions, []).map((item) =>
      normalizeSubmission(item, assignments.find((entry) => entry.id === item.assignmentId))
    );
    const index = submissions.findIndex((item) => item.id === submissionId);

    if (index === -1) {
      return;
    }

    const updatedSubmission = await updateSubmissionOnServer(submissionId, {
      score: scoreValue,
      feedback: feedbackInput.value.trim(),
    });

    if (!updatedSubmission) {
      toast("Failed to update review in MongoDB", "error");
      return;
    }

    submissions[index] = updatedSubmission;
    setData(STORAGE_KEYS.submissions, submissions);
    toast("Review updated", "success");
    renderSubmissions();
  });

  function populateAssignmentFilter() {
    if (!assignmentFilter) {
      return;
    }

    const assignments = getData(STORAGE_KEYS.assignments, []).map(normalizeAssignment);
    assignmentFilter.innerHTML = `<option value="all">All Assignments</option>${assignments
      .map(
        (assignment) =>
          `<option value="${escapeHtml(assignment.id)}">${escapeHtml(assignment.title)}</option>`
      )
      .join("")}`;
  }

  function getFilteredSubmissions() {
    const assignments = getData(STORAGE_KEYS.assignments, []).map(normalizeAssignment);
    const submissions = getData(STORAGE_KEYS.submissions, []).map((item) =>
      normalizeSubmission(item, assignments.find((entry) => entry.id === item.assignmentId))
    );
    const searchText = (searchInput?.value || "").trim().toLowerCase();
    const selectedStatus = statusFilter?.value || "all";
    const selectedLate = lateFilter?.value || "all";
    const selectedAssignment = assignmentFilter?.value || "all";
    const selectedSort = sortFilter?.value || "submittedDesc";

    return submissions
      .filter((submission) => {
        const isReviewed = submission.score !== "";
        const statusMatches =
          selectedStatus === "all" ||
          (selectedStatus === "pending" && !isReviewed) ||
          (selectedStatus === "reviewed" && isReviewed);

        const lateMatches =
          selectedLate === "all" ||
          (selectedLate === "onTime" && submission.onTime) ||
          (selectedLate === "late" && !submission.onTime);

        const assignmentMatches =
          selectedAssignment === "all" || submission.assignmentId === selectedAssignment;

        const searchMatches =
          submission.assignmentTitle.toLowerCase().includes(searchText) ||
          submission.studentName.toLowerCase().includes(searchText) ||
          submission.regNo.toLowerCase().includes(searchText) ||
          submission.note.toLowerCase().includes(searchText);

        return statusMatches && lateMatches && assignmentMatches && searchMatches;
      })
      .sort((a, b) => sortSubmissions(a, b, selectedSort));
  }

  function renderSubmissions() {
    const filtered = getFilteredSubmissions();
    updateSubmissionStats(filtered);

    if (filtered.length === 0) {
      list.innerHTML = `<article class="card empty-state"><p>No submissions match your filter.</p></article>`;
      return;
    }

    list.innerHTML = filtered
      .map((submission) => {
        const reviewedBadge = submission.score !== "" ? `<span class="badge badge-reviewed">Reviewed</span>` : "";

        return `
          <article class="card submission-card">
            <h3>${escapeHtml(submission.assignmentTitle)}</h3>
            <p><strong>Student:</strong> ${escapeHtml(submission.studentName)} (${escapeHtml(submission.regNo)})</p>
            <p><strong>File:</strong> ${escapeHtml(submission.fileName)}</p>
            <p><strong>Submitted:</strong> ${formatDisplayDateTime(submission.submittedAt)}</p>
            <p><span class="meta-chip">${submission.onTime ? "On-Time" : `Late by ${submission.lateDays} day(s)`}</span> ${reviewedBadge}</p>
            <p><strong>Hours Spent:</strong> ${submission.hoursSpent || "N/A"}</p>
            <p><strong>Student Note:</strong> ${escapeHtml(submission.note || "-")}</p>

            <form class="form-grid reviewForm" data-submission-id="${submission.id}" data-max-score="${submission.maxScore}">
              <label>Score (/ ${submission.maxScore})</label>
              <input class="scoreInput" type="number" min="0" max="${submission.maxScore}" step="0.1" value="${escapeHtml(
                submission.score
              )}" />

              <label>Feedback</label>
              <textarea class="feedbackInput" rows="3">${escapeHtml(submission.feedback)}</textarea>

              <button class="btn btn-primary" type="submit">Save Review</button>
            </form>
          </article>
        `;
      })
      .join("");
  }
}

function setupStudentResultsPage() {
  const resultList = document.getElementById("studentResultList");
  if (!resultList) {
    return;
  }

  const student = getData(STORAGE_KEYS.currentStudent, null);
  if (!student) {
    window.location.href = "student-login.html";
    return;
  }

  const searchInput = document.getElementById("resultSearchInput");
  const sortFilter = document.getElementById("resultsSortFilter");
  const subjectBoard = document.getElementById("studentSubjectPerformance");
  const feedbackBoard = document.getElementById("studentFeedbackHighlights");
  const exportButton = document.getElementById("exportStudentReport");

  renderResults();
  searchInput?.addEventListener("input", renderResults);
  sortFilter?.addEventListener("change", renderResults);
  exportButton?.addEventListener("click", exportStudentReport);

  function renderResults() {
    const assignments = getData(STORAGE_KEYS.assignments, []).map(normalizeAssignment);
    const submissionRows = getData(STORAGE_KEYS.submissions, []).map((item) =>
      normalizeSubmission(item, assignments.find((entry) => entry.id === item.assignmentId))
    );
    const studentRows = submissionRows.filter((item) => item.regNo === student.regNo);
    const reviewedRows = studentRows.filter((item) => item.score !== "");
    const pendingReviewRows = studentRows.filter((item) => item.score === "");
    const searchText = (searchInput?.value || "").trim().toLowerCase();
    const sortMode = sortFilter?.value || "scoreDesc";

    const avg = calculateAverageScore(reviewedRows);
    updateText("resultAverageScore", avg === null ? "-" : avg);
    updateText("resultReviewedCount", reviewedRows.length);
    updateText("resultPendingReview", pendingReviewRows.length);

    const bestRow = reviewedRows
      .map((row) => ({
        row,
        ratio: row.maxScore > 0 ? Number(row.score) / row.maxScore : 0,
      }))
      .sort((a, b) => b.ratio - a.ratio)[0]?.row;
    updateText(
      "resultBestScore",
      bestRow ? `${bestRow.score}/${bestRow.maxScore}` : "-"
    );

    const subjectStats = aggregateSubjectStats(reviewedRows, assignments);
    if (subjectBoard) {
      subjectBoard.innerHTML =
        subjectStats.length === 0
          ? `<article class="list-item"><p>No reviewed subject data yet.</p></article>`
          : subjectStats
              .map(
                (item) => `
                  <article class="list-item">
                    <p><strong>${escapeHtml(item.subject)}</strong></p>
                    <p>${item.count} reviewed | ${item.avg}% average</p>
                    <div class="bar-track"><div class="bar-fill" style="width:${item.avg}%;"></div></div>
                  </article>
                `
              )
              .join("");
    }

    if (feedbackBoard) {
      const feedbackRows = reviewedRows
        .filter((item) => item.feedback.trim() !== "")
        .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
        .slice(0, 5);

      feedbackBoard.innerHTML =
        feedbackRows.length === 0
          ? `<article class="list-item"><p>No faculty feedback available yet.</p></article>`
          : feedbackRows
              .map(
                (item) => `
                  <article class="list-item">
                    <p><strong>${escapeHtml(item.assignmentTitle)}</strong></p>
                    <p>${escapeHtml(item.feedback)}</p>
                  </article>
                `
              )
              .join("");
    }

    const assignmentMap = new Map(assignments.map((item) => [item.id, item]));
    const visibleRows = studentRows
      .filter((item) => {
        const assignment = assignmentMap.get(item.assignmentId);
        const subjectText = assignment?.subject || "";
        return (
          item.assignmentTitle.toLowerCase().includes(searchText) ||
          subjectText.toLowerCase().includes(searchText)
        );
      })
      .sort((a, b) => sortResultRows(a, b, sortMode, assignmentMap));

    if (visibleRows.length === 0) {
      resultList.innerHTML = `<article class="card empty-state"><p>No result records match the filter.</p></article>`;
      return;
    }

    resultList.innerHTML = visibleRows
      .map((item) => {
        const assignment = assignmentMap.get(item.assignmentId);
        return `
          <article class="card submission-card">
            <h3>${escapeHtml(item.assignmentTitle)}</h3>
            <p><span class="subject-chip">${escapeHtml(assignment?.subject || "General")}</span> <span class="meta-chip">${item.onTime ? "On-Time" : `Late ${item.lateDays} day(s)`}</span></p>
            <p><strong>Submitted:</strong> ${formatDisplayDateTime(item.submittedAt)}</p>
            <p><strong>Score:</strong> ${item.score === "" ? "Pending" : `${escapeHtml(item.score)}/${item.maxScore}`}</p>
            <p><strong>Feedback:</strong> ${escapeHtml(item.feedback || "Awaiting faculty review")}</p>
          </article>
        `;
      })
      .join("");
  }

  function exportStudentReport() {
    const assignments = getData(STORAGE_KEYS.assignments, []).map(normalizeAssignment);
    const submissionRows = getData(STORAGE_KEYS.submissions, []).map((item) =>
      normalizeSubmission(item, assignments.find((entry) => entry.id === item.assignmentId))
    );
    const studentRows = submissionRows.filter((item) => item.regNo === student.regNo);
    const reviewedRows = studentRows.filter((item) => item.score !== "");
    const avg = calculateAverageScore(reviewedRows) || "N/A";
    const bestRow = reviewedRows
      .map((row) => ({
        row,
        ratio: row.maxScore > 0 ? Number(row.score) / row.maxScore : 0,
      }))
      .sort((a, b) => b.ratio - a.ratio)[0]?.row;

    const reportWindow = window.open("", "_blank", "width=980,height=900");
    if (!reportWindow) {
      toast("Popup blocked. Please allow popups to export report.", "error");
      return;
    }

    const rows = studentRows
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.assignmentTitle)}</td>
            <td>${escapeHtml(item.score === "" ? "Pending" : `${item.score}/${item.maxScore}`)}</td>
            <td>${escapeHtml(item.onTime ? "On-Time" : `Late ${item.lateDays}`)}</td>
            <td>${formatDisplayDateTime(item.submittedAt)}</td>
            <td>${escapeHtml(item.feedback || "-")}</td>
          </tr>
        `
      )
      .join("");

    reportWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Student Report Card</title>
          <style>
            body { margin: 0; font-family: Arial, sans-serif; background: linear-gradient(120deg, #eef4ff, #fdf8ff); color: #12202e; }
            .page { max-width: 960px; margin: 0 auto; padding: 28px; }
            .hero { background: linear-gradient(135deg, #0f7b6f, #1d4ed8); color: #fff; border-radius: 20px; padding: 24px; box-shadow: 0 20px 50px rgba(8, 25, 52, 0.22); }
            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 18px 0; }
            .card { background: #fff; border-radius: 16px; padding: 16px; box-shadow: 0 10px 24px rgba(8, 25, 52, 0.1); }
            table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 16px; overflow: hidden; }
            th, td { padding: 12px; border-bottom: 1px solid #e7eef8; text-align: left; }
            th { background: #f3f7ff; }
            h1, h2, h3 { margin-top: 0; }
            .muted { color: #5e6b7c; }
            @media print { body { background: #fff; } .page { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="hero">
              <h1>Student Report Card</h1>
              <p>${escapeHtml(student.name)} | Reg No ${escapeHtml(student.regNo)}</p>
              <p class="muted">Generated on ${formatDisplayDateTime(new Date().toISOString())}</p>
            </div>
            <div class="grid">
              <div class="card"><h3>Average</h3><p>${escapeHtml(avg)}</p></div>
              <div class="card"><h3>Best</h3><p>${bestRow ? `${escapeHtml(bestRow.score)}/${escapeHtml(bestRow.maxScore)}` : "N/A"}</p></div>
              <div class="card"><h3>Reviewed</h3><p>${reviewedRows.length}</p></div>
              <div class="card"><h3>Total Uploads</h3><p>${studentRows.length}</p></div>
            </div>
            <h2>Submission History</h2>
            <table>
              <thead><tr><th>Assignment</th><th>Score</th><th>Status</th><th>Submitted</th><th>Feedback</th></tr></thead>
              <tbody>${rows || "<tr><td colspan='5'>No submissions yet</td></tr>"}</tbody>
            </table>
          </div>
          <script>window.onload = () => setTimeout(() => window.print(), 250);</script>
        </body>
      </html>
    `);
    reportWindow.document.close();
  }
}

function setupAssignmentRoadmapPage() {
  const roadmapList = document.getElementById("roadmapList");
  if (!roadmapList) {
    return;
  }

  const student = getData(STORAGE_KEYS.currentStudent, null);
  if (!student) {
    window.location.href = "student-login.html";
    return;
  }

  const priorityFilter = document.getElementById("roadmapPriorityFilter");
  const statusFilter = document.getElementById("roadmapStatusFilter");
  const calendarList = document.getElementById("roadmapCalendarList");

  renderRoadmap();
  priorityFilter?.addEventListener("change", renderRoadmap);
  statusFilter?.addEventListener("change", renderRoadmap);

  function renderRoadmap() {
    const assignments = getData(STORAGE_KEYS.assignments, []).map(normalizeAssignment);
    const submissionRows = getData(STORAGE_KEYS.submissions, []).map((item) =>
      normalizeSubmission(item, assignments.find((entry) => entry.id === item.assignmentId))
    );
    const studentRows = submissionRows.filter((item) => item.regNo === student.regNo);
    const selectedPriority = priorityFilter?.value || "all";
    const selectedStatus = statusFilter?.value || "all";

    updateText("roadmapTotal", assignments.length);
    updateText("roadmapCompleted", studentRows.length);

    const overdueCount = assignments.filter((assignment) => {
      const isSubmitted = studentRows.some((item) => item.assignmentId === assignment.id);
      return !isSubmitted && deadlineWarning(assignment.deadline) === "Deadline passed";
    }).length;
    updateText("roadmapOverdue", overdueCount);

    const rows = assignments
      .map((assignment) => {
        const submission = studentRows.find((item) => item.assignmentId === assignment.id);
        return {
          assignment,
          submission,
          status: submission ? "submitted" : "pending",
        };
      })
      .filter((item) => {
        const matchPriority =
          selectedPriority === "all" || item.assignment.priority === selectedPriority;
        const matchStatus = selectedStatus === "all" || item.status === selectedStatus;
        return matchPriority && matchStatus;
      })
      .sort((a, b) => new Date(a.assignment.deadline) - new Date(b.assignment.deadline));

    roadmapList.innerHTML =
      rows.length === 0
        ? `<article class="list-item"><p>No roadmap items match selected filters.</p></article>`
        : rows
            .map((item) => {
              const warning = deadlineWarning(item.assignment.deadline);
              return `
                <article class="list-item roadmap-item">
                  <p><strong>${escapeHtml(item.assignment.title)}</strong></p>
                  <p>${escapeHtml(item.assignment.subject)} | ${formatDisplayDate(item.assignment.deadline)}</p>
                  <p><span class="priority-chip ${item.assignment.priority.toLowerCase()}">${escapeHtml(item.assignment.priority)}</span> <span class="badge ${item.submission ? "badge-submitted" : "badge-pending"}">${item.submission ? "Submitted" : "Pending"}</span></p>
                  <p class="subtext">${warning || "Planned"}</p>
                </article>
              `;
            })
            .join("");

    if (calendarList) {
      const nextFive = [...assignments].sort((a, b) => new Date(a.deadline) - new Date(b.deadline)).slice(0, 5);
      calendarList.innerHTML = nextFive
        .map(
          (item) => `
            <article class="list-item">
              <p><strong>${formatDisplayDate(item.deadline)}</strong> - ${escapeHtml(item.title)}</p>
              <p>${escapeHtml(item.subject)}</p>
            </article>
          `
        )
        .join("");
    }
  }
}

function setupFacultyAnalyticsPage() {
  const assignmentBoard = document.getElementById("analyticsAssignmentBoard");
  if (!assignmentBoard) {
    return;
  }

  const faculty = getData(STORAGE_KEYS.currentFaculty, null);
  if (!faculty) {
    window.location.href = "faculty-login.html";
    return;
  }

  const assignments = getData(STORAGE_KEYS.assignments, []).map(normalizeAssignment);
  const submissions = getData(STORAGE_KEYS.submissions, []).map((item) =>
    normalizeSubmission(item, assignments.find((entry) => entry.id === item.assignmentId))
  );

  updateText("analyticsAssignments", assignments.length);
  updateText("analyticsSubmissions", submissions.length);
  updateText("analyticsReviewed", submissions.filter((item) => item.score !== "").length);
  updateText("analyticsLate", submissions.filter((item) => !item.onTime).length);
  const onTimeRate =
    submissions.length === 0
      ? 0
      : Math.round((submissions.filter((item) => item.onTime).length / submissions.length) * 100);
  updateText("analyticsOnTimeRate", `${onTimeRate}%`);
  const avg = calculateAverageScore(submissions.filter((item) => item.score !== ""));
  updateText("analyticsAvgScore", avg === null ? "-" : avg);

  const subjectBoard = document.getElementById("analyticsSubjectBoard");
  if (subjectBoard) {
    const subjectData = assignments.reduce((acc, assignment) => {
      const key = assignment.subject || "General";
      if (!acc[key]) {
        acc[key] = { subject: key, created: 0, reviewedScores: [] };
      }
      acc[key].created += 1;
      const related = submissions.filter(
        (item) => item.assignmentId === assignment.id && item.score !== ""
      );
      related.forEach((entry) => {
        acc[key].reviewedScores.push((Number(entry.score) / entry.maxScore) * 100);
      });
      return acc;
    }, {});

    const cards = Object.values(subjectData).sort((a, b) => b.created - a.created);
    subjectBoard.innerHTML = cards
      .map((item) => {
        const avgScore =
          item.reviewedScores.length === 0
            ? 0
            : Math.round(
                (item.reviewedScores.reduce((sum, value) => sum + value, 0) /
                  item.reviewedScores.length) *
                  10
              ) / 10;
        return `
          <article class="list-item">
            <p><strong>${escapeHtml(item.subject)}</strong></p>
            <p>${item.created} assignments | ${avgScore}% reviewed average</p>
            <div class="bar-track"><div class="bar-fill" style="width:${avgScore}%;"></div></div>
          </article>
        `;
      })
      .join("");
  }

  assignmentBoard.innerHTML = assignments
    .map((assignment) => {
      const related = submissions.filter((item) => item.assignmentId === assignment.id);
      const reviewed = related.filter((item) => item.score !== "");
      const reviewedPct = related.length === 0 ? 0 : Math.round((reviewed.length / related.length) * 100);
      const avgScore = calculateAverageScore(reviewed);
      return `
        <article class="list-item">
          <p><strong>${escapeHtml(assignment.title)}</strong></p>
          <p>${escapeHtml(assignment.subject)} | ${related.length} submissions | ${reviewedPct}% reviewed</p>
          <p>Average: ${avgScore || "N/A"}</p>
          <div class="bar-track"><div class="bar-fill" style="width:${reviewedPct}%;"></div></div>
        </article>
      `;
    })
    .join("");

  const weeklyBoard = document.getElementById("analyticsWeeklyBoard");
  if (weeklyBoard) {
    const weeklyMap = new Map();
    for (let index = 6; index >= 0; index -= 1) {
      const day = addDays(new Date(), -index);
      weeklyMap.set(formatDate(day), 0);
    }

    submissions.forEach((item) => {
      const key = formatDate(item.submittedAt);
      if (weeklyMap.has(key)) {
        weeklyMap.set(key, (weeklyMap.get(key) || 0) + 1);
      }
    });

    const maxCount = Math.max(...weeklyMap.values(), 1);
    weeklyBoard.innerHTML = [...weeklyMap.entries()]
      .map(
        ([day, count]) => `
          <article class="list-item">
            <p><strong>${formatDisplayDate(day)}</strong> - ${count} submission(s)</p>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.round((count / maxCount) * 100)}%;"></div></div>
          </article>
        `
      )
      .join("");
  }
}

function setupAssignmentStudioPage() {
  const list = document.getElementById("studioAssignmentList");
  if (!list) {
    return;
  }

  const faculty = getData(STORAGE_KEYS.currentFaculty, null);
  if (!faculty) {
    window.location.href = "faculty-login.html";
    return;
  }

  const searchInput = document.getElementById("studioSearchInput");
  const subjectFilter = document.getElementById("studioSubjectFilter");
  const priorityFilter = document.getElementById("studioPriorityFilter");
  const quickForm = document.getElementById("studioQuickForm");
  const message = document.getElementById("studioMessage");

  renderStudio();
  searchInput?.addEventListener("input", renderStudio);
  subjectFilter?.addEventListener("change", renderStudio);
  priorityFilter?.addEventListener("change", renderStudio);

  quickForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const titleInput = document.getElementById("studioTitle");
    const subjectInput = document.getElementById("studioSubject");
    const deadlineInput = document.getElementById("studioDeadline");
    const priorityInput = document.getElementById("studioPriority");
    const maxScoreInput = document.getElementById("studioMaxScore");

    const title = titleInput.value.trim();
    const subject = subjectInput.value.trim();
    const deadline = deadlineInput.value;
    const priority = priorityInput.value;
    const maxScore = Number(maxScoreInput.value);

    if (!title || !subject || !deadline || Number.isNaN(maxScore) || maxScore <= 0) {
      showMessage(message, "Please provide valid values for all fields.", "error");
      return;
    }

    const createdAssignment = await createAssignmentOnServer({
      id: `A${Date.now()}`,
      title,
      subject,
      description: "Created from Assignment Studio quick mode.",
      deadline,
      maxScore,
      priority,
      tags: ["studio"],
      createdAt: new Date().toISOString(),
    });

    if (!createdAssignment) {
      showMessage(message, "Could not connect to MongoDB API. Keep server running on port 5000.", "error");
      toast("Failed to create assignment in DB", "error");
      return;
    }

    const assignments = getData(STORAGE_KEYS.assignments, []).map(normalizeAssignment);
    assignments.push(createdAssignment);
    setData(STORAGE_KEYS.assignments, assignments);
    showMessage(message, "Assignment created successfully in studio.", "success");
    toast("Studio assignment created", "success");
    quickForm.reset();
    maxScoreInput.value = "10";
    priorityInput.value = "Medium";
    renderStudio();
  });

  list.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest("button");
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const assignmentId = button.dataset.assignmentId;
    if (!assignmentId) {
      return;
    }

    const assignments = getData(STORAGE_KEYS.assignments, []).map(normalizeAssignment);
    const submissions = getData(STORAGE_KEYS.submissions, []);
    const assignmentIndex = assignments.findIndex((item) => item.id === assignmentId);
    if (assignmentIndex === -1) {
      return;
    }

    if (button.classList.contains("studio-delete")) {
      const ok = window.confirm("Delete this assignment and related submissions?");
      if (!ok) {
        return;
      }

      const deleted = await deleteAssignmentOnServer(assignmentId);
      if (!deleted) {
        toast("Failed to delete assignment from DB", "error");
        return;
      }

      const filteredAssignments = assignments.filter((item) => item.id !== assignmentId);
      const filteredSubmissions = submissions.filter((item) => item.assignmentId !== assignmentId);
      setData(STORAGE_KEYS.assignments, filteredAssignments);
      setData(STORAGE_KEYS.submissions, filteredSubmissions);
      await syncSubmissionsWithServer();
      toast("Assignment deleted", "success");
      renderStudio();
      return;
    }

    if (button.classList.contains("studio-clone")) {
      const original = assignments[assignmentIndex];
      const cloned = {
        ...original,
        id: `A${Date.now()}`,
        title: `${original.title} (Copy)`,
        createdAt: new Date().toISOString(),
      };

      const createdClone = await createAssignmentOnServer(cloned);
      if (!createdClone) {
        toast("Failed to clone assignment in DB", "error");
        return;
      }

      assignments.unshift(createdClone);
      setData(STORAGE_KEYS.assignments, assignments);
      toast("Assignment cloned", "success");
      renderStudio();
      return;
    }

    if (button.classList.contains("studio-shift")) {
      const shiftedDeadline = formatDate(addDays(assignments[assignmentIndex].deadline, 2));
      const updatedAssignment = await updateAssignmentOnServer(assignmentId, {
        deadline: shiftedDeadline,
      });

      if (!updatedAssignment) {
        toast("Failed to shift deadline in DB", "error");
        return;
      }

      assignments[assignmentIndex] = updatedAssignment;
      setData(STORAGE_KEYS.assignments, assignments);
      toast("Deadline shifted by 2 days", "success");
      renderStudio();
    }
  });

  function renderStudio() {
    const assignments = getData(STORAGE_KEYS.assignments, []).map(normalizeAssignment);
    const searchText = (searchInput?.value || "").trim().toLowerCase();
    const selectedSubject = subjectFilter?.value || "all";
    const selectedPriority = priorityFilter?.value || "all";
    const subjects = [...new Set(assignments.map((item) => item.subject))].filter(Boolean);
    const currentSubject = subjectFilter?.value || "all";

    if (subjectFilter) {
      subjectFilter.innerHTML = `<option value="all">All Subjects</option>${subjects
        .map((subject) => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`)
        .join("")}`;
      if (subjects.includes(currentSubject)) {
        subjectFilter.value = currentSubject;
      }
    }

    const visibleRows = assignments
      .filter((item) => {
        const matchesSearch =
          item.title.toLowerCase().includes(searchText) ||
          item.subject.toLowerCase().includes(searchText) ||
          item.tags.join(" ").toLowerCase().includes(searchText);
        const matchesSubject = selectedSubject === "all" || item.subject === selectedSubject;
        const matchesPriority = selectedPriority === "all" || item.priority === selectedPriority;
        return matchesSearch && matchesSubject && matchesPriority;
      })
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    if (visibleRows.length === 0) {
      list.innerHTML = `<article class="card empty-state"><p>No assignments match filters.</p></article>`;
      return;
    }

    list.innerHTML = visibleRows
      .map(
        (item) => `
          <article class="card assignment-card">
            <h3>${escapeHtml(item.title)}</h3>
            <p><span class="subject-chip">${escapeHtml(item.subject)}</span> <span class="priority-chip ${item.priority.toLowerCase()}">${escapeHtml(item.priority)}</span></p>
            <p><strong>Deadline:</strong> ${formatDisplayDate(item.deadline)}</p>
            <p><strong>Max Score:</strong> ${item.maxScore}</p>
            <div class="studio-actions">
              <button class="btn btn-light studio-clone" data-assignment-id="${item.id}" type="button">Clone</button>
              <button class="btn btn-secondary studio-shift" data-assignment-id="${item.id}" type="button">+2 Days</button>
              <button class="btn btn-outline studio-delete" data-assignment-id="${item.id}" type="button">Delete</button>
            </div>
          </article>
        `
      )
      .join("");
  }
}

function setupFacultyReportPage() {
  const reportList = document.getElementById("facultyReportList");
  if (!reportList) {
    return;
  }

  const faculty = getData(STORAGE_KEYS.currentFaculty, null);
  if (!faculty) {
    window.location.href = "faculty-login.html";
    return;
  }

  const assignments = getData(STORAGE_KEYS.assignments, []).map(normalizeAssignment);
  const submissions = getData(STORAGE_KEYS.submissions, []).map((item) =>
    normalizeSubmission(item, assignments.find((entry) => entry.id === item.assignmentId))
  );
  const reviewed = submissions.filter((item) => item.score !== "");

  updateText("reportAssignments", assignments.length);
  updateText("reportSubmissions", submissions.length);
  updateText("reportReviewed", reviewed.length);
  updateText("reportLate", submissions.filter((item) => !item.onTime).length);
  const avg = calculateAverageScore(reviewed);
  updateText("reportAverage", avg === null ? "-" : avg);

  const exportButton = document.getElementById("exportFacultyReport");
  exportButton?.addEventListener("click", exportFacultyReport);

  const subjectRows = aggregateFacultySubjects(assignments, submissions);
  reportList.innerHTML =
    subjectRows.length === 0
      ? `<article class="list-item"><p>No faculty report data yet.</p></article>`
      : subjectRows
          .map(
            (item) => `
              <article class="list-item">
                <p><strong>${escapeHtml(item.subject)}</strong></p>
                <p>${item.assignments} assignments | ${item.submissions} submissions | ${item.reviewed} reviewed</p>
                <p>${item.onTimeRate}% on-time | ${item.avgScore}% average</p>
                <div class="bar-track"><div class="bar-fill" style="width:${item.onTimeRate}%;"></div></div>
              </article>
            `
          )
          .join("");

  function exportFacultyReport() {
    const rows = subjectRows
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.subject)}</td>
            <td>${item.assignments}</td>
            <td>${item.submissions}</td>
            <td>${item.reviewed}</td>
            <td>${item.onTimeRate}%</td>
            <td>${item.avgScore}%</td>
          </tr>
        `
      )
      .join("");

    const reportWindow = window.open("", "_blank", "width=980,height=900");
    if (!reportWindow) {
      toast("Popup blocked. Allow popups to export report.", "error");
      return;
    }

    reportWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Faculty Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; background: #f4f8ff; color: #12202e; }
            .page { max-width: 980px; margin: 0 auto; padding: 28px; }
            .hero { background: linear-gradient(135deg, #0f7b6f, #1d4ed8); color: #fff; padding: 24px; border-radius: 20px; }
            .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin: 18px 0; }
            .card { background: #fff; border-radius: 16px; padding: 16px; box-shadow: 0 10px 24px rgba(8, 25, 52, 0.1); }
            table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 16px; overflow: hidden; }
            th, td { padding: 12px; border-bottom: 1px solid #e6eef8; text-align: left; }
            th { background: #eef4ff; }
            @media print { body { background: #fff; } .page { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="hero">
              <h1>Faculty Report</h1>
              <p>${escapeHtml(faculty.email)}</p>
              <p>Generated on ${formatDisplayDateTime(new Date().toISOString())}</p>
            </div>
            <div class="grid">
              <div class="card"><h3>Assignments</h3><p>${assignments.length}</p></div>
              <div class="card"><h3>Submissions</h3><p>${submissions.length}</p></div>
              <div class="card"><h3>Reviewed</h3><p>${reviewed.length}</p></div>
              <div class="card"><h3>Late</h3><p>${submissions.filter((item) => !item.onTime).length}</p></div>
              <div class="card"><h3>Average</h3><p>${avg || "N/A"}</p></div>
            </div>
            <h2>Subject Summary</h2>
            <table>
              <thead><tr><th>Subject</th><th>Assignments</th><th>Submissions</th><th>Reviewed</th><th>On-Time</th><th>Average</th></tr></thead>
              <tbody>${rows || "<tr><td colspan='6'>No report data</td></tr>"}</tbody>
            </table>
          </div>
          <script>window.onload = () => setTimeout(() => window.print(), 250);</script>
        </body>
      </html>
    `);
    reportWindow.document.close();
  }
}

function aggregateFacultySubjects(assignments, submissions) {
  const grouped = {};

  assignments.forEach((assignment) => {
    const subject = assignment.subject || "General";
    if (!grouped[subject]) {
      grouped[subject] = {
        subject,
        assignments: 0,
        submissions: 0,
        reviewed: 0,
        onTime: 0,
        scoreValues: [],
      };
    }

    grouped[subject].assignments += 1;
  });

  submissions.forEach((submission) => {
    const subject = assignments.find((item) => item.id === submission.assignmentId)?.subject || "General";
    if (!grouped[subject]) {
      grouped[subject] = {
        subject,
        assignments: 0,
        submissions: 0,
        reviewed: 0,
        onTime: 0,
        scoreValues: [],
      };
    }

    grouped[subject].submissions += 1;
    if (submission.score !== "") {
      grouped[subject].reviewed += 1;
      grouped[subject].scoreValues.push((Number(submission.score) / submission.maxScore) * 100);
    }
    if (submission.onTime) {
      grouped[subject].onTime += 1;
    }
  });

  return Object.values(grouped)
    .map((item) => ({
      ...item,
      onTimeRate: item.submissions === 0 ? 0 : Math.round((item.onTime / item.submissions) * 100),
      avgScore:
        item.scoreValues.length === 0
          ? 0
          : Math.round(
              (item.scoreValues.reduce((sum, value) => sum + value, 0) / item.scoreValues.length) * 10
            ) / 10,
    }))
    .sort((a, b) => b.submissions - a.submissions);
}

function aggregateSubjectStats(reviewedRows, assignments) {
  const assignmentMap = new Map(assignments.map((item) => [item.id, item]));
  const grouped = {};

  reviewedRows.forEach((row) => {
    const subject = assignmentMap.get(row.assignmentId)?.subject || "General";
    if (!grouped[subject]) {
      grouped[subject] = [];
    }

    const percent = row.maxScore > 0 ? (Number(row.score) / row.maxScore) * 100 : 0;
    grouped[subject].push(percent);
  });

  return Object.keys(grouped)
    .map((subject) => {
      const values = grouped[subject];
      const avg = Math.round((values.reduce((sum, item) => sum + item, 0) / values.length) * 10) / 10;
      return {
        subject,
        count: values.length,
        avg,
      };
    })
    .sort((a, b) => b.avg - a.avg);
}

function sortResultRows(a, b, mode, assignmentMap) {
  if (mode === "scoreAsc") {
    const aScore = a.score === "" ? Number.POSITIVE_INFINITY : Number(a.score);
    const bScore = b.score === "" ? Number.POSITIVE_INFINITY : Number(b.score);
    return aScore - bScore;
  }

  if (mode === "subjectAsc") {
    const subjectA = assignmentMap.get(a.assignmentId)?.subject || "";
    const subjectB = assignmentMap.get(b.assignmentId)?.subject || "";
    return subjectA.localeCompare(subjectB);
  }

  if (mode === "recent") {
    return new Date(b.submittedAt) - new Date(a.submittedAt);
  }

  const aScore = a.score === "" ? -1 : Number(a.score);
  const bScore = b.score === "" ? -1 : Number(b.score);
  return bScore - aScore;
}

function setupLogoutHandlers() {
  document.querySelectorAll(".logout-student").forEach((link) => {
    link.addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEYS.currentStudent);
    });
  });

  document.querySelectorAll(".logout-faculty").forEach((link) => {
    link.addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEYS.currentFaculty);
    });
  });
}

function updateStudentProgress(totalAssignments, submittedCount) {
  const progressFill = document.getElementById("studentProgressFill");
  const progressText = document.getElementById("studentProgressText");
  if (!progressFill || !progressText) {
    return;
  }

  const percent = totalAssignments === 0 ? 0 : Math.round((submittedCount / totalAssignments) * 100);
  progressFill.style.width = `${percent}%`;
  progressText.textContent = `${percent}% completed`;
}

function setupCreateDraftAutoSave(
  titleInput,
  subjectInput,
  descriptionInput,
  maxScoreInput,
  priorityInput,
  tagsInput,
  deadlineInput,
  draftStatus
) {
  const saveDraft = () => {
    const draftData = {
      title: titleInput.value,
      subject: subjectInput.value,
      description: descriptionInput.value,
      maxScore: maxScoreInput.value,
      priority: priorityInput.value,
      tags: tagsInput.value,
      deadline: deadlineInput.value,
      updatedAt: new Date().toISOString(),
    };

    setData(STORAGE_KEYS.createDraft, draftData);
    if (draftStatus) {
      draftStatus.textContent = `Draft saved at ${formatDisplayDateTime(draftData.updatedAt)}`;
    }
  };

  titleInput.addEventListener("input", saveDraft);
  subjectInput.addEventListener("input", saveDraft);
  descriptionInput.addEventListener("input", saveDraft);
  maxScoreInput.addEventListener("input", saveDraft);
  priorityInput.addEventListener("change", saveDraft);
  tagsInput.addEventListener("input", saveDraft);
  deadlineInput.addEventListener("change", saveDraft);
}

function hydrateCreateDraft(
  titleInput,
  subjectInput,
  descriptionInput,
  maxScoreInput,
  priorityInput,
  tagsInput,
  deadlineInput,
  draftStatus
) {
  const draft = getData(STORAGE_KEYS.createDraft, null);
  if (!draft) {
    return;
  }

  titleInput.value = draft.title || "";
  subjectInput.value = draft.subject || "";
  descriptionInput.value = draft.description || "";
  maxScoreInput.value = draft.maxScore || "10";
  priorityInput.value = draft.priority || "Medium";
  tagsInput.value = draft.tags || "";
  deadlineInput.value = draft.deadline || "";

  if (draftStatus && draft.updatedAt) {
    draftStatus.textContent = `Draft restored from ${formatDisplayDateTime(draft.updatedAt)}`;
  }
}

function renderAssignmentMeta(selectedAssignmentId, assignments, metaPanel) {
  if (!metaPanel) {
    return;
  }

  const selectedAssignment = assignments.find((item) => item.id === selectedAssignmentId);
  if (!selectedAssignment) {
    metaPanel.innerHTML = "";
    return;
  }

  metaPanel.innerHTML = `
    <p><strong>Subject:</strong> ${escapeHtml(selectedAssignment.subject)}</p>
    <p><strong>Deadline:</strong> ${formatDisplayDate(selectedAssignment.deadline)} (${escapeHtml(
    deadlineWarning(selectedAssignment.deadline) || "planned"
  )})</p>
    <p><strong>Priority:</strong> ${escapeHtml(selectedAssignment.priority)} | <strong>Max Score:</strong> ${selectedAssignment.maxScore}</p>
    <p>${selectedAssignment.tags.map((tag) => `<span class="tag-chip">#${escapeHtml(tag)}</span>`).join(" ")}</p>
  `;
}

function populateStudentSubjects(assignments, subjectFilter) {
  if (!subjectFilter) {
    return;
  }

  const uniqueSubjects = [...new Set(assignments.map((item) => item.subject))].filter(Boolean);
  const currentValue = subjectFilter.value || "all";

  subjectFilter.innerHTML = `<option value="all">All Subjects</option>${uniqueSubjects
    .map((subject) => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`)
    .join("")}`;

  if (uniqueSubjects.includes(currentValue)) {
    subjectFilter.value = currentValue;
  }
}

function renderStudentUpcoming(upcoming, target) {
  if (!target) {
    return;
  }

  if (upcoming.length === 0) {
    target.innerHTML = `<article class="list-item"><p>No urgent deadlines. Great pace.</p></article>`;
    return;
  }

  target.innerHTML = upcoming
    .slice(0, 5)
    .map(
      (item) => `
        <article class="list-item">
          <p><strong>${escapeHtml(item.title)}</strong></p>
          <p>${escapeHtml(item.subject)} | ${formatDisplayDate(item.deadline)}</p>
        </article>
      `
    )
    .join("");
}

function renderStudentPerformance(reviewedSubmissions, allSubmissions, target) {
  if (!target) {
    return;
  }

  const avg = calculateAverageScore(reviewedSubmissions);
  const best = reviewedSubmissions
    .map((item) => ({
      title: item.assignmentTitle,
      ratio: item.maxScore ? Number(item.score) / item.maxScore : 0,
      raw: `${item.score}/${item.maxScore}`,
    }))
    .sort((a, b) => b.ratio - a.ratio)[0];

  target.innerHTML = `
    <article class="list-item"><p><strong>Reviewed Works:</strong> ${reviewedSubmissions.length}</p></article>
    <article class="list-item"><p><strong>Average Score:</strong> ${avg === null ? "N/A" : avg}</p></article>
    <article class="list-item"><p><strong>Best Result:</strong> ${best ? `${escapeHtml(best.title)} (${escapeHtml(best.raw)})` : "N/A"}</p></article>
    <article class="list-item"><p><strong>Total Uploads:</strong> ${allSubmissions.length}</p></article>
  `;
}

function renderFacultyRecentActivity(submissions, assignments) {
  const target = document.getElementById("facultyRecentActivity");
  if (!target) {
    return;
  }

  const assignmentMap = new Map(assignments.map((item) => [item.id, item]));
  const recent = [...submissions]
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
    .slice(0, 5);

  if (recent.length === 0) {
    target.innerHTML = `<article class="list-item"><p>No recent submission activity.</p></article>`;
    return;
  }

  target.innerHTML = recent
    .map((item) => {
      const assignment = assignmentMap.get(item.assignmentId);
      return `
        <article class="list-item">
          <p><strong>${escapeHtml(item.studentName)}</strong> submitted <strong>${escapeHtml(item.assignmentTitle)}</strong></p>
          <p>${formatDisplayDateTime(item.submittedAt)} | ${assignment ? escapeHtml(assignment.subject) : "Unknown Subject"}</p>
        </article>
      `;
    })
    .join("");
}

function updateSubmissionStats(submissions) {
  updateText("viewTotalSubmissions", submissions.length);
  updateText("viewReviewedCount", submissions.filter((item) => item.score !== "").length);
  updateText("viewLateCount", submissions.filter((item) => !item.onTime).length);
  const average = calculateAverageScore(submissions.filter((item) => item.score !== ""));
  updateText("viewAverageScore", average === null ? "-" : average);
}

function findTopSubject(assignments) {
  if (assignments.length === 0) {
    return "";
  }

  const counts = assignments.reduce((acc, item) => {
    const key = item.subject || "General";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
}

function calculateAverageScore(submissions) {
  const numericScores = submissions
    .filter((item) => item.score !== "" && !Number.isNaN(Number(item.score)))
    .map((item) => {
      const score = Number(item.score);
      const max = item.maxScore || 10;
      return max > 0 ? (score / max) * 100 : 0;
    });

  if (numericScores.length === 0) {
    return null;
  }

  const total = numericScores.reduce((sum, value) => sum + value, 0);
  return `${Math.round((total / numericScores.length) * 10) / 10}%`;
}

function normalizeAssignment(assignment) {
  return {
    id: assignment.id || `A${Date.now()}`,
    title: assignment.title || "Untitled Assignment",
    subject: assignment.subject || "General",
    description: assignment.description || "",
    deadline: assignment.deadline || formatDate(addDays(new Date(), 7)),
    maxScore: Number(assignment.maxScore) > 0 ? Number(assignment.maxScore) : 10,
    priority: ["High", "Medium", "Low"].includes(assignment.priority) ? assignment.priority : "Medium",
    tags: Array.isArray(assignment.tags) ? assignment.tags : splitTags(assignment.tags || ""),
    createdAt: assignment.createdAt || new Date().toISOString(),
  };
}

function normalizeSubmission(submission, assignment) {
  const deadline = assignment?.deadline || formatDate(new Date());
  const lateInfo = computeLateInfo(submission.submittedAt || new Date().toISOString(), deadline);

  return {
    id: submission.id || safeUUID(),
    assignmentId: submission.assignmentId || assignment?.id || "",
    assignmentTitle: submission.assignmentTitle || assignment?.title || "Untitled Assignment",
    studentName: submission.studentName || "Unknown Student",
    regNo: submission.regNo || "",
    fileName: submission.fileName || "",
    submittedAt: submission.submittedAt || new Date().toISOString(),
    score: submission.score === undefined || submission.score === null ? "" : String(submission.score),
    feedback: submission.feedback || "",
    hoursSpent: submission.hoursSpent ? String(submission.hoursSpent) : "",
    note: submission.note || "",
    isOwnWork: submission.isOwnWork === true,
    maxScore: Number(submission.maxScore) > 0 ? Number(submission.maxScore) : assignment?.maxScore || 10,
    onTime: typeof submission.onTime === "boolean" ? submission.onTime : lateInfo.onTime,
    lateDays:
      typeof submission.lateDays === "number" && submission.lateDays >= 0
        ? submission.lateDays
        : lateInfo.lateDays,
  };
}

function computeLateInfo(submittedAt, deadline) {
  const submit = new Date(submittedAt);
  const due = new Date(deadline);
  due.setHours(23, 59, 59, 999);

  if (submit <= due) {
    return { onTime: true, lateDays: 0 };
  }

  const differenceMs = submit - due;
  const lateDays = Math.ceil(differenceMs / (24 * 60 * 60 * 1000));
  return { onTime: false, lateDays };
}

function sortAssignments(a, b, mode) {
  if (mode === "deadlineDesc") {
    return new Date(b.deadline) - new Date(a.deadline);
  }

  if (mode === "titleAsc") {
    return a.title.localeCompare(b.title);
  }

  if (mode === "priorityDesc") {
    return priorityWeight(b.priority) - priorityWeight(a.priority);
  }

  return new Date(a.deadline) - new Date(b.deadline);
}

function sortSubmissions(a, b, mode) {
  if (mode === "submittedAsc") {
    return new Date(a.submittedAt) - new Date(b.submittedAt);
  }

  if (mode === "scoreDesc") {
    return Number(b.score || -1) - Number(a.score || -1);
  }

  if (mode === "scoreAsc") {
    const aScore = a.score === "" ? Number.POSITIVE_INFINITY : Number(a.score);
    const bScore = b.score === "" ? Number.POSITIVE_INFINITY : Number(b.score);
    return aScore - bScore;
  }

  return new Date(b.submittedAt) - new Date(a.submittedAt);
}

function priorityWeight(priority) {
  const map = {
    High: 3,
    Medium: 2,
    Low: 1,
  };
  return map[priority] || 0;
}

function splitTags(raw) {
  if (!raw) {
    return [];
  }

  return String(raw)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function exportCsv(submissions) {
  const headers = [
    "Assignment",
    "Student",
    "RegNo",
    "SubmittedAt",
    "OnTime",
    "LateDays",
    "Score",
    "MaxScore",
    "Feedback",
    "HoursSpent",
    "Note",
    "FileName",
  ];

  const lines = [headers.join(",")];

  submissions.forEach((item) => {
    const row = [
      item.assignmentTitle,
      item.studentName,
      item.regNo,
      item.submittedAt,
      item.onTime ? "Yes" : "No",
      String(item.lateDays),
      item.score,
      String(item.maxScore),
      item.feedback,
      item.hoursSpent,
      item.note,
      item.fileName,
    ].map(csvEscape);

    lines.push(row.join(","));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `submissions-${formatDate(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function toast(text, type) {
  let wrap = document.querySelector(".toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }

  const toastElement = document.createElement("div");
  toastElement.className = `toast ${type === "error" ? "toast-error" : "toast-success"}`;
  toastElement.textContent = text;
  wrap.appendChild(toastElement);

  window.setTimeout(() => {
    toastElement.remove();
  }, 2200);
}

function getData(key, fallbackValue) {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return fallbackValue;
  }

  try {
    const parsed = JSON.parse(raw);

    if (Array.isArray(fallbackValue)) {
      return Array.isArray(parsed) ? parsed : fallbackValue;
    }

    if (fallbackValue && typeof fallbackValue === "object") {
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : fallbackValue;
    }

    return parsed;
  } catch (error) {
    return fallbackValue;
  }
}

function setData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function showMessage(element, text, type) {
  if (!element) {
    return;
  }

  element.textContent = text;
  element.className = `message ${type}`;
}

function updateText(id, value) {
  const element = document.getElementById(id);
  if (!element) {
    return;
  }

  animateTextValue(element, String(value));
}

function animateTextValue(element, value) {
  const numericPattern = /^-?\d+(?:\.\d+)?%?$/;
  if (!numericPattern.test(value)) {
    element.textContent = value;
    return;
  }

  const target = Number.parseFloat(value.replace(/%/g, ""));
  const suffix = value.endsWith("%") ? "%" : "";
  const startRaw = Number.parseFloat((element.textContent || "0").replace(/%/g, ""));
  const start = Number.isFinite(startRaw) ? startRaw : 0;
  const duration = 700;
  const startTime = performance.now();

  const step = (now) => {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + (target - start) * eased;
    element.textContent = `${Math.round(current * 10) / 10}${suffix}`;
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };

  window.requestAnimationFrame(step);
}

function formatDate(dateValue) {
  const date = new Date(dateValue);
  return date.toISOString().split("T")[0];
}

function formatDisplayDate(dateValue) {
  if (!dateValue) {
    return "N/A";
  }

  const date = new Date(dateValue);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDisplayDateTime(dateValue) {
  if (!dateValue) {
    return "N/A";
  }

  const date = new Date(dateValue);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function addDays(dateValue, days) {
  const date = new Date(dateValue);
  date.setDate(date.getDate() + days);
  return date;
}

function deadlineWarning(deadline) {
  const today = new Date();
  const dueDate = new Date(deadline);
  const oneDay = 24 * 60 * 60 * 1000;
  const difference = Math.ceil((dueDate - today) / oneDay);

  if (difference < 0) {
    return "Deadline passed";
  }

  if (difference === 0) {
    return "Deadline today";
  }

  if (difference === 1) {
    return "Deadline tomorrow";
  }

  if (difference === 2) {
    return "Due in 2 days";
  }

  if (difference === 3) {
    return "Due in 3 days";
  }

  return "";
}

function safeUUID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

function escapeHtml(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
