-- Allow each workspace to own a project named "Default".
DROP INDEX IF EXISTS "Project_userId_name_key";

CREATE UNIQUE INDEX "Project_workspaceId_name_key" ON "Project"("workspaceId", "name");

INSERT INTO "Project" (
    "id",
    "userId",
    "workspaceId",
    "name",
    "description",
    "color",
    "createdAt",
    "updatedAt"
)
SELECT
    'default_' || "Workspace"."id",
    "Workspace"."ownerUserId",
    "Workspace"."id",
    'Default',
    'Default project for workspace uploads without a custom project.',
    '#f97316',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Workspace"
WHERE NOT EXISTS (
    SELECT 1
    FROM "Project"
    WHERE "Project"."workspaceId" = "Workspace"."id"
      AND "Project"."name" = 'Default'
);
