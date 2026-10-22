import io

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from pypdf import PdfReader

from .chunker import split_text
from .retriever import find_relevant_chunks


def read_pdf_pages(uploaded_file):
    """Return a list of {"page": n, "text": "..."} for every page."""
    reader = PdfReader(io.BytesIO(uploaded_file.read()))
    pages = []

    for page_number, page in enumerate(reader.pages, start=1):
        pages.append({
            "page": page_number,
            "text": (page.extract_text() or "").strip()
        })

    return pages


@csrf_exempt
def extract_pdf(request):
    if request.method != "POST":
        return JsonResponse(
            {"error": "Use POST to upload a PDF."},
            status=405
        )

    uploaded_file = request.FILES.get("file")

    if not uploaded_file:
        return JsonResponse(
            {"error": "Please upload a PDF using the 'file' field."},
            status=400
        )

    if not uploaded_file.name.lower().endswith(".pdf"):
        return JsonResponse(
            {"error": "Only PDF files are allowed."},
            status=400
        )

    try:
        pages = read_pdf_pages(uploaded_file)

        full_text = "\n".join(page["text"] for page in pages)

        if not full_text.strip():
            return JsonResponse(
                {
                    "error": (
                        "No selectable text found. "
                        "This may be a scanned PDF."
                    )
                },
                status=422
            )

        chunks = split_text(full_text)

        return JsonResponse({
            "filename": uploaded_file.name,
            "total_pages": len(pages),
            "total_chunks": len(chunks),
            "chunks": chunks,
            "text": full_text,
            "pages": pages
        })

    except Exception:
        return JsonResponse(
            {
                "error": (
                    "Could not read this PDF. "
                    "Please check the file."
                )
            },
            status=400
        )


@csrf_exempt
def ask_pdf(request):
    if request.method != "POST":
        return JsonResponse(
            {"error": "Use POST to upload a PDF and ask a question."},
            status=405
        )

    uploaded_file = request.FILES.get("file")
    question = request.POST.get("question", "").strip()

    if not uploaded_file:
        return JsonResponse(
            {"error": "Please upload a PDF using the 'file' field."},
            status=400
        )

    if not uploaded_file.name.lower().endswith(".pdf"):
        return JsonResponse(
            {"error": "Only PDF files are allowed."},
            status=400
        )

    if not question:
        return JsonResponse(
            {"error": "Please provide a question."},
            status=400
        )

    try:
        pages = read_pdf_pages(uploaded_file)

        full_text = "\n".join(page["text"] for page in pages)

        if not full_text.strip():
            return JsonResponse(
                {"error": "No selectable text found in this PDF."},
                status=422
            )

        matches = find_relevant_chunks(question, full_text)

        if matches:
            answer = "\n\n".join(
                match["text"] for match in matches
            )
        else:
            answer = (
                "No relevant passages found. "
                "Try different keywords."
            )

        return JsonResponse({
            "filename": uploaded_file.name,
            "question": question,
            "answer": answer,
            "total_matches": len(matches),
            "results": matches
        })

    except Exception:
        return JsonResponse(
            {"error": "Could not process the PDF."},
            status=400
        )