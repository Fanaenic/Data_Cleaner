import logging
import os
from typing import Optional

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from core import S3_ENDPOINT, S3_PUBLIC_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET

logger = logging.getLogger(__name__)

PRESIGNED_URL_EXPIRE = 3600  # 1 час

# Допустимые типы файлов и максимальный размер
ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/gif",
    "image/webp", "image/bmp", "image/tiff"
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 МБ


class StorageService:
    """Сервис для работы с S3-совместимым объектным хранилищем (MinIO)."""

    _internal_client: Optional[boto3.client] = None
    _public_client: Optional[boto3.client] = None

    @classmethod
    def _get_internal_client(cls):
        """Клиент для внутренних операций (upload, delete) через Docker-сеть."""
        if cls._internal_client is None:
            cls._internal_client = boto3.client(
                "s3",
                endpoint_url=S3_ENDPOINT,
                aws_access_key_id=S3_ACCESS_KEY,
                aws_secret_access_key=S3_SECRET_KEY,
                region_name="us-east-1",
                config=Config(
                    signature_version="s3v4",
                    s3={"addressing_style": "path"},  # MinIO требует path-style
                ),
            )
        return cls._internal_client

    @classmethod
    def _get_public_client(cls):
        """Клиент для генерации pre-signed URL с публичным endpoint (доступен из браузера)."""
        if cls._public_client is None:
            cls._public_client = boto3.client(
                "s3",
                endpoint_url=S3_PUBLIC_ENDPOINT,
                aws_access_key_id=S3_ACCESS_KEY,
                aws_secret_access_key=S3_SECRET_KEY,
                region_name="us-east-1",
                config=Config(
                    signature_version="s3v4",
                    s3={"addressing_style": "path"},  # MinIO требует path-style
                ),
            )
        return cls._public_client

    @classmethod
    def ensure_bucket(cls) -> None:
        """Создаёт бакет, если он не существует."""
        client = cls._get_internal_client()
        try:
            client.head_bucket(Bucket=S3_BUCKET)
        except ClientError as e:
            code = e.response["Error"]["Code"]
            if code in ("404", "NoSuchBucket", "NoSuchBucketPolicy"):
                client.create_bucket(Bucket=S3_BUCKET)
                logger.info(f"Создан S3 бакет: {S3_BUCKET}")
            else:
                logger.error(f"Ошибка проверки бакета (code={code}): {e}")
                raise
        except Exception as e:
            logger.error(f"Не удалось подключиться к S3 ({S3_ENDPOINT}): {e}")
            # Сбрасываем кеш клиента чтобы пересоздать при следующем вызове
            cls._internal_client = None
            raise

    @classmethod
    def upload_file(cls, local_path: str, s3_key: str, content_type: str = "image/jpeg") -> str:
        """
        Загружает локальный файл в S3.
        Возвращает s3_key.
        """
        cls.ensure_bucket()
        client = cls._get_internal_client()
        client.upload_file(
            local_path,
            S3_BUCKET,
            s3_key,
            ExtraArgs={"ContentType": content_type},
        )
        logger.info(f"Файл загружен в S3: {s3_key}")
        return s3_key

    @classmethod
    def get_presigned_url(cls, s3_key: str, expire: int = PRESIGNED_URL_EXPIRE) -> str:
        """
        Генерирует временный URL для скачивания файла из S3.
        URL доступен через публичный endpoint (localhost:9000).
        """
        client = cls._get_public_client()
        url = client.generate_presigned_url(
            "get_object",
            Params={"Bucket": S3_BUCKET, "Key": s3_key},
            ExpiresIn=expire,
        )
        return url

    @classmethod
    def delete_file(cls, s3_key: str) -> None:
        """Удаляет файл из S3."""
        client = cls._get_internal_client()
        try:
            client.delete_object(Bucket=S3_BUCKET, Key=s3_key)
            logger.info(f"Файл удалён из S3: {s3_key}")
        except ClientError as e:
            logger.error(f"Ошибка удаления файла из S3 ({s3_key}): {e}")

    @classmethod
    def is_available(cls) -> bool:
        """Проверяет доступность S3 хранилища."""
        try:
            cls._get_internal_client().list_buckets()
            return True
        except Exception:
            return False
