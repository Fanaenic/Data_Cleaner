# backend/schemas/image.py
from pydantic import BaseModel

class ImageResponse(BaseModel):
    id: int
    filename: str
    original_name: str
    created_at: str

    class Config:
        from_attributes = True