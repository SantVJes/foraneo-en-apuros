#!/bin/sh
set -e

echo "Esperando a PostgreSQL..."
python - <<'PY'
import os, time, psycopg
url = os.environ.get("DATABASE_URL")
for intento in range(30):
    try:
        if url:
            psycopg.connect(url).close()
            break
        psycopg.connect(
            dbname=os.environ.get("POSTGRES_DB", "cartwise"),
            user=os.environ.get("POSTGRES_USER", "cartwise"),
            password=os.environ.get("POSTGRES_PASSWORD", "cartwise"),
            host=os.environ.get("POSTGRES_HOST", "db"),
            port=os.environ.get("POSTGRES_PORT", "5432"),
        ).close()
        break
    except psycopg.OperationalError:
        time.sleep(1)
else:
    raise SystemExit("No se pudo conectar a PostgreSQL")
PY

python manage.py migrate --noinput
python manage.py collectstatic --noinput -v0
if [ "${CARGAR_DATOS_DEMO:-1}" = "1" ]; then
    python manage.py cargar_datos_demo
elif [ "${CARGAR_DATOS_DEMO:-1}" = "si_vacio" ]; then
    python manage.py cargar_datos_demo --si-vacio
fi
if [ "${IMPORTAR_RECETAS:-1}" = "1" ]; then
    # Recetas extra de TheMealDB; si no hay internet, la app sigue funcionando con las propias
    python manage.py importar_recetas --limite "${LIMITE_RECETAS:-40}" ${IMPORTAR_SI_VACIO:+--si-vacio} || echo "No se pudieron importar recetas de TheMealDB"
fi

exec "$@"
