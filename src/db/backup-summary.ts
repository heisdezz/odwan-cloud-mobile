export const READ_BACKUP_SUMMARY_SQL = `SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN b.status='backed_up' THEN 1 ELSE 0 END),0) AS backedUp
FROM gallery_index g LEFT JOIN backup_status b ON b.asset_id=g.asset_id AND b.modified_at=g.modified_at AND b.server_url=? AND b.account_id=?`;
