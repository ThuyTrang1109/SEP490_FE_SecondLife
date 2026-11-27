import psycopg2
import json

conn = psycopg2.connect(
    host="aws-0-ap-northeast-1.pooler.supabase.com",
    port=5432,
    dbname="postgres",
    user="postgres.agfxqtknmacbohlhfaln",
    password="3BEh00eWw5s7rcQR",
    sslmode="require"
)
cur = conn.cursor()

# 1. Check templates in DB
cur.execute("""
    SELECT count(*), approval_status, is_active, created_by 
    FROM inspection_checklist_templates 
    GROUP BY approval_status, is_active, created_by;
""")
print("Templates by status, active, created_by:")
for r in cur.fetchall():
    print(r)

# 2. Check items in DB
cur.execute("""
    SELECT count(*) FROM items WHERE is_selectable = true;
""")
print("Selectable items count:", cur.fetchone()[0])

# 3. What does findVisibleToCenter return for center2 (e844ef8a-6558-40ce-9ec7-28414d2ef701)?
cur.execute("""
    SELECT id, catalog_item_id, complexity_level, approval_status, is_active, created_by
    FROM inspection_checklist_templates
    WHERE (approval_status = 'APPROVED' AND is_active = true)
       OR created_by = 'e844ef8a-6558-40ce-9ec7-28414d2ef701';
""")
visible_hanoi = cur.fetchall()
print(f"Templates visible to Hanoi center (center2): {len(visible_hanoi)}")

conn.close()
