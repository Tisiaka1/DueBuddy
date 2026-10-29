// Canvas API helpers. Returning the parsed response lets the UI use the
// actual Canvas objects instead of only printing them to the console.
async function GetCourse(path) {
  const response = await fetch(`${location.origin}/api/v1${path}`, {
    credentials: "same-origin"
  });

  if (!response.ok) {
    throw new Error(`Canvas API request failed (${response.status}): ${path}`);
  }

  return response.json();
}

async function getAssignmentsForCourses(courses) {
  const courseAssignments = await Promise.all(
    courses.map(async (course) => {
      const assignments = await GetCourse(
        `/courses/${course.id}/assignments?per_page=100`
      );

      return assignments.map((assignment) => ({
        id: assignment.id,
        courseId: course.id,
        course: course.name,
        courseCode: course.course_code,
        name: assignment.name,
        dueAt: assignment.due_at,
        htmlUrl: assignment.html_url
      }));
    })
  );

  return courseAssignments.flat();
}

function sortByDueDate(assignments) {
  return assignments.sort((a, b) => {
    // Assignments with a real due date come first; compare the ISO date values
    // as timestamps so the closest deadline is the focus task.
    if (!a.dueAt && !b.dueAt) return a.name.localeCompare(b.name);
    if (!a.dueAt) return 1;
    if (!b.dueAt) return -1;
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });
}

function formatDueDate(dueAt) {
  if (!dueAt) return "No due date";

  const date = new Date(dueAt);
  return `Due ${new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date)}`;
}

function getCurrentWeekAssignments(assignments, now = new Date()) {
  // Use the browser's local calendar week (Sunday through Saturday), matching
  // the date and time Canvas shows the student on this device.
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  return assignments.filter((assignment) => {
    if (!assignment.dueAt) return false;
    const due = new Date(assignment.dueAt);
    return due >= start && due < end;
  });
}

function getAssignmentKey(assignment) {
  return `${assignment.courseId}:${assignment.id}`;
}

// Visual display section. This is intentionally structural HTML only.
// STYLING GOES IN A SEPARATE FILE: add the rules to `styles.css`, then add
// "css": ["styles.css"] inside this content script entry in manifest.json.
// The stylesheet can target #due-buddy-panel and the stable element IDs below.
// Keep presentation rules in that stylesheet, not here.

function createWidget() {
  const panel = document.createElement("aside");
  panel.id = "due-buddy-panel";
  panel.setAttribute("aria-label", "Assignment companion");
  panel.innerHTML = `
    <header>
      <p>Canvas companion</p>
      <h2>Your next step</h2>
      <p>One task at a time. You've got this.</p>
    </header>
    <div>
      <section aria-label="Progress this week">
        <span>This week</span>
        <strong id="due-buddy-progress-text">0 of 0 complete</strong>
        <progress id="due-buddy-progress" value="0" max="0"></progress>
      </section>
      <section aria-label="Prioritize this assignment">
        <h3>Prioritize</h3>
        <div id="due-buddy-focus">
          <p id="due-buddy-focus-course"></p>
          <h4 id="due-buddy-focus-name">Loading assignments…</h4>
          <p id="due-buddy-focus-due"></p>
          <p id="due-buddy-focus-kind">Assignment</p>
          <button id="due-buddy-complete" type="button">Mark complete</button>
        </div>
      </section>
      <section aria-label="Upcoming assignments">
        <h3>Then coming up</h3>
        <ol id="due-buddy-queue"></ol>
      </section>
    </div>
  `;
  return panel;
}

function renderWidget(panel, assignments, completedIds) {
  const thisWeek = getCurrentWeekAssignments(assignments);
  const remaining = thisWeek.filter((assignment) => !completedIds.has(getAssignmentKey(assignment)));
  const completedCount = thisWeek.length - remaining.length;
  const progress = panel.querySelector("#due-buddy-progress");
  const focus = remaining[0];

  panel.querySelector("#due-buddy-progress-text").textContent =
    `${Math.min(completedCount, thisWeek.length)} of ${thisWeek.length} complete this week`;
  progress.max = Math.max(thisWeek.length, 1);
  progress.value = Math.min(completedCount, thisWeek.length);

  const queue = panel.querySelector("#due-buddy-queue");
  queue.replaceChildren();

  if (!focus) {
    panel.querySelector("#due-buddy-focus-course").textContent = "";
    panel.querySelector("#due-buddy-focus-name").textContent = assignments.length
      ? thisWeek.length
        ? "All caught up this week. Take a breath."
        : "No assignments due this week."
      : "No assignments found.";
    panel.querySelector("#due-buddy-focus-due").textContent = "";
    panel.querySelector("#due-buddy-complete").hidden = true;
    panel.querySelector("#due-buddy-complete").disabled = true;
    return;
  }

  panel.querySelector("#due-buddy-complete").hidden = false;
  panel.querySelector("#due-buddy-complete").disabled = false;
  panel.querySelector("#due-buddy-focus-course").textContent =
    [focus.courseCode, focus.course].filter(Boolean).join(" · ");
  panel.querySelector("#due-buddy-focus-name").textContent = focus.name;
  panel.querySelector("#due-buddy-focus-due").textContent = formatDueDate(focus.dueAt);

  // Keep the prioritized task plus at most three more visible (four total).
  for (const assignment of remaining.slice(1, 4)) {
    const row = document.createElement("li");
    const name = document.createElement("strong");
    name.textContent = assignment.name;
    const course = document.createElement("span");
    course.textContent = [assignment.courseCode, assignment.course]
      .filter(Boolean)
      .join(" · ");
    const due = document.createElement("span");
    due.textContent = formatDueDate(assignment.dueAt);
    row.append(name, course, due);

    if (assignment.htmlUrl) {
      const link = document.createElement("a");
      link.href = assignment.htmlUrl;
      link.textContent = "Open assignment";
      row.append(link);
    }

    queue.append(row);
  }
}

async function run() {
  // Canvas may replace page regions during navigation; avoid adding a second
  // widget and a second set of event handlers to the same page.
  if (document.querySelector("#due-buddy-panel")) return;

  const canvasContent = document.querySelector("#content") ||
    document.querySelector("main");

  if (!canvasContent) {
    console.error("Couldn't find Canvas's main content area.");
    return;
  }

  const panel = createWidget();
  canvasContent.prepend(panel);

  const storageKey = `dueBuddyCompleted:${location.origin}`;
  let savedIds = [];
  try {
    const saved = await chrome.storage.local.get(storageKey);
    savedIds = saved[storageKey] || [];
  } catch (error) {
    console.error("DueBuddy couldn't load saved completion state:", error);
  }
  const completedIds = new Set(savedIds);

  let assignments = [];
  const completeButton = panel.querySelector("#due-buddy-complete");
  completeButton.disabled = true;
  completeButton.addEventListener("click", async () => {
    const currentFocus = getCurrentWeekAssignments(assignments)
      .find((assignment) => !completedIds.has(getAssignmentKey(assignment)));
    if (!currentFocus) return;

    const currentKey = getAssignmentKey(currentFocus);
    completedIds.add(currentKey);
    // Update the list immediately, then persist the completion in extension
    // storage so it remains checked after refreshing Canvas or restarting.
    renderWidget(panel, assignments, completedIds);
    try {
      await chrome.storage.local.set({ [storageKey]: [...completedIds] });
    } catch (error) {
      console.error("DueBuddy couldn't save completion state:", error);
    }
  });

  try {
    const courses = await GetCourse(
      "/users/self/favorites/courses?per_page=100"
    );
    assignments = sortByDueDate(await getAssignmentsForCourses(courses));
    renderWidget(panel, assignments, completedIds);

    // Refresh the visible week when the local calendar rolls over, even if
    // the Canvas page stays open overnight. The Canvas API data is reused.
    const nextWeek = new Date();
    nextWeek.setHours(24, 0, 0, 0);
    nextWeek.setDate(nextWeek.getDate() + (7 - nextWeek.getDay()));
    window.setTimeout(() => renderWidget(panel, assignments, completedIds),
      nextWeek.getTime() - Date.now());
  } catch (error) {
    panel.querySelector("#due-buddy-focus-name").textContent =
      "Couldn't load assignments.";
    console.error("DueBuddy couldn't load Canvas assignments:", error);
  }
}

run();
