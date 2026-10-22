import re
from .chunker import split_text

STOP_WORDS = {
    "what", "is", "a", "an", "the", "of", "in", "on",
    "to", "for", "and", "or", "how", "why", "does",
    "do", "are", "was", "were", "explain", "define",
    "describe", "with", "about", "can", "you"
}


def tokenize(text):
    words = re.findall(r"\b[a-zA-Z0-9]+\b", text.lower())
    return [word for word in words if word not in STOP_WORDS]


def find_relevant_chunks(question, text, top_k=3):
    chunks = split_text(text)
    question_words = set(tokenize(question))

    if not question_words:
        return []

    scored_chunks = []

    for index, chunk in enumerate(chunks):
        chunk_words = set(tokenize(chunk))
        matched_words = question_words & chunk_words

        if matched_words:
            score = len(matched_words) / len(question_words)

            scored_chunks.append({
                "chunk_index": index,
                "score": round(score, 3),
                "matched_keywords": sorted(matched_words),
                "text": chunk
            })

    scored_chunks.sort(
        key=lambda item: (
            item["score"],
            len(item["matched_keywords"])
        ),
        reverse=True
    )

    return scored_chunks[:top_k]
