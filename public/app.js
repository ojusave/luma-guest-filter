const GITHUB_REPO_URL = "https://github.com/ojusave/luma-guest-filter";
const PAGE_SIZE = 50;
const OPTIONS_COLLAPSE_AT = 10;

/** Optional labels when Luma columns are present — never required. */
const LUMA_FIELD_META = {
  approval_status: {
    label: "Registration status",
    order: 0,
    valueLabels: {
      approved: "Going",
      pending_approval: "Pending",
      waitlist: "Waitlist",
      invited: "Invited",
      declined: "Not Going",
    },
  },
  ticket_name: { label: "Ticket type", order: 1 },
  coupon_code: { label: "Coupon code", order: 2 },
  utm_source: { label: "UTM source", order: 3 },
  custom_source: { label: "Custom source", order: 3 },
  currency: { label: "Currency", order: 4 },
  amount: { label: "Amount paid", order: 5 },
  amount_tax: { label: "Tax", order: 6 },
  amount_discount: { label: "Discount", order: 7 },
};

const NEVER_FILTER_COLUMNS = new Set([
  "guest_id",
  "api_id",
  "user_api_id",
  "event_api_id",
  "ticket_type_id",
  "name",
  "first_name",
  "last_name",
  "email",
  "phone_number",
  "qr_code_url",
  "created_at",
  "registered_at",
  "updated_at",
  "eth_address",
  "solana_address",
  "survey_response_feedback",
]);

const NEVER_FILTER_PATTERNS = [
  /_url$/i,
  /^qr_/i,
  /@/,
];

const CHECK_IN_COLUMN_NAMES = ["checked_in_at", "checked_in", "join_status", "joined_at"];

const state = {
  fileName: "",
  columns: [],
  rows: [],
  filterGroups: [],
  selected: new Map(),
  expandedGroups: new Set(),
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

function normalizeColumnKey(column) {
  return column.trim().toLowerCase();
}

function findColumn(columns, candidates) {
  const lookup = new Map(columns.map((col) => [normalizeColumnKey(col), col]));
  for (const candidate of candidates) {
    const match = lookup.get(candidate.toLowerCase());
    if (match) return match;
  }
  return null;
}

function storageValue(value) {
  return (value ?? "").trim();
}

function columnLabel(column) {
  return LUMA_FIELD_META[column]?.label ?? column;
}

function displayValue(column, value) {
  const raw = storageValue(value);
  if (!raw) return "(empty)";
  return LUMA_FIELD_META[column]?.valueLabels?.[raw] ?? raw;
}

function maxUniqueValues(rowCount) {
  return Math.min(50, Math.max(15, Math.floor(rowCount * 0.08)));
}

function uniqueValuesForColumn(rows, column) {
  return new Set(rows.map((row) => storageValue(row[column])));
}

function looksLikeEmailColumn(rows, column) {
  const sample = rows
    .map((row) => storageValue(row[column]))
    .filter(Boolean)
    .slice(0, 40);
  if (!sample.length) return false;
  const emailLike = sample.filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)).length;
  return emailLike / sample.length > 0.8;
}

function looksLikeUrlColumn(rows, column) {
  const sample = rows
    .map((row) => storageValue(row[column]))
    .filter(Boolean)
    .slice(0, 20);
  if (!sample.length) return false;
  const urlLike = sample.filter((value) => /^https?:\/\//i.test(value)).length;
  return urlLike / sample.length > 0.7;
}

function averageValueLength(rows, column) {
  const values = rows.map((row) => storageValue(row[column])).filter(Boolean);
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value.length, 0) / values.length;
}

function isNeverFilterColumn(column, rows) {
  const key = normalizeColumnKey(column);
  if (NEVER_FILTER_COLUMNS.has(key)) return true;
  if (NEVER_FILTER_PATTERNS.some((pattern) => pattern.test(column))) return true;
  if (CHECK_IN_COLUMN_NAMES.includes(key)) return true;
  if (looksLikeEmailColumn(rows, column)) return true;
  if (looksLikeUrlColumn(rows, column)) return true;
  if (averageValueLength(rows, column) > 120) return true;
  return false;
}

function isFilterableColumn(column, rows) {
  if (isNeverFilterColumn(column, rows)) return false;
  const uniqueCount = uniqueValuesForColumn(rows, column).size;
  if (uniqueCount <= 1) return false;
  return uniqueCount <= maxUniqueValues(rows.length);
}

function buildCheckInGroup(rows, columns) {
  const checkInColumn = findColumn(columns, CHECK_IN_COLUMN_NAMES);
  if (!checkInColumn) return null;

  let checked = 0;
  let notChecked = 0;
  for (const row of rows) {
    if (storageValue(row[checkInColumn])) checked += 1;
    else notChecked += 1;
  }

  if (checked === 0 && notChecked === 0) return null;

  return {
    id: "__check_in__",
    column: checkInColumn,
    label: "Check-in status",
    order: 0.5,
    options: [
      { value: "__checked_in__", label: "Checked in", count: checked },
      { value: "__not_checked_in__", label: "Not checked in", count: notChecked },
    ],
    derived: "check_in",
  };
}

function buildColumnGroup(column, rows) {
  const counts = new Map();
  for (const row of rows) {
    const key = storageValue(row[column]);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const options = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({
      value,
      label: displayValue(column, value),
      count,
    }));

  if (!options.length) return null;

  return {
    id: column,
    column,
    label: columnLabel(column),
    order: LUMA_FIELD_META[column]?.order ?? 100,
    options,
    derived: null,
  };
}

function buildFilterGroups(rows, columns) {
  const groups = [];

  const checkInGroup = buildCheckInGroup(rows, columns);
  if (checkInGroup) groups.push(checkInGroup);

  for (const column of columns) {
    if (!isFilterableColumn(column, rows)) continue;
    const group = buildColumnGroup(column, rows);
    if (group) groups.push(group);
  }

  groups.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.label.localeCompare(b.label);
  });

  return groups.filter((group) => group.options.some((option) => option.count > 0));
}

function looksLikeLumaExport(columns) {
  const normalized = new Set(columns.map(normalizeColumnKey));
  const lumaSignals = [
    "approval_status",
    "guest_id",
    "api_id",
    "ticket_name",
    "created_at",
    "email",
  ];
  return lumaSignals.filter((signal) => normalized.has(signal)).length >= 2;
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

    if (group.derived === "check_in") {
      const checked = Boolean(storageValue(row[group.column]));
      const wantsChecked = selected.has("__checked_in__");
      const wantsNotChecked = selected.has("__not_checked_in__");
      if (checked && !wantsChecked) return false;
      if (!checked && !wantsNotChecked) return false;
      continue;
    }

    const value = storageValue(row[group.column]);
    if (!selected.has(value)) return false;
  }
  return true;
}

function getFilteredRows() {
  const anySelected = [...state.selected.values()].some((set) => set.size > 0);
  if (!anySelected) return state.rows;
  return state.rows.filter(rowMatchesFilters);
}

function renderFilterOptions(group, optionsWrap) {
  const expanded = state.expandedGroups.has(group.id);
  const visibleOptions =
    expanded || group.options.length <= OPTIONS_COLLAPSE_AT
      ? group.options
      : group.options.slice(0, OPTIONS_COLLAPSE_AT);

  for (const option of visibleOptions) {
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

  if (group.options.length > OPTIONS_COLLAPSE_AT) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "btn btn-ghost filter-expand";
    toggle.textContent = expanded
      ? "Show fewer"
      : `Show ${group.options.length - OPTIONS_COLLAPSE_AT} more`;
    toggle.addEventListener("click", () => {
      if (state.expandedGroups.has(group.id)) state.expandedGroups.delete(group.id);
      else state.expandedGroups.add(group.id);
      renderFilters();
    });
    optionsWrap.appendChild(toggle);
  }
}

function renderFilters() {
  const grid = document.getElementById("filtersGrid");
  grid.innerHTML = "";

  if (!state.filterGroups.length) {
    grid.innerHTML =
      '<p class="section-sub">No filterable columns were detected in this file. You can still preview and download the full guest list.</p>';
    return;
  }

  for (const group of state.filterGroups) {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "filter-group";
    fieldset.dataset.groupId = group.id;

    const legend = document.createElement("legend");
    legend.textContent = group.label;
    fieldset.appendChild(legend);

    const optionsWrap = document.createElement("div");
    optionsWrap.className = "filter-options";
    renderFilterOptions(group, optionsWrap);

    fieldset.appendChild(optionsWrap);
    grid.appendChild(fieldset);
  }
}

function renderResults() {
  const filtered = getFilteredRows();
  const total = state.rows.length;
  const showing = filtered.length;

  document.getElementById("resultsSummary").textContent =
    `Showing ${showing.toLocaleString()} of ${total.toLocaleString()} guests · ${state.filterGroups.length.toLocaleString()} filter groups from your file`;

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
    document.getElementById("pageInfo").textContent = `Page ${state.page} of ${totalPages}`;
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
  state.expandedGroups = new Set();
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
    for (const key of [...Object.keys(row)]) {
      const normalized = normalizeHeader(key);
      if (key !== normalized) {
        row[normalized] = row[key];
        delete row[key];
      }
    }
  }

  state.fileName = file.name;
  state.columns = columns;
  state.rows = rows;
  state.filterGroups = buildFilterGroups(rows, columns);
  initSelection(state.filterGroups);
  state.expandedGroups = new Set();
  state.page = 1;

  const lumaHint = looksLikeLumaExport(columns)
    ? "Luma export detected"
    : "Custom CSV loaded";

  document.getElementById("uploadMeta").hidden = false;
  document.getElementById("uploadMeta").textContent =
    `${file.name} · ${rows.length.toLocaleString()} rows · ${columns.length} columns · ${lumaHint}`;

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
    alert("Please upload a .csv file.");
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
