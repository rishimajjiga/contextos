"""
app/schemas/thread_event.py
Pydantic schemas for ThreadEvent.
"""
from datetime import datetime
from typing import List
from pydantic import BaseModel


class ThreadEventOut(BaseModel):
    id: str
    project_id: str
    user_id: str
    event_type: str
    title: str
    detail: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ThreadOut(BaseModel):
    events: List[ThreadEventOut]
    total: int
