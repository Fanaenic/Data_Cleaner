# backend/run.py
import os
import sys

# Добавляем текущую директорию в PYTHONPATH
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

# Теперь импортируем и запускаем
if __name__ == "__main__":
    from main import app
    import uvicorn

    uvicorn.run(
        app=app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )