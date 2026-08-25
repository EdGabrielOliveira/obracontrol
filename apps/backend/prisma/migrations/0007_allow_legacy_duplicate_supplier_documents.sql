-- Fornecedores legados podem ter sido cadastrados por administradores
-- diferentes com o mesmo CNPJ. Ao unificar a conta em um Workspace, esses
-- registros devem ser preservados sem alterar documentos nem referências.
DROP INDEX IF EXISTS "ConstructionSupplier_workspaceId_document_key";
CREATE INDEX IF NOT EXISTS "ConstructionSupplier_workspaceId_document_idx"
    ON "ConstructionSupplier"("workspaceId", "document");
