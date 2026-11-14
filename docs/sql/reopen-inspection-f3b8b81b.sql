-- Chạy toàn bộ script trong DBeaver. Lệnh cuối ROLLBACK cho phép xem thử.
-- Sau khi kiểm tra kết quả, đổi ROLLBACK cuối thành COMMIT và chạy lại toàn bộ.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
DECLARE
    target_post_id CONSTANT uuid := '06a1e569-5e72-49a0-95a4-206a8adeb2a5';
    target_inspection_id CONSTANT uuid := 'f3b8b81b-9d3f-4f61-91f3-6161761b9dfa';
    inspection inspection_orders%ROWTYPE;
    buyer_refund numeric(18, 2);
    seller_refund numeric(18, 2);
    payment record;
    refund_total numeric(18, 2) := 0;
    prior_balance numeric(18, 2);
    new_balance numeric(18, 2);
BEGIN
    -- Khóa bài và đơn theo thứ tự BE dùng khi chốt giao dịch.
    PERFORM 1 FROM posts
    WHERE id = target_post_id AND status = 'RESERVED'
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bài đăng không tồn tại hoặc đã đổi trạng thái.';
    END IF;

    SELECT * INTO inspection FROM inspection_orders
    WHERE id = target_inspection_id AND post_id = target_post_id
    FOR UPDATE;
    IF NOT FOUND
       OR inspection.status <> 'CONFIRMED_PENDING_DISPATCH'
       OR inspection.fee_settled_at IS NOT NULL
       OR inspection.order_id IS NOT NULL
       OR inspection.final_payment_paid_at IS NOT NULL
       OR inspection.home_checked_in_at IS NOT NULL
       OR inspection.checklist_result_json IS NOT NULL THEN
        RAISE EXCEPTION 'Đơn đã đổi trạng thái, đã bắt đầu kiểm định hoặc đã quyết toán.';
    END IF;

    IF EXISTS (SELECT 1 FROM inspection_fee_settlements WHERE inspection_order_id = target_inspection_id)
       OR EXISTS (SELECT 1 FROM shipments WHERE inspection_order_id = target_inspection_id)
       OR EXISTS (SELECT 1 FROM orders WHERE post_id = target_post_id AND status <> 'CANCELLED')
       OR EXISTS (
           SELECT 1 FROM negotiations
           WHERE post_id = target_post_id AND status = 'ACCEPTED'
             AND (expired_at IS NULL OR expired_at > NOW())
       )
       OR EXISTS (
           SELECT 1 FROM inspection_orders
           WHERE post_id = target_post_id AND id <> target_inspection_id
             AND (status NOT IN ('CANCELLED', 'FAILED', 'PAYMENT_EXPIRED', 'COMPLETED')
                  OR (fee_settled_at IS NULL AND (
                      (buyer_paid_at IS NOT NULL
                       AND COALESCE(buyer_fee_share, 0) + COALESCE(buyer_commitment_deposit, 0) > 0)
                      OR (seller_paid_at IS NOT NULL AND COALESCE(seller_fee_share, 0) > 0)
                  )))
       ) THEN
        RAISE EXCEPTION 'Bài hoặc đơn có vận đơn, giao dịch, thương lượng hay khoản phí khác cần xử lý.';
    END IF;

    buyer_refund := CASE WHEN inspection.buyer_paid_at IS NOT NULL
        THEN COALESCE(inspection.buyer_fee_share, 0) + COALESCE(inspection.buyer_commitment_deposit, 0)
        ELSE 0 END;
    seller_refund := CASE WHEN inspection.seller_paid_at IS NOT NULL
        THEN COALESCE(inspection.seller_fee_share, 0) ELSE 0 END;

    IF buyer_refund < 0 OR seller_refund < 0 OR buyer_refund + seller_refund <= 0
       OR (buyer_refund > 0 AND inspection.buyer_id IS NULL)
       OR (seller_refund > 0 AND inspection.seller_id IS NULL)
       OR EXISTS (
           SELECT 1
           FROM wallet_transactions t
           WHERE t.reference_id = target_inspection_id
             AND (t.reference_type <> 'INSPECTION_ORDER' OR t.type <> 'PAYMENT' OR t.amount >= 0)
       ) THEN
        RAISE EXCEPTION 'Giao dịch ví của đơn khác dự kiến hoặc đã có khoản hoàn.';
    END IF;

    -- Chỉ hoàn số tiền có giao dịch PAYMENT của đúng đơn và đúng ví.
    FOR payment IN
        SELECT w.id AS wallet_id, expected.amount
        FROM (
            SELECT party.user_id, SUM(party.amount) AS amount
            FROM (VALUES (inspection.buyer_id, buyer_refund),
                         (inspection.seller_id, seller_refund)) AS party(user_id, amount)
            WHERE party.amount > 0
            GROUP BY party.user_id
        ) expected
        JOIN user_wallets w ON w.user_id = expected.user_id
        WHERE expected.amount = (
            SELECT -SUM(t.amount)
            FROM wallet_transactions t
            WHERE t.wallet_id = w.id
              AND t.reference_id = target_inspection_id
              AND t.reference_type = 'INSPECTION_ORDER'
              AND t.type = 'PAYMENT'
        )
        ORDER BY w.id
        FOR UPDATE OF w
    LOOP
        UPDATE user_wallets
        SET balance = balance + payment.amount, updated_at = NOW()
        WHERE id = payment.wallet_id
        RETURNING balance - payment.amount, balance INTO prior_balance, new_balance;

        INSERT INTO wallet_transactions (
            id, wallet_id, amount, type, reference_id, reference_type,
            balance_before, balance_after, created_at
        ) VALUES (
            gen_random_uuid(), payment.wallet_id, payment.amount, 'REFUND',
            target_inspection_id, 'INSPECTION_ORDER', prior_balance, new_balance, NOW()
        );
        refund_total := refund_total + payment.amount;
    END LOOP;

    IF refund_total <> buyer_refund + seller_refund OR refund_total <> (
        SELECT COALESCE(-SUM(t.amount), 0) FROM wallet_transactions t
        WHERE t.reference_id = target_inspection_id
          AND t.reference_type = 'INSPECTION_ORDER' AND t.type = 'PAYMENT'
    ) THEN
        RAISE EXCEPTION 'Số tiền trên đơn và lịch sử ví không khớp. Toàn bộ thay đổi sẽ bị hủy.';
    END IF;

    INSERT INTO inspection_fee_settlements (
        inspection_order_id, outcome, total_collected, center_recipient_user_id,
        buyer_refund_amount, seller_refund_amount, settled_at
    ) VALUES (
        target_inspection_id, 'CANCELLED_BEFORE_INSPECTION', refund_total,
        inspection.inspection_center_id, buyer_refund, seller_refund, NOW()
    );

    UPDATE inspection_orders
    SET status = 'CANCELLED', fee_settled_at = NOW(), updated_at = NOW(),
        note = concat_ws(' | ', NULLIF(note, ''), 'Hủy trước kiểm định và hoàn phí qua SQL.')
    WHERE id = target_inspection_id;

    UPDATE posts
    SET status = 'ACTIVE', updated_at = NOW()
    WHERE id = target_post_id;
END;
$$;

SELECT p.id AS post_id, p.status AS post_status,
       i.id AS inspection_id, i.status AS inspection_status,
       s.outcome, s.buyer_refund_amount, s.seller_refund_amount
FROM posts p
JOIN inspection_orders i ON i.post_id = p.id
JOIN inspection_fee_settlements s ON s.inspection_order_id = i.id
WHERE i.id = 'f3b8b81b-9d3f-4f61-91f3-6161761b9dfa'::uuid;

ROLLBACK;
