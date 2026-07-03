-- AlterEnum GatewayProviderKind: add MINIMAX
ALTER TYPE "GatewayProviderKind" ADD VALUE IF NOT EXISTS 'MINIMAX';

-- AlterEnum GatewayRequestKind: add MUSIC
ALTER TYPE "GatewayRequestKind" ADD VALUE IF NOT EXISTS 'MUSIC';
