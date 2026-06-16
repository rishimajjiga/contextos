from datetime import datetime
from typing import List, Literal
from pydantic import BaseModel, Field

ProfileTone = Literal["professional", "casual", "concise", "detailed"]
ResponseStyle = Literal["technical", "conversational", "bullet-points", "narrative"]


class ProfileCreate(BaseModel):
    role: str = Field(..., min_length=1, max_length=255)
    skills: List[str] = Field(default_factory=list)
    tone: ProfileTone = "professional"
    response_style: ResponseStyle = "technical"
    programming_languages: List[str] = Field(default_factory=list)
    frameworks: List[str] = Field(default_factory=list)


class ProfileUpdate(BaseModel):
    role: str | None = Field(None, max_length=255)
    skills: List[str] | None = None
    tone: ProfileTone | None = None
    response_style: ResponseStyle | None = None
    programming_languages: List[str] | None = None
    frameworks: List[str] | None = None


class ProfileOut(BaseModel):
    id: str
    user_id: str
    role: str
    skills: List[str]
    tone: str
    response_style: str
    programming_languages: List[str]
    frameworks: List[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
