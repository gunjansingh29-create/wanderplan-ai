# WanderPlan AI — Self-Hosted Production Deployment

## AWS → Self-Hosted Service Mapping

Every AWS service in the original specification has been replaced with an open-source equivalent
that runs entirely on your local machine via Docker Compose.

```
┌──────────────────────────────┬──────────────────────────────────┬─────────────────────────────┐
│       AWS SERVICE            │      SELF-HOSTED REPLACEMENT     │       CONFIGURATION FILE    │
├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────┤
│ VPC + Public/Private Subnets │ Docker bridge networks           │ docker-compose.prod.yml     │
│                              │   wanderplan-public  (external)  │   networks: section         │
│                              │   wanderplan-private (internal)  │                             │
├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────┤
│ ALB (Application LB)        │ Traefik v3.1 reverse proxy       │ traefik/dynamic/            │
│ + AWS WAF                   │   rate limiting, CORS, TLS,      │   middlewares.yml           │
│ + ACM Certificates          │   Let's Encrypt auto-certs       │                             │
├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────┤
│ ECS Fargate (15 tasks)      │ Docker containers with           │ docker-compose.prod.yml     │
│ + Auto-scaling policies     │   resource limits + autoscaler   │ scripts/autoscaler.py       │
│                              │   CPU/mem/queue-depth scaling    │                             │
├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────┤
│ Amazon MSK (3 brokers)      │ Confluent Kafka 7.6              │ docker-compose.prod.yml     │
│                              │   3 brokers + KRaft controller   │   kafka-1, kafka-2, kafka-3 │
│                              │   RF=3, min.ISR=2, 12 partitions│                             │
├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────┤
│ RDS PostgreSQL Multi-AZ     │ Bitnami PostgreSQL 16            │ docker-compose.prod.yml     │
│ + Read Replica              │   primary + streaming replica    │   postgres-primary/replica  │
│                              │   WAL-level=replica              │                             │
├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────┤
│ Amazon DocumentDB           │ MongoDB 7 Replica Set            │ docker-compose.prod.yml     │
│                              │   primary + secondary + keyfile  │   mongo-primary/secondary   │
├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────┤
│ ElastiCache Redis (3 nodes) │ Bitnami Redis 7.2 + Sentinel     │ docker-compose.prod.yml     │
│                              │   1 master + 2 replicas          │   redis-master, replicas,   │
│                              │   3 Sentinel nodes (quorum=2)    │   sentinel-1/2/3            │
├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────┤
│ AWS OpenSearch              │ OpenSearch 2.13 (2-node cluster) │ docker-compose.prod.yml     │
│                              │   + OpenSearch Dashboards         │   opensearch-node1/node2    │
├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────┤
│ S3 + CloudFront             │ MinIO (S3-compatible) +           │ docker-compose.prod.yml     │
│                              │   Nginx caching proxy (CDN)      │ traefik/cdn-cache.conf      │
│                              │   5 buckets, lifecycle policies   │                             │
├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────┤
│ AWS Bedrock                 │ Direct Anthropic API +            │ docker-compose.prod.yml     │
│ (LLM inference)            │   Ollama local fallback           │   ollama service            │
│                              │   (llama3.1:8b for offline)      │                             │
├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────┤
│ CloudWatch Metrics          │ Prometheus v2.51                  │ monitoring/prometheus/       │
│ + Dashboards                │ + Grafana 10.4                   │ monitoring/grafana/          │
│                              │   15-agent dashboard, infra      │   dashboards/               │
├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────┤
│ AWS X-Ray                   │ Jaeger 1.56 (all-in-one)         │ docker-compose.prod.yml     │
│ (Distributed tracing)      │   OTLP + Badger persistent store │   jaeger service            │
├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────┤
│ CloudWatch Alarms           │ Alertmanager v0.27               │ monitoring/alertmanager/     │
│ + PagerDuty                 │   Slack + PagerDuty webhooks     │   alertmanager.yml          │
│                              │   60+ alert rules                │ prometheus/rules/           │
├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────┤
│ EC2 metrics                 │ Node Exporter + cAdvisor          │ docker-compose.prod.yml     │
│ + Container Insights        │   host + container metrics        │                             │
├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────┤
│ CodePipeline / CodeDeploy   │ GitHub Actions                   │ .github/workflows/          │
│ (CI/CD)                     │   CI: lint, test, build, scan    │   ci.yml, deploy.yml        │
│                              │   CD: blue-green + canary        │                             │
├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────┤
│ Terraform IaC               │ Bash IaC setup script             │ scripts/setup.sh            │
│                              │   Idempotent, 10-phase setup     │                             │
├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────┤
│ AWS Backup                  │ Automated backup script           │ backup/backup.sh            │
│ + Cross-Region Replication  │   cron every 30min (RPO <30min)  │ backup/restore.sh           │
│                              │   rsync remote sync, 30-day      │                             │
│                              │   retention, encrypted configs    │                             │
├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────┤
│ Spot Instances              │ Container resource limits with    │ docker-compose.prod.yml     │
│ + Reserved Instances        │   cpu/memory reservations and     │   deploy.resources section  │
│ + S3 Lifecycle              │   autoscaler scheduling           │   + MinIO lifecycle rules   │
└──────────────────────────────┴──────────────────────────────────┴─────────────────────────────┘
```

---

## Production Architecture Diagram

```
                            ┌─────────────────────────────────┐
                            │          INTERNET / LAN          │
                            └───────────────┬─────────────────┘
                                            │ :80 / :443
        ════════════════════════════════════╤════════════════════════════════════
        ║          wanderplan-public network (172.20.0.0/24)                   ║
        ║          [Externally accessible — replaces VPC public subnet]        ║
        ════════════════════════════════════╤════════════════════════════════════
                                            │
                    ┌───────────────────────▼──────────────────────────┐
                    │              TRAEFIK v3.1                         │
                    │         [Replaces ALB + WAF + ACM]               │
                    │                                                  │
                    │  • TLS termination (Let's Encrypt auto-certs)    │
                    │  • Rate limiting: 60 req/min per IP              │
                    │  • JWT validation on /api/* routes               │
                    │  • CORS, security headers, gzip compression      │
                    │  • Circuit breaker (p50 > 5s or 30% errors)      │
                    │  • WebSocket upgrade for /ws/* routes             │
                    │  • Prometheus metrics export (:8082)              │
                    │  • OTLP tracing to Jaeger                        │
                    │                                                  │
                    │  Routes:                                         │
                    │    api.domain/*     → orchestrator:8000 (×2)     │
                    │    cdn.domain/*     → nginx-cache:80             │
                    │    grafana.domain   → grafana:3000               │
                    │    tracing.domain   → jaeger:16686               │
                    │    kafka.domain     → kafka-ui:8080              │
                    │    storage.domain   → minio-console:9001         │
                    └───────────────────────┬──────────────────────────┘
                                            │
        ════════════════════════════════════╤════════════════════════════════════
        ║      wanderplan-private network (172.20.1.0/24, INTERNAL ONLY)       ║
        ║      [Replaces VPC private subnets across 3 AZs]                     ║
        ════════════════════════════════════╤════════════════════════════════════
                                            │
         ┌──────────────────────────────────┼──────────────────────────────────┐
         │                    AGENT COMPUTE LAYER                              │
         │              [Replaces ECS Fargate + Auto-Scaling]                  │
         │                                                                     │
         │  ┌─────────────────────────────────────────────────────────────┐    │
         │  │  ORCHESTRATOR (:8000) × 2 replicas                         │    │
         │  │  [2 CPU, 2GB RAM, 4 uvicorn workers]                       │    │
         │  │  • Intent classifier (LLM)  • State machine (13-stage FSM) │    │
         │  │  • Agent dispatcher         • Response formatter           │    │
         │  │  • WebSocket handler        • Correlation tracking         │    │
         │  └─────────────────────────────────────────────────────────────┘    │
         │                                                                     │
         │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
         │  │ 1.BucketList│ │ 2. Timing   │ │ 3. Interest │ │ 4. Health   │  │
         │  │   :8001     │ │   :8002     │ │   :8003     │ │   :8004     │  │
         │  │ 1CPU/1GB    │ │ 1CPU/1GB    │ │ 1CPU/1GB    │ │ 1CPU/1GB    │  │
         │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
         │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
         │  │ 5. POI      │ │ 6. Duration │ │ 7. Availab. │ │ 8. Budget   │  │
         │  │   :8005     │ │   :8006     │ │   :8007     │ │   :8008     │  │
         │  │ 1CPU/1GB    │ │ 1CPU/1GB    │ │ 1CPU/1GB    │ │ 1CPU/1GB    │  │
         │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
         │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
         │  │ 9. Flight   │ │10.Accomm.   │ │11. Dining   │ │12.Itinerary │  │
         │  │   :8009     │ │   :8010     │ │   :8011     │ │   :8012     │  │
         │  │ 1CPU/1GB    │ │ 1CPU/1GB    │ │ 1CPU/1GB    │ │1.5CPU/1.5GB │  │
         │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
         │  ┌─────────────┐ ┌─────────────┐                                   │
         │  │13. Calendar │ │14. Group    │     ┌──────────────────────────┐   │
         │  │   :8013     │ │ Coordinator │     │  AUTOSCALER              │   │
         │  │ 1CPU/1GB    │ │   :8014     │     │  Polls Prometheus every  │   │
         │  │             │ │ 1CPU/1GB    │     │  30s. Scales 1-5 replicas│   │
         │  └─────────────┘ └─────────────┘     │  per agent based on:     │   │
         │                                       │  • CPU > 70% (2min)     │   │
         │  Each agent has:                      │  • Memory > 80%         │   │
         │  • Own LLM context (Claude API)       │  • Kafka lag > 100      │   │
         │  • Pinecone vector memory namespace   │  • 2min cooldown        │   │
         │  • Kafka consumer/producer            └──────────────────────────┘   │
         │  • Redis shared state client                                        │
         └─────────────────────────────────────────────────────────────────────┘
                 │              │              │              │
                 ▼              ▼              ▼              ▼
         ┌──────────────────────────────────────────────────────────────────────┐
         │                 KAFKA 3-BROKER CLUSTER                               │
         │              [Replaces Amazon MSK — 3 brokers]                       │
         │                                                                      │
         │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐   │
         │  │ Controller │  │  Broker 1  │  │  Broker 2  │  │  Broker 3    │   │
         │  │  (KRaft)   │  │   :9092    │  │   :9093    │  │   :9094      │   │
         │  └────────────┘  └────────────┘  └────────────┘  └──────────────┘   │
         │                                                                      │
         │  Config: RF=3, min.ISR=2, 12 partitions, 7-day retention            │
         │                                                                      │
         │  Topics:                                                             │
         │    wanderplan.agent.requests   (orchestrator → agents)               │
         │    wanderplan.agent.responses  (agents → orchestrator)               │
         │    wanderplan.trip.context     (shared state events)                 │
         │    wanderplan.user.prompts     (orchestrator → frontend)             │
         │    wanderplan.user.replies     (frontend → orchestrator)             │
         │    wanderplan.agent.registry   (heartbeats)                          │
         │    wanderplan.dlq              (dead letter queue)                   │
         └──────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
         ┌──────────────────────────────────────────────────────────────────────┐
         │                      DATA LAYER                                      │
         │                                                                      │
         │  ┌────────────────────────────────────────────┐                      │
         │  │  PostgreSQL 16 [Replaces RDS Multi-AZ]     │                      │
         │  │  PRIMARY ←── streaming replication ──→ REPLICA                    │
         │  │  • WAL archiving for PITR                  │                      │
         │  │  • 200 max connections                     │                      │
         │  │  • 2 CPU / 2GB RAM                         │                      │
         │  │  Data: users, auth, bookings, payments     │                      │
         │  └────────────────────────────────────────────┘                      │
         │                                                                      │
         │  ┌────────────────────────────────────────────┐                      │
         │  │  MongoDB 7 Replica Set [Replaces DocumentDB]                     │
         │  │  PRIMARY ←── replication ──→ SECONDARY     │                      │
         │  │  • Keyfile authentication                  │                      │
         │  │  • 1.5 CPU / 2GB RAM                       │                      │
         │  │  Data: trip plans, templates, content       │                      │
         │  └────────────────────────────────────────────┘                      │
         │                                                                      │
         │  ┌────────────────────────────────────────────┐                      │
         │  │  Redis 7.2 Sentinel [Replaces ElastiCache] │                      │
         │  │  MASTER + 2 REPLICAS + 3 SENTINELS         │                      │
         │  │  • Auto-failover (quorum=2)                │                      │
         │  │  • AOF persistence, 512MB max              │                      │
         │  │  Data: trip sessions, cache, pub/sub        │                      │
         │  └────────────────────────────────────────────┘                      │
         │                                                                      │
         │  ┌────────────────────────────────────────────┐                      │
         │  │  OpenSearch 2.13 [Replaces AWS OpenSearch]  │                      │
         │  │  NODE-1 + NODE-2 (cluster manager + data)   │                      │
         │  │  • 512MB JVM heap per node                  │                      │
         │  │  • + OpenSearch Dashboards UI               │                      │
         │  │  Data: POI search, hotel search, activities  │                      │
         │  └────────────────────────────────────────────┘                      │
         │                                                                      │
         │  ┌────────────────────────────────────────────┐                      │
         │  │  MinIO [Replaces S3 + CloudFront]           │                      │
         │  │  S3-compatible API + Nginx CDN cache        │                      │
         │  │  Buckets: static, photos, media, exports    │                      │
         │  │  • 30-day lifecycle on exports              │                      │
         │  │  • Public read on static assets             │                      │
         │  │  • 7-day cache on CDN proxy                 │                      │
         │  └────────────────────────────────────────────┘                      │
         └──────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
         ┌──────────────────────────────────────────────────────────────────────┐
         │                  LLM INFERENCE LAYER                                 │
         │              [Replaces AWS Bedrock]                                  │
         │                                                                      │
         │  PRIMARY:   Anthropic Claude API (cloud)                             │
         │             claude-sonnet for all agent reasoning                    │
         │                                                                      │
         │  FALLBACK:  Ollama (local, 4 CPU / 8GB RAM)                          │
         │             llama3.1:8b for offline / API outage                     │
         │             Auto-switch when Anthropic API returns 5xx               │
         │                                                                      │
         │  VECTOR:    Pinecone (cloud, serverless)                             │
         │             1536-dim embeddings, per-agent namespaces                │
         └──────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
         ┌──────────────────────────────────────────────────────────────────────┐
         │              OBSERVABILITY LAYER                                      │
         │     [Replaces CloudWatch + X-Ray + PagerDuty]                        │
         │                                                                      │
         │  ┌────────────────┐  ┌────────────┐  ┌────────────────────────────┐ │
         │  │  Prometheus    │  │   Jaeger   │  │    Alertmanager            │ │
         │  │  v2.51         │  │   1.56     │  │    v0.27                   │ │
         │  │  30-day        │  │  OTLP +    │  │  60+ alert rules           │ │
         │  │  retention     │  │  Badger    │  │  Slack + PagerDuty routes  │ │
         │  │  10GB cap      │  │  storage   │  │  Inhibition rules          │ │
         │  └───────┬────────┘  └────────────┘  └────────────────────────────┘ │
         │          │                                                           │
         │  ┌───────▼────────┐  ┌────────────┐  ┌────────────────────────────┐ │
         │  │   Grafana      │  │ Node       │  │    cAdvisor                │ │
         │  │   10.4         │  │ Exporter   │  │    Container metrics       │ │
         │  │  Agent overview│  │ Host       │  │    CPU, mem, OOM, throttle │ │
         │  │  dashboard     │  │ metrics    │  │                            │ │
         │  └────────────────┘  └────────────┘  └────────────────────────────┘ │
         └──────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
         ┌──────────────────────────────────────────────────────────────────────┐
         │              BACKUP & DISASTER RECOVERY                              │
         │     [Replaces AWS Backup + Cross-Region Replication]                 │
         │                                                                      │
         │  Schedule:  Every 30 minutes via cron (RPO < 30 min)                │
         │  RTO:       < 2 hours (verified in restore script)                  │
         │                                                                      │
         │  Backups:   PostgreSQL pg_dump + pg_basebackup (PITR)               │
         │             MongoDB mongodump (gzip compressed)                      │
         │             Redis RDB snapshot + AOF                                 │
         │             MinIO full bucket mirror                                 │
         │             Config files (encrypted .env)                            │
         │                                                                      │
         │  Remote:    rsync to secondary machine/NAS (configurable)           │
         │  Retention: 30 days, auto-cleanup                                   │
         │  Verify:    Integrity check on every backup cycle                   │
         └──────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/wanderplan-ai.git
cd wanderplan-ai

# 2. Run the setup script (generates .env, starts everything)
chmod +x infrastructure/scripts/setup.sh
./infrastructure/scripts/setup.sh

# 3. Edit .env to add your API keys
nano .env   # At minimum, set ANTHROPIC_API_KEY

# 4. Restart agents to pick up new keys
docker compose -f infrastructure/production/docker-compose.prod.yml restart

# 5. Verify
./infrastructure/scripts/setup.sh --verify
```

---

## Minimum Hardware Requirements

| Component | Minimum | Recommended | Notes |
|-----------|---------|-------------|-------|
| CPU | 8 cores | 16+ cores | 15 agents × 1 CPU + infrastructure |
| RAM | 16 GB | 32 GB | Kafka + OpenSearch are memory-hungry |
| Disk | 50 GB SSD | 200 GB NVMe | Persistent volumes for all data stores |
| Network | 100 Mbps | 1 Gbps | Inter-container traffic is high |

---

## CI/CD Pipeline

```
  ┌──────────┐     ┌──────────┐     ┌──────────────┐     ┌──────────────┐
  │  Commit  │────▶│  CI      │────▶│   Staging    │────▶│  Production  │
  │  to main │     │  Pipeline│     │   Deploy     │     │  Deploy      │
  └──────────┘     └──────────┘     └──────────────┘     └──────────────┘
                        │                                       │
                   ┌────┴────┐                            ┌─────┴─────┐
                   │ Lint    │                            │ Strategy: │
                   │ Type    │                            │ • Rolling │
                   │ Test    │                            │ • Blue-   │
                   │ Build   │                            │   Green   │
                   │ Scan    │                            │ • Canary  │
                   └─────────┘                            └───────────┘

  Blue-Green: Spin up full green stack → health check → switch traffic → stop blue
  Canary:     Deploy 1 agent at a time → monitor 3min → promote or rollback
```

---

## File Structure (New Deployment Files)

```
wanderplan-ai/
├── .github/workflows/
│   ├── ci.yml                          # Lint, test, build, security scan
│   └── deploy.yml                      # Blue-green + canary deployments
├── infrastructure/
│   ├── production/
│   │   └── docker-compose.prod.yml     # 40+ services, full production stack
│   ├── traefik/
│   │   ├── dynamic/
│   │   │   └── middlewares.yml         # Rate limit, CORS, security headers
│   │   └── cdn-cache.conf             # Nginx CDN cache for MinIO
│   ├── monitoring/
│   │   ├── prometheus/
│   │   │   ├── prometheus.yml          # Scrape config for all services
│   │   │   └── rules/
│   │   │       └── agent-alerts.yml    # 60+ alert rules (SLA, infra, DB)
│   │   ├── alertmanager/
│   │   │   └── alertmanager.yml        # Slack + PagerDuty routing
│   │   └── grafana/
│   │       ├── datasources.yml         # Prometheus, Jaeger, Alertmanager
│   │       └── dashboards/
│   │           ├── dashboard-provider.yml
│   │           └── agent-overview.json # Per-agent Grafana dashboard
│   ├── backup/
│   │   ├── backup.sh                   # Automated backup (RPO < 30min)
│   │   └── restore.sh                  # Disaster recovery (RTO < 2hr)
│   ├── scripts/
│   │   ├── setup.sh                    # IaC: 10-phase idempotent setup
│   │   └── autoscaler.py              # Container auto-scaling engine
│   ├── Dockerfile.agent                # Shared agent base image
│   └── Dockerfile.autoscaler           # Autoscaler image
└── docs/
    ├── ARCHITECTURE.md                 # System design (from Phase 1)
    └── DEPLOYMENT.md                   # This document
```
