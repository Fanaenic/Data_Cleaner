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

    class Config:
        from_attributes = True