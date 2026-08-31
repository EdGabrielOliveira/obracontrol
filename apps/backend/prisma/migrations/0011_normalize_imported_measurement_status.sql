-- Imported measurements created before the canonical lifecycle used APROVADA.
-- They represent confirmed execution and must remain visible to BI/statistics.
-- The predicate makes this migration safe to run more than once.
UPDATE "ConstructionMeasurement"
SET "status" = 'ACEITO'
WHERE "status" = 'APROVADA';
