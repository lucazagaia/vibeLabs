FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py models.py search.py red_flags.py research_graph.py ./

# Credentials must be provided at runtime via -e / --env-file.
# Never bake NEBIUS_API_KEY or TAVILY_API_KEY into the image.
CMD ["python", "app.py"]
