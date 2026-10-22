const files = new Map();
const input = document.querySelector("#file-input");
const dropzone = document.querySelector("#dropzone");
const fileList = document.querySelector("#file-list");
const question = document.querySelector("#question");
const answer = document.querySelector("#answer");
const maxFileSize = 15 * 1024 * 1024;
const API_URL = "/api/ask-pdf/";
let toastTimer;

function showToast(message) {
  const toast = document.querySelector("#toast");

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

function updateUI() {
  const hasFiles = files.size > 0;

  document.querySelector("#file-count").textContent =
    `${files.size} FILE${files.size === 1 ? "" : "S"}`;

  document.querySelector("#clear-files").disabled = !hasFiles;
  document.querySelector("#empty-state").hidden = hasFiles;
  question.disabled = !hasFiles;
  document.querySelector("#ask-button").disabled = !hasFiles;
}

function renderFiles() {
  fileList.replaceChildren();

  for (const file of files.values()) {
    const row = document.createElement("div");
    row.className = "file-row";

    const type = document.createElement("span");
    type.className = `file-type ${file.extension}`;
    type.textContent = file.extension.toUpperCase();

    const info = document.createElement("div");
    info.className = "file-name";

    const name = document.createElement("strong");
    name.textContent = file.name;

    const detail = document.createElement("small");
    detail.textContent =
      `${Math.max(1, Math.round(file.size / 1024))} KB · Ready to search`;

    info.append(name, detail);

    const removeButton = document.createElement("button");
    removeButton.className = "remove-file";
    removeButton.type = "button";
    removeButton.textContent = "×";
    removeButton.setAttribute("aria-label", `Remove ${file.name}`);

    removeButton.addEventListener("click", () => {
      files.delete(file.id);
      renderFiles();
    });

    row.append(type, info, removeButton);
    fileList.append(row);
  }

  updateUI();
}

async function addFiles(selectedFiles) {
  for (const file of selectedFiles) {
    const extension = file.name.split(".").pop().toLowerCase();

    if (!["txt", "pdf"].includes(extension)) {
      showToast(`${file.name}: choose a PDF or TXT file.`);
      continue;
    }

    if (file.size > maxFileSize) {
      showToast(`${file.name}: files must be 15 MB or smaller.`);
      continue;
    }

    let text = null;

    if (extension === "txt") {
      try {
        text = await file.text();
      } catch {
        showToast(`Could not read ${file.name}.`);
        continue;
      }
    }

    const id = `${file.name}-${file.size}-${file.lastModified}`;

    if (files.has(id)) {
      showToast(`${file.name} is already in your library.`);
      continue;
    }

    files.set(id, {
      id,
      name: file.name,
      size: file.size,
      extension,
      text,
      blob: file,
    });
  }

  renderFiles();
}

function searchTextFiles(prompt) {
  const terms = prompt.toLowerCase().match(/[a-z0-9]{2,}/g) || [];
  const matches = [];

  for (const file of files.values()) {
    if (!file.text) continue;

    const paragraphs = file.text
      .split(/\n\s*\n/)
      .map((text) => text.trim())
      .filter(Boolean);

    for (const text of paragraphs) {
      const lowerText = text.toLowerCase();
      const score = terms.filter((term) => lowerText.includes(term)).length;

      if (score > 0) {
        matches.push({
          name: file.name,
          text,
          score: terms.length ? score / terms.length : 0,
        });
      }
    }
  }

  return matches;
}

async function searchPdfFile(file, prompt) {
  const body = new FormData();
  body.append("file", file.blob);
  body.append("question", prompt);

  const response = await fetch(API_URL, { method: "POST", body });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "The server could not read this PDF.");
  }

  return data.results.map((result) => ({
    name: file.name,
    text: result.text,
    score: result.score,
  }));
}

function renderAnswer(message, sources = []) {
  answer.replaceChildren();

  const result = document.createElement("div");
  result.className = "answer-result";

  const title = document.createElement("h3");
  title.textContent = "ANSWER";

  const response = document.createElement("p");
  response.textContent = message;

  result.append(title, response);

  sources.forEach((source, index) => {
    const sourceBox = document.createElement("div");
    sourceBox.className = "source";

    const sourceTitle = document.createElement("strong");
    sourceTitle.textContent = `SOURCE ${index + 1} · ${source.name}`;

    const excerpt = document.createElement("p");
    excerpt.textContent = source.text;

    sourceBox.append(sourceTitle, excerpt);
    result.append(sourceBox);
  });

  answer.append(result);
}

input.addEventListener("change", () => {
  addFiles([...input.files]);
  input.value = "";
});

for (const eventName of ["dragenter", "dragover"]) {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("dragging");
  });
}

dropzone.addEventListener("drop", (event) => {
  addFiles([...event.dataTransfer.files]);
});

document.querySelector("#clear-files").addEventListener("click", () => {
  files.clear();
  renderFiles();

  answer.innerHTML = `
    <div class="answer-empty">
      <span class="answer-icon">✳</span>
      <strong>Your answer will appear here</strong>
      <p>Add a document and ask a question. Matching passages will appear below.</p>
    </div>
  `;
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-question]");

  if (button) {
    question.value = button.dataset.question;
    question.focus();
  }
});

question.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    document.querySelector("#question-form").requestSubmit();
  }
});

document
  .querySelector("#question-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();

    const prompt = question.value.trim();

    if (!prompt) return;

    const askButton = document.querySelector("#ask-button");
    askButton.disabled = true;
    answer.textContent = "Searching your documents…";

    const matches = searchTextFiles(prompt);
    const errors = [];
    const pdfs = [...files.values()].filter((file) => file.extension === "pdf");

    const results = await Promise.allSettled(
      pdfs.map((file) => searchPdfFile(file, prompt)),
    );

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        matches.push(...result.value);
      } else {
        const reason =
          result.reason instanceof TypeError
            ? "could not reach the server. Is it running?"
            : result.reason.message;
        errors.push(`${pdfs[index].name}: ${reason}`);
      }
    });

    askButton.disabled = files.size === 0;

    const top = matches.sort((a, b) => b.score - a.score).slice(0, 3);

    if (top.length > 0) {
      const label = top.length === 1 ? "passage" : "passages";
      let message = `Found ${top.length} relevant ${label}. Review the excerpts below for the answer.`;

      if (errors.length) message += `\n\nNote: ${errors.join(" ")}`;

      renderAnswer(message, top);
      return;
    }

    if (errors.length) {
      renderAnswer(errors.join("\n"));
      return;
    }

    renderAnswer(
      "No matching passage found. Try using words that appear in your documents.",
    );
  });

updateUI();