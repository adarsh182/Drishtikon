"""Test script to validate multilingual sentence embeddings and semantic similarity."""

import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.services.embedding_service import _load_model, generate_embedding, cosine_similarity, find_similar

def test_embeddings():
    print("=" * 80)
    print("MULTILINGUAL EMBEDDINGS & SEMANTIC SIMILARITY BENCHMARK")
    print(f"Embedding Model: {settings.embedding_model}")
    print("=" * 80)

    print("\n[1/3] Loading Sentence Transformers Model...")
    t0 = time.perf_counter()
    model = _load_model()
    load_time = time.perf_counter() - t0
    print(f"  ✓ Model loaded in {load_time:.2f}s")

    # Multilingual Semantic Equivalence Test (Cross-lingual pairs with same semantic meaning)
    pairs = [
        (
            "English: The compliance requirements are excessive and create paperwork burden.",
            "The compliance requirements are excessive and create paperwork burden.",
            "Hindi: मासिक रिपोर्टिंग की अनिवार्यता बहुत अधिक कागजी काम और प्रशासनिक बोझ बढ़ाती है।",
            "मासिक रिपोर्टिंग की अनिवार्यता बहुत अधिक कागजी काम और प्रशासनिक बोझ बढ़ाती है।"
        ),
        (
            "English: The penalty structure is excessively harsh for minor administrative violations.",
            "The penalty structure is excessively harsh for minor administrative violations.",
            "Gujarati: દંડની જોગवाઈઓ ખૂબ કડક છે અને સામાન્ય ભૂલો માટે આટલો મોટો દંડ અયોગ્ય છે.",
            "દંડની જોગવાઈઓ ખૂબ કડક છે અને સામાન્ય ભૂલો માટે આટલો મોટો દંડ અયોગ્ય છે."
        ),
        (
            "English: We welcome the improved transparency and governance standards.",
            "We welcome the improved transparency and governance standards.",
            "Bengali: প্রস্তাবিত সংশোধনী করপোরেট সুশাসন উন্নত করতে সাহায্য করবে, আমরা সমর্থন করি।",
            "প্রস্তাবিত সংশোধনী করপোরেট সুশাসন উন্নত করতে সাহায্য করবে, আমরা সমর্থন করি।"
        ),
        (
            "English: The fine is too high.",
            "The fine is too high.",
            "Different topic: We need more time to submit our financial audit report.",
            "We need more time to submit our financial audit report."
        )
    ]

    print("\n[2/3] Evaluating Cross-Lingual Semantic Similarity...")
    print("-" * 80)
    for title_a, text_a, title_b, text_b in pairs:
        t_start = time.perf_counter()
        emb_a = generate_embedding(text_a)
        emb_b = generate_embedding(text_b)
        sim = cosine_similarity(emb_a, emb_b)
        t_elapsed_ms = (time.perf_counter() - t_start) * 1000.0

        print(f"Text A: {title_a}")
        print(f"Text B: {title_b}")
        print(f"  -> Cosine Similarity: {sim:.4f} ({sim*100:.1f}%) | Time: {t_elapsed_ms:.1f}ms")
        print("-" * 80)

    print("\n[3/3] Embedding Benchmark Complete.")
    print("=" * 80)

if __name__ == "__main__":
    test_embeddings()
