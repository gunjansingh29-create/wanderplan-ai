#!/usr/bin/env bash
# =============================================================================
# WanderPlan AI — Disaster Recovery Restore Script
# RTO target: < 2 hours  |  RPO target: < 30 minutes
#
# Usage:
#   ./restore.sh                          # restore from latest backup
#   ./restore.sh /path/to/backup/dir      # restore from specific backup
#   ./restore.sh --component postgres     # restore only PostgreSQL
#   ./restore.sh --dry-run                # verify backup without restoring
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BACKUP_ROOT="${BACKUP_ROOT:-/opt/wanderplan/backups}"
COMPOSE_DIR="${COMPOSE_DIR:-/opt/wanderplan/infrastructure/production}"
COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.prod.yml"

# Parse arguments
BACKUP_DIR=""
COMPONENT="all"
DRY_RUN=false
for arg in "$@"; do
    case $arg in
        --component=*) COMPONENT="${arg#*=}" ;;
        --component) shift; COMPONENT="${2:-all}" ;;
        --dry-run) DRY_RUN=true ;;
        /*) BACKUP_DIR="$arg" ;;
    esac
done

# Find latest backup if not specified
if [ -z "${BACKUP_DIR}" ]; then
    BACKUP_DIR=$(find "${BACKUP_ROOT}" -maxdepth 4 -name "last_backup_status.json" \
        -exec dirname {} \; 2>/dev/null | head -1)
    if [ -z "${BACKUP_DIR}" ]; then
        # Fallback: find most recent backup directory
        BACKUP_DIR=$(find "${BACKUP_ROOT}" -maxdepth 4 -type d -name "postgres" \
            -exec dirname {} \; 2>/dev/null | sort -r | head -1)
    fi
fi

if [ -z "${BACKUP_DIR}" ] || [ ! -d "${BACKUP_DIR}" ]; then
    echo "ERROR: No backup found. Specify a backup directory."
    echo "Usage: $0 /path/to/backup/YYYYMMDD_HHMMSS"
    exit 1
fi

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [RESTORE] $*"; }
warn() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [RESTORE] WARNING: $*"; }
err() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [RESTORE] ERROR: $*" >&2; }

RESTORE_START=$(date +%s)
log "==========================================="
log "WanderPlan AI Disaster Recovery"
log "Backup source: ${BACKUP_DIR}"
log "Component: ${COMPONENT}"
log "Dry run: ${DRY_RUN}"
log "==========================================="

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
preflight() {
    log "Running pre-flight checks..."

    # Verify backup exists
    if [ ! -d "${BACKUP_DIR}" ]; then
        err "Backup directory does not exist: ${BACKUP_DIR}"
        exit 1
    fi

    # Check status file
    if [ -f "${BACKUP_DIR}/../last_backup_status.json" ]; then
        log "Backup status: $(cat "${BACKUP_DIR}/../last_backup_status.json" 2>/dev/null)"
    fi

    # Verify Docker is running
    docker info > /dev/null 2>&1 || { err "Docker is not running"; exit 1; }

    # Check available disk space
    local available=$(df -BG "${BACKUP_ROOT}" | tail -1 | awk '{print $4}' | sed 's/G//')
    local backup_size=$(du -sG "${BACKUP_DIR}" | cut -f1)
    log "Available disk: ${available}G, Backup size: ${backup_size}G"
    if [ "${available}" -lt "$((backup_size * 2))" ]; then
        warn "Low disk space. Restore may fail."
    fi

    log "Pre-flight checks passed"
}

# ---------------------------------------------------------------------------
# Phase 1: Stop services gracefully
# ---------------------------------------------------------------------------
stop_services() {
    if [ "${DRY_RUN}" = true ]; then
        log "[DRY RUN] Would stop all agent services"
        return
    fi

    log "Phase 1: Stopping agent services..."

    # Stop agents first (preserves data services)
    cd "${COMPOSE_DIR}"
    docker compose -f docker-compose.prod.yml stop \
        orchestrator bucket-list timing interest-profiler \
        health-accessibility poi-discovery duration-optimizer \
        availability budget flight accommodation dining \
        itinerary calendar group-coordinator \
        2>&1 || true

    log "Agent services stopped"
}

# ---------------------------------------------------------------------------
# Phase 2: Restore PostgreSQL
# ---------------------------------------------------------------------------
restore_postgres() {
    if [ "${COMPONENT}" != "all" ] && [ "${COMPONENT}" != "postgres" ]; then
        return
    fi

    local dump_file=$(find "${BACKUP_DIR}/postgres" -name "*.dump" | sort -r | head -1)
    if [ -z "${dump_file}" ]; then
        warn "No PostgreSQL dump found in backup"
        return
    fi

    log "Phase 2a: Restoring PostgreSQL from $(basename "${dump_file}")..."

    if [ "${DRY_RUN}" = true ]; then
        pg_restore --list "${dump_file}" > /dev/null 2>&1 \
            && log "[DRY RUN] PostgreSQL dump is valid" \
            || err "[DRY RUN] PostgreSQL dump is CORRUPT"
        return
    fi

    # Copy dump into container
    docker cp "${dump_file}" wanderplan-pg-primary:/tmp/restore.dump

    # Drop and recreate database
    docker exec wanderplan-pg-primary psql -U wanderplan -c \
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='wanderplan' AND pid <> pg_backend_pid();" \
        2>/dev/null || true

    docker exec wanderplan-pg-primary dropdb -U wanderplan --if-exists wanderplan
    docker exec wanderplan-pg-primary createdb -U wanderplan wanderplan

    # Restore
    docker exec wanderplan-pg-primary pg_restore \
        -U wanderplan \
        -d wanderplan \
        --no-owner \
        --no-privileges \
        --verbose \
        /tmp/restore.dump \
        2>&1

    docker exec wanderplan-pg-primary rm -f /tmp/restore.dump

    log "PostgreSQL restored successfully"
}

# ---------------------------------------------------------------------------
# Phase 3: Restore MongoDB
# ---------------------------------------------------------------------------
restore_mongodb() {
    if [ "${COMPONENT}" != "all" ] && [ "${COMPONENT}" != "mongodb" ]; then
        return
    fi

    local mongo_dir=$(find "${BACKUP_DIR}/mongodb" -type d -name "wanderplan" | head -1)
    if [ -z "${mongo_dir}" ]; then
        warn "No MongoDB dump found in backup"
        return
    fi

    log "Phase 2b: Restoring MongoDB..."

    if [ "${DRY_RUN}" = true ]; then
        log "[DRY RUN] MongoDB dump found at ${mongo_dir}"
        return
    fi

    docker cp "${mongo_dir}" wanderplan-mongo-primary:/tmp/mongorestore/

    docker exec wanderplan-mongo-primary mongorestore \
        --host="mongo-primary:27017" \
        --username="${MONGO_USER:-wanderplan}" \
        --password="${MONGO_PASSWORD}" \
        --authenticationDatabase=admin \
        --db=wanderplan \
        --drop \
        --gzip \
        /tmp/mongorestore/wanderplan/ \
        2>&1

    docker exec wanderplan-mongo-primary rm -rf /tmp/mongorestore

    log "MongoDB restored successfully"
}

# ---------------------------------------------------------------------------
# Phase 4: Restore Redis
# ---------------------------------------------------------------------------
restore_redis() {
    if [ "${COMPONENT}" != "all" ] && [ "${COMPONENT}" != "redis" ]; then
        return
    fi

    local rdb_file=$(find "${BACKUP_DIR}/redis" -name "*.rdb" | sort -r | head -1)
    if [ -z "${rdb_file}" ]; then
        warn "No Redis RDB dump found in backup"
        return
    fi

    log "Phase 2c: Restoring Redis from $(basename "${rdb_file}")..."

    if [ "${DRY_RUN}" = true ]; then
        log "[DRY RUN] Redis dump: $(du -sh "${rdb_file}" | cut -f1)"
        return
    fi

    # Stop Redis, replace dump, restart
    docker stop wanderplan-redis-master 2>/dev/null || true
    docker cp "${rdb_file}" wanderplan-redis-master:/bitnami/redis/data/dump.rdb 2>/dev/null \
        || docker cp "${rdb_file}" wanderplan-redis-master:/data/dump.rdb
    docker start wanderplan-redis-master

    # Wait for Redis to load
    sleep 5
    docker exec wanderplan-redis-master redis-cli -a "${REDIS_PASSWORD}" ping

    log "Redis restored successfully"
}

# ---------------------------------------------------------------------------
# Phase 5: Restore MinIO
# ---------------------------------------------------------------------------
restore_minio() {
    if [ "${COMPONENT}" != "all" ] && [ "${COMPONENT}" != "minio" ]; then
        return
    fi

    if [ ! -d "${BACKUP_DIR}/minio" ] || [ -z "$(ls -A "${BACKUP_DIR}/minio/" 2>/dev/null)" ]; then
        warn "No MinIO backup found"
        return
    fi

    log "Phase 2d: Restoring MinIO objects..."

    if [ "${DRY_RUN}" = true ]; then
        log "[DRY RUN] MinIO backup: $(du -sh "${BACKUP_DIR}/minio/" | cut -f1)"
        return
    fi

    docker run --rm --network wanderplan-private \
        -v "${BACKUP_DIR}/minio:/backup:ro" \
        minio/mc:latest \
        bash -c "
            mc alias set wanderplan ${MINIO_ENDPOINT:-http://minio:9000} \
                ${MINIO_ACCESS_KEY:-wanderplan} ${MINIO_SECRET_KEY:-wanderplan-secret-key} && \
            mc mirror --overwrite /backup/ wanderplan/ 2>&1
        " || warn "MinIO restore had errors"

    log "MinIO restored"
}

# ---------------------------------------------------------------------------
# Phase 6: Restart all services
# ---------------------------------------------------------------------------
restart_services() {
    if [ "${DRY_RUN}" = true ]; then
        log "[DRY RUN] Would restart all services"
        return
    fi

    log "Phase 3: Restarting all services..."

    cd "${COMPOSE_DIR}"
    docker compose -f docker-compose.prod.yml up -d 2>&1

    # Wait for health checks
    log "Waiting for services to become healthy..."
    sleep 30

    local healthy=0
    local total=15
    for i in $(seq 1 60); do
        healthy=$(docker ps --filter "name=wanderplan-" --filter "health=healthy" -q | wc -l)
        log "Health check: ${healthy}/${total} agents healthy (attempt ${i}/60)"
        if [ "${healthy}" -ge "${total}" ]; then
            break
        fi
        sleep 5
    done

    if [ "${healthy}" -lt "${total}" ]; then
        warn "Only ${healthy}/${total} agents are healthy after 5 minutes"
    fi
}

# ---------------------------------------------------------------------------
# Phase 7: Verification
# ---------------------------------------------------------------------------
verify_restore() {
    log "Phase 4: Verifying restore..."

    # Check PostgreSQL
    local pg_tables=$(docker exec wanderplan-pg-primary psql -U wanderplan -d wanderplan \
        -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" \
        2>/dev/null | tr -d ' ')
    log "  PostgreSQL tables: ${pg_tables:-unknown}"

    # Check MongoDB
    local mongo_collections=$(docker exec wanderplan-mongo-primary mongosh \
        --username wanderplan --password "${MONGO_PASSWORD}" --authenticationDatabase admin \
        --eval "db.getCollectionNames().length" wanderplan 2>/dev/null | tail -1)
    log "  MongoDB collections: ${mongo_collections:-unknown}"

    # Check Redis
    local redis_keys=$(docker exec wanderplan-redis-master redis-cli \
        -a "${REDIS_PASSWORD}" DBSIZE 2>/dev/null | awk '{print $2}')
    log "  Redis keys: ${redis_keys:-unknown}"

    RESTORE_END=$(date +%s)
    DURATION=$((RESTORE_END - RESTORE_START))
    log "==========================================="
    log "Restore completed in $((DURATION / 60)) minutes $((DURATION % 60)) seconds"
    log "RTO target: < 2 hours | Actual: $((DURATION / 60))m $((DURATION % 60))s"
    log "==========================================="
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
    preflight
    stop_services
    restore_postgres
    restore_mongodb
    restore_redis
    restore_minio
    restart_services
    verify_restore
}

main "$@"
