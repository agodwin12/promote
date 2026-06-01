-- =============================================================
-- BusTrack — Database Migration
-- Run once to create the schema from scratch.
-- Compatible with MySQL 8.0+
-- =============================================================

CREATE DATABASE IF NOT EXISTS bustrack
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE bustrack;

-- =============================================================
-- TABLE: companies
-- One row per transport company shown on the dashboard.
-- =============================================================
CREATE TABLE IF NOT EXISTS companies (
                                         id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
                                         name        VARCHAR(150)    NOT NULL,
    slug        VARCHAR(150)    NOT NULL COMMENT 'URL-friendly name e.g. mtn-cameroon',
    logo_url    TEXT                NULL COMMENT 'Cloudflare R2 public CDN URL',
    logo_key    TEXT                NULL COMMENT 'R2 object key used for deletion',
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_companies_name (name),
    UNIQUE KEY uq_companies_slug (slug)
    ) ENGINE=InnoDB
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

-- =============================================================
-- TABLE: buses
-- One row per physical bus registered under a company.
-- mac_id links this bus to incoming GPS records.
-- =============================================================
CREATE TABLE IF NOT EXISTS buses (
                                     id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
                                     company_id  INT UNSIGNED    NOT NULL,
                                     mac_id      VARCHAR(50)     NOT NULL COMMENT 'GPS device MAC ID from 18gps.net',
    plate       VARCHAR(20)     NOT NULL COMMENT 'Vehicle licence plate',
    model       VARCHAR(100)        NULL COMMENT 'e.g. Toyota Coaster, Yutong ZK6122',
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_buses_mac_id (mac_id),
    UNIQUE KEY uq_buses_plate  (plate),

    CONSTRAINT fk_buses_company
    FOREIGN KEY (company_id)
    REFERENCES companies (id)
                                                                   ON DELETE CASCADE
                                                                   ON UPDATE CASCADE
    ) ENGINE=InnoDB
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

-- =============================================================
-- TABLE: locations
-- High-volume append-only table.
-- One row every ~10 seconds per active bus.
-- BIGINT primary key — INT would overflow in months
-- at scale with 50+ buses.
-- =============================================================
CREATE TABLE IF NOT EXISTS locations (
                                         id          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
                                         bus_id      INT UNSIGNED         NULL COMMENT 'NULL if bus not yet registered',
                                         mac_id      VARCHAR(50)      NOT NULL COMMENT 'Raw MAC from GPS provider',
    latitude    DECIMAL(10, 7)   NOT NULL COMMENT 'WGS84 — converted from GCJ-02',
    longitude   DECIMAL(10, 7)   NOT NULL COMMENT 'WGS84 — converted from GCJ-02',
    speed       DECIMAL(6, 2)        NULL DEFAULT 0 COMMENT 'km/h',
    direction   SMALLINT UNSIGNED    NULL COMMENT 'Heading 0-360 degrees',
    status      VARCHAR(20)          NULL COMMENT 'Raw status string from GPS provider',
    gps_quality ENUM(
                        'VALID',
                        'LOW_CONFIDENCE'
                    )                NOT NULL DEFAULT 'VALID',
    sys_time    DATETIME             NULL COMMENT 'Timestamp from GPS device clock',
    created_at  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    -- Most common query: latest position for a given bus
    INDEX idx_bus_id_sys_time (bus_id, sys_time DESC),

    -- gpsService MAC → bus_id resolution every 10s
    INDEX idx_mac_id           (mac_id),

    -- Time-range queries for history / playback
    INDEX idx_sys_time         (sys_time DESC),

    CONSTRAINT fk_locations_bus
    FOREIGN KEY (bus_id)
    REFERENCES buses (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
    ) ENGINE=InnoDB
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

-- =============================================================
-- SEED: sample companies (remove in production)
-- =============================================================
INSERT IGNORE INTO companies (name, slug, logo_url, logo_key) VALUES
  ('Guaranti Express',  'guaranti-express',  NULL, NULL),
  ('Vatican Express',   'vatican-express',   NULL, NULL),
  ('Buca Voyage',       'buca-voyage',       NULL, NULL);

-- =============================================================
-- SEED: sample buses linked to company id=1 (remove in production)
-- Replace mac_id values with real device MACs from 18gps.net
-- =============================================================
INSERT IGNORE INTO buses (company_id, mac_id, plate, model) VALUES
  (1, 'AA:BB:CC:DD:EE:01', 'LT-1234-SW', 'Toyota Coaster'),
  (1, 'AA:BB:CC:DD:EE:02', 'LT-5678-SW', 'Yutong ZK6122'),
  (2, 'AA:BB:CC:DD:EE:03', 'LT-9101-SW', 'King Long XMQ6127');