FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
RUN chmod +x docker-entrypoint.sh \
    && useradd --create-home app \
    && chown -R app /app
USER app

EXPOSE 8000
ENTRYPOINT ["./docker-entrypoint.sh"]
# Procesos de gunicorn: WEB_CONCURRENCY (2 alcanza para un servidor chico)
ENV WEB_CONCURRENCY=2
CMD ["sh", "-c", "exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --timeout 60"]
