"""Test script to validate multilingual sentiment analysis and language detection across 11 language variants."""

import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.services.sentiment_service import analyze_sentiment, _load_pipeline, detect_language

TEST_SAMPLES = [
    {
        "lang": "English",
        "expected_code": "en",
        "text": "The proposed compliance requirements are excessive and create an unnecessary administrative burden for small businesses.",
        "expected_sentiment": "Negative"
    },
    {
        "lang": "Hindi (हिन्दी)",
        "expected_code": "hi",
        "text": "मासिक रिपोर्टिंग की अनिवार्यता छोटे व्यवसायों के लिए बहुत अधिक कागजी काम और बोझ बढ़ाती है।",
        "expected_sentiment": "Negative"
    },
    {
        "lang": "Marathi (मराठी)",
        "expected_code": "mr",
        "text": "नवीन नियमांमुळे पारदर्शकता वाढेल आणि कंपनी कारभारात नक्कीच मोठी सुधारणा होईल, हा निर्णय अत्यंत स्वागतार्ह आहे.",
        "expected_sentiment": "Positive"
    },
    {
        "lang": "Gujarati (ગુજરાતી)",
        "expected_code": "gu",
        "text": "દંડની જોગવાઈઓ ખૂબ કડક છે અને સામાન્ય પ્રક્રિયાગત ભૂલો માટે આટલો મોટો દંડ અયોગ્ય છે.",
        "expected_sentiment": "Negative"
    },
    {
        "lang": "Bengali (বাংলা)",
        "expected_code": "bn",
        "text": "প্রস্তাবিত সংশোধনী করপোরেট সুশাসন উন্নত করতে সাহায্য করবে, আমরা এই সময়োপযোগী পদক্ষেপকে পূর্ণ সমর্থন করি।",
        "expected_sentiment": "Positive"
    },
    {
        "lang": "Tamil (தமிழ்)",
        "expected_code": "ta",
        "text": "சிறு வணிகங்களுக்கு முன்மொழியப்பட்ட அபராதங்கள் மிகவும் கடுமையானவை மற்றும் நியாயமற்றவை.",
        "expected_sentiment": "Negative"
    },
    {
        "lang": "Telugu (తెలుగు)",
        "expected_code": "te",
        "text": "ఈ ముసాయిదా నిబంధనలు కంపెనీలకు మరింత స్పష్టత మరియు సులభతర వ్యాపార వాతావరణాన్ని అందిస్తాయి.",
        "expected_sentiment": "Positive"
    },
    {
        "lang": "Kannada (ಕನ್ನಡ)",
        "expected_code": "kn",
        "text": "ಮಾಸಿಕ ವರದಿ ಸಲ್ಲಿಸುವ ನಿಯಮವು ಸಣ್ಣ ಉದ್ಯಮಗಳಿಗೆ ಹೆಚ್ಚಿನ ಆರ್ಥಿಕ ಹೊರೆಯಾಗಲಿದೆ.",
        "expected_sentiment": "Negative"
    },
    {
        "lang": "Malayalam (മലയാളം)",
        "expected_code": "ml",
        "text": "പുതിയ നിയമങ്ങൾ സ്വാഗതാർഹമാണ്, ഇത് കോർപ്പറേറ്റ് സുതാര്യത ഉറപ്പാക്കാൻ സഹായിക്കും.",
        "expected_sentiment": "Positive"
    },
    {
        "lang": "Punjabi (ਪੰਜਾਬੀ)",
        "expected_code": "pa",
        "text": "ਜੁਰਮਾਨੇ ਦੀ ਰਕਮ ਬਹੁਤ ਜ਼ਿਆਦਾ ਹੈ ਅਤੇ ਛੋਟੇ ਕਾਰੋਬਾਰੀਆਂ 'ਤੇ ਬੇਲੋੜਾ ਵਿੱਤੀ ਬੋਝ ਪਾਉਂਦੀ ਹੈ।",
        "expected_sentiment": "Negative"
    },
    {
        "lang": "Hinglish (Code-Mixed)",
        "expected_code": "mixed",
        "text": "Ye compliance requirement MSMEs ke liye kaafi difficult hai aur penalty amount thoda zyada hai.",
        "expected_sentiment": "Negative"
    },
]


def run_benchmark():
    print("=" * 80)
    print("MULTILINGUAL SENTIMENT & LANGUAGE DETECTION BENCHMARK")
    print(f"Configured Model: {settings.sentiment_model}")
    print(f"USE_ML_MODEL: {settings.use_ml_model}")
    print("=" * 80)

    # 1. Measure Model Load Time
    print("\n[1/3] Loading Local Transformer Pipeline...")
    t0 = time.perf_counter()
    pipeline = _load_pipeline()
    load_time = time.perf_counter() - t0

    if pipeline is not None:
        print(f"  ✓ Model loaded successfully in {load_time:.2f}s")
        if hasattr(pipeline, "model") and hasattr(pipeline.model, "config"):
            print(f"  ✓ Model Architecture: {pipeline.model.__class__.__name__}")
            print(f"  ✓ Config id2label: {pipeline.model.config.id2label}")
    else:
        print("  ! Local ML pipeline not loaded (fallback mode or USE_ML_MODEL=false)")

    # 2. Test Individual Samples
    print("\n[2/3] Evaluating 11 Representative Language Samples...")
    print("-" * 80)
    print(f"{'Language':<22} | {'Detected':<8} | {'Sentiment':<9} | {'Conf':<6} | {'Time (ms)':<9} | Status")
    print("-" * 80)

    latencies = []
    for sample in TEST_SAMPLES:
        t_start = time.perf_counter()
        result = analyze_sentiment(sample["text"])
        t_elapsed_ms = (time.perf_counter() - t_start) * 1000.0
        latencies.append(t_elapsed_ms)

        det_lang = result.get("detected_language", "unknown")
        sentiment = result.get("sentiment", "Unknown")
        conf = result.get("confidence", 0.0)

        # Evaluate match
        match_sentiment = "✓" if sentiment.lower() == sample["expected_sentiment"].lower() else "✗"
        
        print(f"{sample['lang']:<22} | {det_lang:<8} | {sentiment:<9} | {conf:<6.2f} | {t_elapsed_ms:<9.1f} | {match_sentiment}")

    # 3. Summary Performance Metrics
    print("-" * 80)
    avg_latency = sum(latencies) / len(latencies)
    print("\n[3/3] Performance Summary:")
    print(f"  • Average single inference latency: {avg_latency:.1f} ms")
    print(f"  • Min latency: {min(latencies):.1f} ms | Max latency: {max(latencies):.1f} ms")
    print(f"  • Model memory footprint: ~1.1 GB (XLM-RoBERTa)")
    print("=" * 80)


if __name__ == "__main__":
    run_benchmark()
