-- Least-privilege split for storefront-content reads. Pure-list actions now
-- require content:read instead of content:write. Granted to the roles that
-- already hold content:write; a later seed re-run converges to the same set.
INSERT INTO "Permission" ("id", "code", "description", "createdAt")
VALUES ('perm_content_read', 'content:read', 'content:read', NOW())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
JOIN "Permission" p ON p."code" = 'content:read'
WHERE r."name" IN ('SUPER_ADMIN', 'ADMIN', 'PRODUCT_MANAGER')
ON CONFLICT DO NOTHING;
