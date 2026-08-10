import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

let client: PrismaClient | undefined;

export function getPrismaClient(databaseUrl: string): PrismaClient {
  if (!databaseUrl.trim()) throw new Error('DATABASE_URL is required.');
  if (!client) {
    client = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  }
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  await client?.$disconnect();
  client = undefined;
}
