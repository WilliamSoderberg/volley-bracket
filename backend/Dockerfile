FROM python:3.14-alpine

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV PORT=8080
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/data
EXPOSE $PORT

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]