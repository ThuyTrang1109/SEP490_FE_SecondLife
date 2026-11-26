import psycopg2

conn = psycopg2.connect(
    host="aws-0-ap-northeast-1.pooler.supabase.com",
    port=5432,
    dbname="postgres",
    user="postgres.agfxqtknmacbohlhfaln",
    password="3BEh00eWw5s7rcQR",
    sslmode="require"
)
cur = conn.cursor()

# Check center2 id
HANOI_ID = 'e844ef8a-6558-40ce-9ec7-28414d2ef701'

# 1. Hanoi level fees
cur.execute("""
    SELECT complexity_level, base_inspection_fee, status 
    FROM inspection_fee_proposals 
    WHERE proposed_by = %s AND status = 'APPROVED' AND complexity_level IS NOT NULL;
""", (HANOI_ID,))
fees = cur.fetchall()
print("Hanoi Approved Fees:", fees)

# 2. Checklists visible to Hanoi
cur.execute("""
    SELECT count(*), complexity_level 
    FROM inspection_checklist_templates 
    WHERE (approval_status = 'APPROVED' AND is_active = true) OR created_by = %s
    GROUP BY complexity_level
    ORDER BY complexity_level;
""", (HANOI_ID,))
print("Hanoi Checklists by Level:", cur.fetchall())

# 3. Any selectable item without approved checklist?
cur.execute("""
    SELECT i.id, i.name 
    FROM items i
    WHERE i.is_selectable = true
      AND NOT EXISTS (
          SELECT 1 FROM inspection_checklist_templates t
          WHERE t.catalog_item_id = i.id AND t.approval_status = 'APPROVED' AND t.is_active = true
      );
""")
unclassified = cur.fetchall()
print(f"Unclassified selectable items: {len(unclassified)}")

conn.close()
