# TraceIQ

**AI-Powered Document Intelligence Assistant using RAG and Generative AI**

TraceIQ is a Django RAG application that chunks uploaded PDF/TXT files, retrieves the most relevant passages using Sentence Transformer embeddings and FAISS similarity search, and has Gemini generate cited, source-grounded answers. It abstains when the evidence is insufficient.

## Features

- Upload one or more PDF or TXT files (max 15 MB each)
- Page-aware text extraction and overlapping chunking
- Semantic retrieval with embeddings + FAISS
- Gemini answers grounded only in retrieved excerpts, with inline `[SOURCE n]` citations
- Source passages shown with filename, page number and similarity score
- "Not found" response when the documents don't contain the answer

## Tech Stack

Frontend: HTML, CSS, Bootstrap 5, JavaScript
Backend: Python, Django
PDF extraction: PyMuPDF
Embeddings: Sentence Transformers (all-MiniLM-L6-v2)
Vector search: FAISS (IndexFlatIP, cosine similarity)
Generative AI: Gemini API (gemini-2.5-flash by default)

## Project Structure

```
TraceIQ/
├── backend/
│   ├── manage.py
│   ├── config/            settings, urls
│   └── documents/         views, chunker, rag pipeline, tests
├── frontend/              index.html (Django template), app.js, styles.css
├── requirements.txt
├── .env.example
└── README.md
```

Django serves the frontend at `/` and the API at `/api/`, so everything runs from one server.

## Setup (PowerShell, from the project root)

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `.env` and set your own key (never commit this file):

```
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
```

## Run

```powershell
cd backend
python manage.py migrate
python manage.py runserver
```

Open http://127.0.0.1:8000/

The first question downloads the embedding model, so an internet connection is required. Bootstrap is loaded from a CDN.

## How It Works

1. The user uploads PDF/TXT files.
2. PyMuPDF extracts text page by page, so page numbers are preserved.
3. Text is split into overlapping, paragraph-aware chunks (180 words, 35 overlap).
4. Chunks and the question are embedded with `all-MiniLM-L6-v2` (normalized vectors).
5. FAISS ranks chunks by similarity and returns the top 5.
6. If the best score is below the relevance threshold, the app reports that no evidence was found.
7. Otherwise Gemini receives only the retrieved excerpts and the question, and answers with citations.
8. The UI shows the answer plus the supporting source passages.

## API

| Endpoint | Method | Fields | Returns |
|---|---|---|---|
| `/api/ask/` | POST | `question`, `files` (one or more) | `answer`, `results` (source, page, chunk_index, score, text), `total_chunks` |
| `/api/extract/` | POST | `files` | `total_chunks`, `chunks` (debug/demo) |

## Tests

```powershell
cd backend
python manage.py test documents
```

## Troubleshooting

- **"The server could not answer this question"**: the browser received a non-JSON response. Check the Django terminal for the real error and hard-refresh (Ctrl+Shift+R) to load the latest `app.js`.
- **"Gemini API key is not configured"**: set `GEMINI_API_KEY` in the root `.env` and restart the server.
- **Quota or rate-limit message**: wait a minute and retry, or check your Gemini plan.

## Limitations

- Documents are re-processed for every question and not persistently indexed.
- Scanned PDFs need OCR, which is not supported.
- Similarity does not guarantee factual support. The prompt instructs Gemini to abstain, but this is not a hard guarantee.
- Retrieved excerpts are sent to the Gemini API. Do not upload confidential documents unless permitted.
TraceIQ is an AI-powered document intelligence assistant that uses RAG to deliver evidence-backed answers, traceable citations, and actionable insights from uploaded documents.
