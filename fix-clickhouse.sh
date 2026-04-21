#!/bin/bash

# Fix dirty migrations: insert clean replacement rows with high sequence so they win deduplication
docker exec langfuse-clickhouse-1 clickhouse-client --query "INSERT INTO default.schema_migrations SELECT version, 0, 9000000000000000000 FROM default.schema_migrations WHERE dirty = 1" 2>/dev/null
docker exec langfuse-clickhouse-1 clickhouse-client --query "OPTIMIZE TABLE default.schema_migrations FINAL" 2>/dev/null

# Switch any tables still on default policy to tiered (S3)
for table in traces observations scores event_log blob_storage_file_log dataset_run_items dataset_run_items_rmt project_environments schema_migrations; do
    docker exec langfuse-clickhouse-1 clickhouse-client --query "ALTER TABLE default.$table MODIFY SETTING storage_policy = 'tiered'" 2>/dev/null
done

echo "Done."
