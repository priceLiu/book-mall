-- Additive enum: SCRIPT_PACKAGE for industrial script export (Pro2 only; sbv1 unaffected)
ALTER TYPE "ProjectAssetKind" ADD VALUE IF NOT EXISTS 'SCRIPT_PACKAGE';
