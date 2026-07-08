import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@shared/schema";
import path from "path";
import fs from "fs";

// Use persistent disk path if available (Render), fallback to local
const dataDir = process.env.DATA_DIR || process.cwd();
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, "data.db");
console.log(`[db] Using database at: ${dbPath}`);

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Auto-create tables if they don't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    name TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proposal_number TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    company_name TEXT,
    property_address TEXT NOT NULL,
    city TEXT,
    county TEXT,
    state TEXT DEFAULT 'CA',
    utility_territory TEXT,
    proposal_date TEXT NOT NULL,
    estimator TEXT,
    project_type TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    access_token TEXT NOT NULL UNIQUE,
    welcome_message TEXT,
    roof_areas TEXT,
    system_type TEXT,
    scope_summary TEXT,
    exclusions TEXT,
    timeline_estimate TEXT,
    add_ons TEXT,
    why_recommended TEXT,
    current_condition TEXT,
    key_issues TEXT,
    roof_system_type TEXT,
    coating_type TEXT,
    primer TEXT,
    base_coat TEXT,
    top_coat TEXT,
    reinforcement TEXT,
    accessories TEXT,
    penetrations_handling TEXT,
    drainage_taper TEXT,
    manufacturer_name TEXT,
    system_diagram_url TEXT,
    layer_count INTEGER,
    primer_mils TEXT,
    base_coat_mils TEXT,
    top_coat_mils TEXT,
    total_dry_mils TEXT,
    mils_explanation TEXT,
    recommended_color TEXT,
    alternate_colors TEXT,
    color_notes TEXT,
    manufacturer_warranty TEXT,
    workmanship_warranty TEXT,
    ndl_warranty TEXT,
    warranty_term TEXT,
    warranty_summary TEXT,
    warranty_maintenance TEXT,
    pricing_options TEXT,
    payment_schedule TEXT,
    financing_notes TEXT,
    proposal_pdf_url TEXT,
    approved_option TEXT,
    approved_at TEXT,
    approved_by TEXT
  );
  CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proposal_id INTEGER NOT NULL,
    manufacturer TEXT,
    product_name TEXT NOT NULL,
    category TEXT NOT NULL,
    used_for TEXT,
    technical_summary TEXT,
    data_sheet_url TEXT,
    sds_url TEXT,
    notes TEXT,
    sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS proposal_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proposal_id INTEGER NOT NULL,
    image_type TEXT NOT NULL,
    image_url TEXT NOT NULL,
    caption TEXT,
    hotspots TEXT,
    sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS incentives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proposal_id INTEGER,
    program_name TEXT NOT NULL,
    program_type TEXT NOT NULL,
    applicability TEXT,
    location_filter TEXT,
    utility_filter TEXT,
    year_filter TEXT,
    official_link TEXT,
    notes TEXT,
    last_verified_date TEXT,
    sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS warranty_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proposal_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    document_url TEXT,
    document_type TEXT,
    notes TEXT
  );
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proposal_id INTEGER,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    document_url TEXT,
    description TEXT,
    sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS activity_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proposal_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    event_data TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS customer_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proposal_id INTEGER NOT NULL,
    message_type TEXT NOT NULL,
    sender_name TEXT,
    sender_email TEXT,
    sender_phone TEXT,
    message TEXT NOT NULL,
    selected_option TEXT,
    is_read INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );
`);

// ── Safe migrations: add columns if they don't exist ──
function addColumnIfMissing(table: string, column: string, def: string) {
  try {
    const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!cols.find(c => c.name === column)) {
      sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def};`);
      console.log(`[db] Added ${table}.${column}`);
    }
  } catch (e) {
    console.warn(`[db] Migration ${table}.${column} skipped:`, e);
  }
}

addColumnIfMissing("proposals", "customer_email", "TEXT");
addColumnIfMissing("proposals", "customer_phone", "TEXT");
addColumnIfMissing("proposals", "last_sent_at", "TEXT");
addColumnIfMissing("proposals", "last_sent_to", "TEXT");
addColumnIfMissing("proposals", "send_count", "INTEGER DEFAULT 0");
addColumnIfMissing("proposals", "customer_signature", "TEXT");
addColumnIfMissing("proposals", "signed_at", "TEXT");
addColumnIfMissing("proposals", "signed_by_name", "TEXT");
addColumnIfMissing("proposals", "signed_by_title", "TEXT");
addColumnIfMissing("proposals", "requested_start_date", "TEXT");
addColumnIfMissing("proposals", "scheduled_start_date", "TEXT");
addColumnIfMissing("proposals", "work_completed_date", "TEXT");
addColumnIfMissing("proposals", "maintenance_reminders_enabled", "INTEGER DEFAULT 1");

export const db = drizzle(sqlite, { schema });
export const sqliteConnection = sqlite;
