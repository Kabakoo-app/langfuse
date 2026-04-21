#!/bin/bash

# Clear any dirty migrations (DELETE is synchronous unlike UPDATE)
docker exec langfuse-clickhouse-1 clickhouse-client --query "ALTER TABLE default.schema_migrations DELETE WHERE dirty = 1" 2>/dev/null
docker exec langfuse-clickhouse-1 clickhouse-client --query "OPTIMIZE TABLE default.schema_migrations FINAL" 2>/dev/null

# Switch any tables still on default policy to tiered (S3)
for table in traces observations scores event_log blob_storage_file_log dataset_run_items dataset_run_items_rmt project_environments schema_migrations; do
    docker exec langfuse-clickhouse-1 clickhouse-client --query "ALTER TABLE default.$table MODIFY SETTING storage_policy = 'tiered'" 2>/dev/null
done

echo "Done."
