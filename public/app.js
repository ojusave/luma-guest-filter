const GITHUB_REPO_URL = "https://github.com/ojusave/luma-guest-filter";
const PAGE_SIZE = 50;

const APPROVAL_LABELS = {
  approved: "Going",
  pending_approval: "Pending",
  waitlist: "Waitlist",
  invited: "Invited",
  declined: "Not Going",
};

const FILTER_COLUMNS = {
  approval_status: { label: "Registration status", valueLabels: APPROVAL_LABELS },
  ticket_name: { label: "Ticket type" },
  coupon_code: { label: "Coupon code" },
  utm_source: { label: "UTM source" },
};

const SKIP_AUTO_FILTER = new Set([
  "guest_id",
  "api_id",
  "name",
  "first_name",
  "last_name",
  "email",
  "phone_number",
  "created_at",
  "checked_in_at",
  "qr_code_url",
  "ticket_type_id",
  "amount",
  "amount_tax",
  "amount_discount",
  "currency",
  "eth_address",
  "solana_address",
  "survey_response_rating",
  "survey_response_feedback",
]);

const state = {
  fileName: "",
  columns: [],
  rows: [],
  filterGroups: [],
  selected: new Map(),
  page: 1,
};

function renderSignupUrl(content = "footer_link") {
  const params = new URLSearchParams({
    utm_source: "github",
    utm_medium: "referral",
    utm_campaign: "ojus_demos",
    utm_content: content,
  });
  return `https://dashboard.render.com/register?${params.toString()}`;
}

function deployUrl() {
  return `https://render.com/deploy?repo=${encodeURIComponent(GITHUB_REPO_URL)}`;
}

function wireMarketingLinks() {
  document.getElementById("githubLink").href = GITHUB_REPO_URL;
  document.getElementById("deployNav").href = deployUrl();
  document.getElementById("deployHero").href = deployUrl();
  document.getElementById("signupNav").href = renderSignupUrl("navbar_button");
  document.getElementById("signupHero").href = renderSignupUrl("hero_cta");
  document.getElementById("signupFooter").href = renderSignupUrl("footer_link");
}

function normalizeHeader(header) {
  return header.replace(/^\uFEFF/, "").trim();
}

function displayValue(column, value) {
  const raw = (value ?? "").trim();
  if (!raw) return "(empty)";

  const config = FILTER_COLUMNS[column];
  if (config?.valueLabels?.[raw]) return config.valueLabels[raw];
  return raw;
}

function storageValue(column, value) {
  return (value ?? "").trim();
}

function buildFilterGroups(rows, columns) {
  const groups = [];

  groups.push({
    id: "check_in",
    column: "checked_in_at",
    label: "Check-in status",
    options: [
      { value: "__checked_in__", label: "Checked in", count: 0 },
      { value: "__not_checked_in__", label: "Not checked in", count: 0 },
    ],
    derived: true,
  });

  for (const [column, config] of Object.entries(FILTER_COLUMNS)) {
    if (!columns.includes(column)) continue;
    groups.push({
      id: column,
      column,
      label: config.label,
      options: [],
      derived: false,
    });
  }

  const used = new Set([...Object.keys(FILTER_COLUMNS), "checked_in_at"]);
  for (const column of columns) {
    if (used.has(column) || SKIP_AUTO_FILTER.has(column)) continue;
    const values = new Set(rows.map((row) => storageValue(column, row[column])));
    if (values.size === 0 || values.size > 30) continue;
    groups.push({
      id: column,
      column,
      label: column,
      options: [],
      derived: false,
    });
    used.add(column);
  }

  for (const group of groups) {
    if (group.derived && group.id === "check_in") {
      let checked = 0;
      let notChecked = 0;
      for (const row of rows) {
        if (storageValue("checked_in_at", row.checked_in_at)) checked += 1;
        else notChecked += 1;
      }
      group.options[0].count = checked;
      group.options[1].count = notChecked;
      continue;
    }

    const counts = new Map();
    for (const row of rows) {
      const key = storageValue(group.column, row[group.column]);
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    group.options = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({
        value,
        label: displayValue(group.column, value),
        count,
      }));
  }

  return groups.filter((group) => group.options.some((option) => option.count > 0));
}

function initSelection(groups) {
  state.selected = new Map();
  for (const group of groups) {
    state.selected.set(group.id, new Set());
  }
}

function rowMatchesFilters(row) {
  for (const group of state.filterGroups) {
    const selected = state.selected.get(group.id);
    if (!selected || selected.size === 0) continue;

    if (group.derived && group.id === "check_in") {
      const checked = Boolean(storageValue("checked_in_at", row.checked_in_at));
      const wantsChecked = selected.has("__checked_in__");
      const wantsNotChecked = selected.has("__not_checked_in__");
      if (checked && !wantsChecked) return false;
      if (!checked && !wantsNotChecked) return false;
      continue;
    }

    const value = storageValue(group.column, row[group.column]);
    if (!selected.has(value)) return false;
  }
  return true;
}

function getFilteredRows() {
  const anySelected = [...state.selected.values()].some((set) => set.size > 0);
  if (!anySelected) return state.rows;
  return state.rows.filter(rowMatchesFilters);
}

function renderFilters() {
  const grid = document.getElementById("filtersGrid");
  grid.innerHTML = "";

  for (const group of state.filterGroups) {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "filter-group";
    fieldset.dataset.groupId = group.id;

    const legend = document.createElement("legend");
    legend.textContent = group.label;
    fieldset.appendChild(legend);

    const optionsWrap = document.createElement("div");
    optionsWrap.className = "filter-options";

    for (const option of group.options) {
      const label = document.createElement("label");
      label.className = "filter-option";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = option.value;
      input.checked = state.selected.get(group.id)?.has(option.value) ?? false;
      input.addEventListener("change", () => {
        const set = state.selected.get(group.id);
        if (input.checked) set.add(option.value);
        else set.delete(option.value);
        state.page = 1;
        renderResults();
      });

      const text = document.createElement("span");
      text.textContent = `${option.label} (${option.count.toLocaleString()})`;

      label.append(input, text);
      optionsWrap.appendChild(label);
    }

    fieldset.appendChild(optionsWrap);
    grid.appendChild(fieldset);
  }
}

function renderResults() {
  const filtered = getFilteredRows();
  const total = state.rows.length;
  const showing = filtered.length;

  document.getElementById("resultsSummary").textContent =
    `Showing ${showing.toLocaleString()} of ${total.toLocaleString()} guests`;

  const totalPages = Math.max(1, Math.ceil(showing / PAGE_SIZE));
  if (state.page > totalPages) state.page = totalPages;

  const start = (state.page - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  const head = document.getElementById("tableHead");
  head.innerHTML = `<tr>${state.columns.map((col) => `<th scope="col">${escapeHtml(col)}</th>`).join("")}</tr>`;

  const body = document.getElementById("tableBody");
  body.innerHTML = pageRows
    .map(
      (row) =>
        `<tr>${state.columns
          .map((col) => `<td>${escapeHtml(row[col] ?? "")}</td>`)
          .join("")}</tr>`
    )
    .join("");

  const pagination = document.getElementById("pagination");
  if (showing > PAGE_SIZE) {
    pagination.hidden = false;
    document.getElementById("pageInfo").textContent =
      `Page ${state.page} of ${totalPages}`;
    document.getElementById("prevPageBtn").disabled = state.page <= 1;
    document.getElementById("nextPageBtn").disabled = state.page >= totalPages;
  } else {
    pagination.hidden = true;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function downloadFilteredCsv() {
  const filtered = getFilteredRows();
  const csv = Papa.unparse(filtered, { columns: state.columns });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const baseName = state.fileName.replace(/\.csv$/i, "") || "luma-guests";
  link.href = url;
  link.download = `${baseName}-filtered.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function resetApp() {
  state.fileName = "";
  state.columns = [];
  state.rows = [];
  state.filterGroups = [];
  state.selected = new Map();
  state.page = 1;

  document.getElementById("fileInput").value = "";
  document.getElementById("uploadMeta").hidden = true;
  document.getElementById("filtersSection").hidden = true;
  document.getElementById("resultsSection").hidden = true;
  document.getElementById("uploadSection").hidden = false;
}

function handleParsedFile(file, parsed) {
  if (parsed.errors.length) {
    const first = parsed.errors[0];
    throw new Error(`CSV parse error on row ${first.row}: ${first.message}`);
  }

  const rows = parsed.data.filter((row) =>
    Object.values(row).some((value) => String(value ?? "").trim() !== "")
  );

  if (!rows.length) throw new Error("No guest rows found in this CSV.");

  const columns = (parsed.meta.fields || Object.keys(rows[0])).map(normalizeHeader);
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (key !== normalizeHeader(key)) {
        row[normalizeHeader(key)] = row[key];
        delete row[key];
      }
    }
  }

  state.fileName = file.name;
  state.columns = columns;
  state.rows = rows;
  state.filterGroups = buildFilterGroups(rows, columns);
  initSelection(state.filterGroups);
  state.page = 1;

  document.getElementById("uploadMeta").hidden = false;
  document.getElementById("uploadMeta").textContent =
    `${file.name} · ${rows.length.toLocaleString()} rows · ${columns.length} columns`;

  document.getElementById("uploadSection").hidden = true;
  document.getElementById("filtersSection").hidden = false;
  document.getElementById("resultsSection").hidden = false;

  renderFilters();
  renderResults();
}

function parseFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: normalizeHeader,
      complete: (results) => resolve(results),
      error: (error) => reject(error),
    });
  });
}

async function onFileSelected(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".csv")) {
    alert("Please upload a .csv file exported from Luma.");
    return;
  }

  try {
    const parsed = await parseFile(file);
    handleParsedFile(file, parsed);
  } catch (error) {
    alert(error.message || "Could not read this CSV file.");
    resetApp();
  }
}

function wireUpload() {
  const zone = document.getElementById("uploadZone");
  const input = document.getElementById("fileInput");

  zone.addEventListener("click", () => input.click());
  zone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      input.click();
    }
  });

  input.addEventListener("change", () => onFileSelected(input.files[0]));

  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("dragover");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("dragover");
    onFileSelected(event.dataTransfer.files[0]);
  });
}

function wireActions() {
  document.getElementById("clearFiltersBtn").addEventListener("click", () => {
    initSelection(state.filterGroups);
    state.page = 1;
    renderFilters();
    renderResults();
  });

  document.getElementById("resetFileBtn").addEventListener("click", resetApp);
  document.getElementById("downloadBtn").addEventListener("click", downloadFilteredCsv);

  document.getElementById("prevPageBtn").addEventListener("click", () => {
    state.page -= 1;
    renderResults();
  });
  document.getElementById("nextPageBtn").addEventListener("click", () => {
    state.page += 1;
    renderResults();
  });
}

wireMarketingLinks();
wireUpload();
wireActions();
