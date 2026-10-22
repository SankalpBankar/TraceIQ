from django.test import TestCase

from .chunker import split_text
from .retriever import find_relevant_chunks


class ChunkerTests(TestCase):
    def test_splits_long_text(self):
        chunks = split_text("Data structures organize data. " * 100)
        self.assertGreater(len(chunks), 1)

    def test_empty_text(self):
        self.assertEqual(split_text("   "), [])


class RetrieverTests(TestCase):
    def test_finds_matching_chunk(self):
        text = "Stacks are LIFO structures. " * 5
        results = find_relevant_chunks("What is a stack?", text)
        self.assertEqual(results, [])  # 'stack' != 'stacks' (exact-word match)
        results = find_relevant_chunks("What are stacks?", text)
        self.assertEqual(len(results), 1)
