from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text
from datetime import datetime
from core import Base


class Image(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    original_name = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    processed = Column(Boolean, default=False)
    detected_objects = Column(Text)
    detected_count = Column(Integer, default=0)

    # S3 ключ файла (None для старых записей — используется локальный /uploads/)
    s3_key = Column(String, nullable=True)
