import psycopg2

HANOI_ID = 'e844ef8a-6558-40ce-9ec7-28414d2ef701'
HCM_ID = 'f5bd185b-0cf2-4e79-acb8-d9c1fdadc5ad'

conn = psycopg2.connect(
    host="aws-0-ap-northeast-1.pooler.supabase.com",
    port=5432,
    dbname="postgres",
    user="postgres.agfxqtknmacbohlhfaln",
    password="3BEh00eWw5s7rcQR",
    sslmode="require"
)
cur = conn.cursor()

# Get all 56 templates
cur.execute("""
    SELECT t.id, t.catalog_item_id, i.name, t.complexity_level, t.created_by
    FROM inspection_checklist_templates t
    JOIN items i ON t.catalog_item_id = i.id
    ORDER BY t.complexity_level, i.name;
""")
templates = cur.fetchall()
print(f"Total active approved templates: {len(templates)}")

# Distribute 28 to Hanoi and 28 to HCM
# Assign alternate items to Hanoi
hanoi_templates = []
for idx, t in enumerate(templates):
    if idx % 2 == 1: # 28 items
        hanoi_templates.append(t[0])

cur.execute("""
    UPDATE inspection_checklist_templates
    SET created_by = %s::uuid
    WHERE id = ANY(%s::uuid[]);
""", (HANOI_ID, hanoi_templates))
conn.commit()

print(f"Updated {len(hanoi_templates)} templates with created_by = Hanoi ({HANOI_ID})")

# Verification
cur.execute("""
    SELECT u.email, count(*) 
    FROM inspection_checklist_templates t
    LEFT JOIN users u ON t.created_by = u.id
    GROUP BY u.email;
""")
print("\nTemplates by creator:")
for r in cur.fetchall():
    print(f"  - {r[0]}: {r[1]} bộ tiêu chuẩn")

# Check Hanoi center view
cur.execute("""
    SELECT count(*), complexity_level 
    FROM inspection_checklist_templates 
    WHERE (approval_status = 'APPROVED' AND is_active = true) OR created_by = %s
    GROUP BY complexity_level
    ORDER BY complexity_level;
""", (HANOI_ID,))
print("\nTemplates active and visible to Hanoi:")
for r in cur.fetchall():
    print(f"  - Cấp {r[1]}: {r[0]} thiết bị")

# Check unclassified items for Hanoi
cur.execute("""
    SELECT count(*) 
    FROM items i
    WHERE i.is_selectable = true
      AND NOT EXISTS (
          SELECT 1 FROM inspection_checklist_templates t
          WHERE t.catalog_item_id = i.id AND t.approval_status = 'APPROVED' AND t.is_active = true
      );
""")
print(f"\nRemaining unclassified items for Hanoi: {cur.fetchone()[0]}")

conn.close()
