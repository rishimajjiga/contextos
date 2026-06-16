from datetime import datetime
from typing import List
from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str = ""
    stack: List[str] = Field(default_factory=list)
    goals: str = ""
    architecture: str = ""
    coding_style: str = ""
    active_tasks: List[str] = Field(default_factory=list)
    current_problems: List[str] = Field(default_factory=list)


class ProjectUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    description: str | None = None
    stack: List[str] | None = None
    goals: str | None = None
    architecture: str | None = None
    coding_style: str | None = None
    active_tasks: List[str] | None = None
    current_problems: List[str] | None = None


class ProjectOut(BaseModel):
    id: str
    user_id: str
    name: str
    description: str
    stack: List[str]
    goals: str
    architecture: str
    coding_style: str
    active_tasks: List[str]
    current_problems: List[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedProjects(BaseModel):
    items: List[ProjectOut]
    total: int
    page: int
    per_page: int
    has_next: bool
