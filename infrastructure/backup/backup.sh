#!/usr/bin/env bash
# =============================================================================
# WanderPlan AI — Automated Backup Script
# Replaces AWS Backup, RDS Snapshots, and Cross-Region Replication
#
# Targets: PostgreSQL, MongoDB, Redis, MinIO, Kafka configs
# Schedule: Run via cron every 30 minutes (RPO < 30 min)
#
# Crontab entry:
#   */30 * * * * /opt/wanderplan/infrastructure/backup/backup.sh >> /var/log/wanderplan/backup.log 2>&1
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BACKUP_ROOT="${BACKUP_ROOT:-/opt/wanderplan/backups}"
REMOTE_BACKUP="${REMOTE_BACKUP:-}"                # rsync target: user@remote:/backups/
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_DIR=$(date +%Y/%m/%d)

# Database credentials (from .env)
PG_HOST="${PG_HOST:-postgres-primary}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-wanderplan}"
PG_DB="${PG_DB:-wanderplan}"
export PGPASSWORD="${POSTGRES_PASSWORD}"

MONGO_HOST="${MONGO_HOST:-mongo-primary}"
MONGO_PORT="${MONGO_PORT:-27017}"
MONGO_USER="${MONGO_USER:-wanderplan}"
export MONGO_PASSWORD="${MONGO_PASSWORD}"

REDIS_HOST="${REDIS_HOST:-redis-master}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASS="${REDIS_PASSWORD}"

MINIO_ALIAS="${MINIO_ALIAS:-wanderplan}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://minio:9000}"

# Create directory structure
BACKUP_DIR="${BACKUP_ROOT}/${DATE_DIR}/${TIMESTAMP}"
mkdir -p "${BACKUP_DIR}"/{postgres,mongodb,redis,minio,kafka,configs}

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# ---------------------------------------------------------------------------
# 1. PostgreSQL Backup (replaces RDS automated snapshots)
# ---------------------------------------------------------------------------
backup_postgres() {
    log "Starting PostgreSQL backup..."

    # Full logical dump with compression
    docker exec wanderplan-pg-primary pg_dump \
        -U "${PG_USER}" \
        -d "${PG_DB}" \
        --format=custom \
        --compress=9 \
        --verbose \
        --file="/tmp/wanderplan_${TIMESTAMP}.dump" \
        2>&1

    docker cp "wanderplan-pg-primary:/tmp/wanderplan_${TIMESTAMP}.dump" \
        "${BACKUP_DIR}/postgres/wanderplan_${TIMESTAMP}.dump"

    docker exec wanderplan-pg-primary rm -f "/tmp/wanderplan_${TIMESTAMP}.dump"

    # WAL archive for point-in-time recovery
    docker exec wanderplan-pg-primary pg_basebackup \
        -U "${PG_USER}" \
        -D "/tmp/pg_basebackup_${TIMESTAMP}" \
        --format=tar \
        --gzip \
        --checkpoint=fast \
        --wal-method=stream \
        2>&1 || log "WARNING: pg_basebackup failed (non-critical if logical dump succeeded)"

    if docker exec wanderplan-pg-primary test -d "/tmp/pg_basebackup_${TIMESTAMP}"; then
        docker cp "wanderplan-pg-primary:/tmp/pg_basebackup_${TIMESTAMP}" \
            "${BACKUP_DIR}/postgres/basebackup/"
        docker exec wanderplan-pg-primary rm -rf "/tmp/pg_basebackup_${TIMESTAMP}"
    fi

    # Verify backup integrity
    pg_restore --list "${BACKUP_DIR}/postgres/wanderplan_${TIMESTAMP}.dump" > /dev/null 2>&1 \
        && log "PostgreSQL backup verified OK" \
        || log "WARNING: PostgreSQL backup verification failed"

    local size=$(du -sh "${BACKUP_DIR}/postgres/" | cut -f1)
    log "PostgreSQL backup complete: ${size}"
}

# ---------------------------------------------------------------------------
# 2. MongoDB Backup (replaces DocumentDB snapshots)
# ---------------------------------------------------------------------------
backup_mongodb() {
    log "Starting MongoDB backup..."

    docker exec wanderplan-mongo-primary mongodump \
        --host="${MONGO_HOST}:${MONGO_PORT}" \
        --username="${MONGO_USER}" \
        --password="${MONGO_PASSWORD}" \
        --authenticationDatabase=admin \
        --db=wanderplan \
        --gzip \
        --out="/tmp/mongodump_${TIMESTAMP}" \
        2>&1

    docker cp "wanderplan-mongo-primary:/tmp/mongodump_${TIMESTAMP}" \
        "${BACKUP_DIR}/mongodb/"

    docker exec wanderplan-mongo-primary rm -rf "/tmp/mongodump_${TIMESTAMP}"

    local size=$(du -sh "${BACKUP_DIR}/mongodb/" | cut -f1)
    log "MongoDB backup complete: ${size}"
}

# ---------------------------------------------------------------------------
# 3. Redis Backup (replaces ElastiCache snapshots)
# ---------------------------------------------------------------------------
backup_redis() {
    log "Starting Redis backup..."

    # Trigger RDB snapshot
    docker exec wanderplan-redis-master redis-cli \
        -a "${REDIS_PASS}" \
        BGSAVE 2>&1

    # Wait for background save to complete
    sleep 5
    local retries=0
    while [ $retries -lt 30 ]; do
        local status=$(docker exec wanderplan-redis-master redis-cli \
            -a "${REDIS_PASS}" \
            LASTSAVE 2>/dev/null)
        sleep 2
        local new_status=$(docker exec wanderplan-redis-master redis-cli \
            -a "${REDIS_PASS}" \
            LASTSAVE 2>/dev/null)
        if [ "$status" != "$new_status" ] || [ $retries -gt 5 ]; then
            break
        fi
        retries=$((retries + 1))
    done

    # Copy RDB file
    docker cp wanderplan-redis-master:/bitnami/redis/data/dump.rdb \
        "${BACKUP_DIR}/redis/dump_${TIMESTAMP}.rdb" 2>/dev/null \
        || docker cp wanderplan-redis-master:/data/dump.rdb \
            "${BACKUP_DIR}/redis/dump_${TIMESTAMP}.rdb" 2>/dev/null \
        || log "WARNING: Could not copy Redis dump"

    # Also backup AOF if available
    docker cp wanderplan-redis-master:/bitnami/redis/data/appendonly.aof \
        "${BACKUP_DIR}/redis/appendonly_${TIMESTAMP}.aof" 2>/dev/null \
        || true

    local size=$(du -sh "${BACKUP_DIR}/redis/" 2>/dev/null | cut -f1)
    log "Redis backup complete: ${size:-0B}"
}

# ---------------------------------------------------------------------------
# 4. MinIO Backup (replaces S3 cross-region replication)
# ---------------------------------------------------------------------------
backup_minio() {
    log "Starting MinIO backup..."

    # Use mc (MinIO client) to mirror buckets
    docker run --rm --network wanderplan-private \
        -v "${BACKUP_DIR}/minio:/backup" \
        minio/mc:latest \
        bash -c "
            mc alias set ${MINIO_ALIAS} ${MINIO_ENDPOINT} \
                ${MINIO_ACCESS_KEY:-wanderplan} ${MINIO_SECRET_KEY:-wanderplan-secret-key} && \
            mc mirror --preserve ${MINIO_ALIAS}/ /backup/ 2>&1
        " || log "WARNING: MinIO backup had errors"

    local size=$(du -sh "${BACKUP_DIR}/minio/" 2>/dev/null | cut -f1)
    log "MinIO backup complete: ${size:-0B}"
}

# ---------------------------------------------------------------------------
# 5. Configuration Backup
# ---------------------------------------------------------------------------
backup_configs() {
    log "Starting configuration backup..."

    # Docker compose files
    cp -r /opt/wanderplan/infrastructure/production/ "${BACKUP_DIR}/configs/docker-compose/"
    cp -r /opt/wanderplan/infrastructure/traefik/ "${BACKUP_DIR}/configs/traefik/"
    cp -r /opt/wanderplan/infrastructure/monitoring/ "${BACKUP_DIR}/configs/monitoring/"

    # Environment file (encrypted)
    if [ -f /opt/wanderplan/.env ]; then
        openssl enc -aes-256-cbc -salt \
            -in /opt/wanderplan/.env \
            -out "${BACKUP_DIR}/configs/env.encrypted" \
            -pass env:BACKUP_ENCRYPTION_KEY 2>/dev/null \
            || cp /opt/wanderplan/.env "${BACKUP_DIR}/configs/.env.backup"
    fi

    # Kafka topic configurations
    docker exec wanderplan-kafka-1 kafka-topics \
        --bootstrap-server localhost:9092 \
        --describe 2>/dev/null \
        > "${BACKUP_DIR}/kafka/topic_configs.txt" || true

    log "Configuration backup complete"
}

# ---------------------------------------------------------------------------
# 6. Remote Sync (replaces cross-region replication)
# ---------------------------------------------------------------------------
sync_remote() {
    if [ -n "${REMOTE_BACKUP}" ]; then
        log "Syncing to remote backup location: ${REMOTE_BACKUP}"
        rsync -avz --progress \
            "${BACKUP_DIR}/" \
            "${REMOTE_BACKUP}/${DATE_DIR}/${TIMESTAMP}/" \
            2>&1
        log "Remote sync complete"
    else
        log "No remote backup target configured (REMOTE_BACKUP not set)"
    fi
}

# ---------------------------------------------------------------------------
# 7. Retention Cleanup (replaces S3 Lifecycle Policies)
# ---------------------------------------------------------------------------
cleanup_old_backups() {
    log "Cleaning up backups older than ${RETENTION_DAYS} days..."

    find "${BACKUP_ROOT}" -type f -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true
    find "${BACKUP_ROOT}" -type d -empty -delete 2>/dev/null || true

    local total_size=$(du -sh "${BACKUP_ROOT}" 2>/dev/null | cut -f1)
    log "Backup storage total: ${total_size:-unknown}"
}

# ---------------------------------------------------------------------------
# 8. Backup Verification & Reporting
# ---------------------------------------------------------------------------
verify_and_report() {
    log "=== Backup Summary ==="
    log "Timestamp: ${TIMESTAMP}"
    log "Location: ${BACKUP_DIR}"

    local total=$(du -sh "${BACKUP_DIR}" | cut -f1)
    log "Total size: ${total}"

    # Check each component
    local status="SUCCESS"
    [ -f "${BACKUP_DIR}/postgres/wanderplan_${TIMESTAMP}.dump" ] \
        && log "  ✓ PostgreSQL: OK" \
        || { log "  ✗ PostgreSQL: MISSING"; status="PARTIAL"; }

    [ -d "${BACKUP_DIR}/mongodb/" ] && [ "$(ls -A "${BACKUP_DIR}/mongodb/" 2>/dev/null)" ] \
        && log "  ✓ MongoDB: OK" \
        || { log "  ✗ MongoDB: MISSING"; status="PARTIAL"; }

    [ -f "${BACKUP_DIR}/redis/dump_${TIMESTAMP}.rdb" ] \
        && log "  ✓ Redis: OK" \
        || { log "  ✗ Redis: MISSING/SKIPPED"; }

    log "Overall status: ${status}"
    log "======================"

    # Write status file for monitoring
    echo "{\"timestamp\":\"${TIMESTAMP}\",\"status\":\"${status}\",\"size\":\"${total}\",\"path\":\"${BACKUP_DIR}\"}" \
        > "${BACKUP_ROOT}/last_backup_status.json"
}

# ---------------------------------------------------------------------------
# Main execution
# ---------------------------------------------------------------------------
main() {
    log "=========================================="
    log "WanderPlan AI Backup Starting"
    log "=========================================="

    backup_postgres
    backup_mongodb
    backup_redis
    backup_minio
    backup_configs
    sync_remote
    cleanup_old_backups
    verify_and_report

    log "Backup completed successfully"
}

main "$@"
