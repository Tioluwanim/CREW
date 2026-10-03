FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 10000

CMD ["sh", "-c", "echo 'Running migrations...' && alembic upgrade head && echo 'Migrations complete.' && echo \"Starting API on port $PORT\" && uvicorn main:app --host 0.0.0.0 --port $PORT"]
