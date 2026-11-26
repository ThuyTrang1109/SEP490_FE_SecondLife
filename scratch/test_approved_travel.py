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

# Query matching findTravelProposals with Sort.by(Sort.Direction.DESC, "createdAt")
cur.execute("""
    SELECT p.id, p.proposed_by, u.email, p.status, p.created_at, p.reviewed_at, p.tiers_json
    FROM inspection_fee_proposals p
    LEFT JOIN users u ON p.proposed_by = u.id
    WHERE p.status = 'APPROVED'
      AND p.complexity_level IS NULL 
      AND TRIM(p.tiers_json) NOT IN ('', '[]')
    ORDER BY p.created_at DESC, p.id DESC;
""")
approved_travel = cur.fetchall()
print(f"Total approved travel proposals: {len(approved_travel)}")
for r in approved_travel:
    tiers = json.loads(r[6])
    prices = [t.get('pricePerKm') for t in tiers]
    print(f"ID: {r[0][:8]}, Center: {r[2]}, Created: {r[4]}, Reviewed: {r[5]}, Prices: {prices}")

conn.close()
