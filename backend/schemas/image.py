from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class ImageResponse(BaseModel):
    id: int
    filename: str
    original_name: str
    created_at: str
    url: str
    processed: bool = False
    detected_objects: Optional[List[Dict[str, Any]]] = None
    detected_count: int = 0
    s3_key: Optional[str] = None

    class Config:
        from_attributes = True


class PaginatedImageResponse(BaseModel):
    items: List[ImageResponse]
    total: int
    page: int
    limit: int
    pages: int
