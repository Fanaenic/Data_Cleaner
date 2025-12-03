import cv2
import numpy as np
import logging
from pathlib import Path
from typing import List, Dict, Tuple
import os

logger = logging.getLogger(__name__)


class AIService:
    """AI сервис для обработки изображений"""

    def __init__(self):
        logger.info("🚀 Инициализация AI сервиса...")
        self.load_models()

    def load_models(self):
        """Загрузка моделей для детекции"""
        try:
            # Загружаем каскад для лиц
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            self.face_cascade = cv2.CascadeClassifier(cascade_path)

            logger.info("✅ Загружены каскады для лиц")
            self.plate_cascade = None

        except Exception as e:
            logger.error(f"❌ Ошибка загрузки моделей: {e}")
            self.face_cascade = None
            self.plate_cascade = None

    def detect_objects(self, image_np: np.ndarray) -> List[Dict]:
        """Обнаружение объектов на изображении"""
        objects = []

        if self.face_cascade is not None:
            # Детекция лиц
            gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY)
            faces = self.face_cascade.detectMultiScale(gray, 1.3, 5)

            for (x, y, w, h) in faces:
                # Конвертируем numpy.int64 в int
                x_int, y_int, w_int, h_int = int(x), int(y), int(w), int(h)
                objects.append({
                    'class': 'face',
                    'confidence': 0.9,
                    'bbox': [x_int, y_int, x_int + w_int, y_int + h_int]
                })
                logger.debug(f"Обнаружено лицо: {x_int},{y_int},{w_int},{h_int}")

        return objects

    def apply_blur(self, image_np: np.ndarray, objects: List[Dict]) -> np.ndarray:
        """Применение размытия к обнаруженным областям"""
        if not objects:
            return image_np

        processed = image_np.copy()

        for obj in objects:
            x1, y1, x2, y2 = obj['bbox']
            class_name = obj['class']

            # Корректируем границы
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(processed.shape[1], x2), min(processed.shape[0], y2)

            if x2 <= x1 or y2 <= y1:
                continue

            roi = processed[y1:y2, x1:x2]
            if roi.size == 0:
                continue

            # Определяем параметры размытия
            if class_name == 'face':
                kernel_size = (99, 99)
                sigma = 40
            elif class_name == 'license_plate':
                kernel_size = (111, 111)
                sigma = 50
            else:
                kernel_size = (75, 75)
                sigma = 30

            # Гауссово размытие
            blurred = cv2.GaussianBlur(roi, kernel_size, sigma)
            processed[y1:y2, x1:x2] = blurred

            logger.debug(f"Размыт {class_name}: {x1},{y1} - {x2},{y2}")

        return processed

    def process_image(self, image_path: str, method: str = "blur") -> Tuple[str, List[Dict]]:
        """
        Основная функция обработки изображения
        """
        try:
            # Чтение изображения
            if not os.path.exists(image_path):
                raise FileNotFoundError(f"Файл не найден: {image_path}")

            image_np = cv2.imread(image_path)
            if image_np is None:
                # Если OpenCV не смог, пробуем через PIL
                try:
                    from PIL import Image
                    pil_img = Image.open(image_path).convert('RGB')
                    image_np = np.array(pil_img)
                    image_np = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
                except Exception as e:
                    raise ValueError(f"Не удалось прочитать изображение: {e}")

            logger.info(f"📷 Загружено изображение: {image_path}, размер: {image_np.shape}")

            # Детекция объектов
            objects = self.detect_objects(image_np)
            logger.info(f"🎯 Обнаружено объектов: {len(objects)}")

            # Применение обработки
            if method == "blur" and objects:
                logger.info("🔍 Применяю размытие...")
                processed_image = self.apply_blur(image_np, objects)
            else:
                processed_image = image_np

            # Сохранение результата
            original_path = Path(image_path)
            output_filename = f"processed_{original_path.name}"
            output_path = original_path.parent / output_filename

            success = cv2.imwrite(str(output_path), processed_image)
            if not success:
                raise IOError(f"Не удалось сохранить обработанное изображение: {output_path}")

            logger.info(f"💾 Сохранено: {output_path}")

            return str(output_path), objects

        except Exception as e:
            logger.error(f"❌ Ошибка обработки изображения: {e}", exc_info=True)
            return image_path, []


# Глобальный экземпляр
ai_service = AIService()