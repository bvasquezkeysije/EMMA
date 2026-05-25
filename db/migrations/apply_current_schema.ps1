# Requiere PostgreSQL local con user/postgres y pass/postgres
$env:PGPASSWORD='postgres'
psql -h localhost -U postgres -d "emma-db" -f "db/migrations/0001_current_schema.sql"
