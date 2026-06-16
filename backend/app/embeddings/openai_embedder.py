"""
app/embeddings/openai_embedder.py
MVP stub — embeddings removed. Keyword search is used instead.
Keep this file so imports don't break; upgrade to real embeddings in v2.
"""
from typing import List, Optional


async def embed_text(text: str) -> Optional[List[float]]:
    return None


async def embed_batch(texts: List[str]) -> List[Optional[List[float]]]:
    return [None] * len(texts)
