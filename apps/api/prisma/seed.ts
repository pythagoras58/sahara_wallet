import { PrismaClient, type StaffRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const TEST_PASSWORD = 'testpass123';
const STAFF_TEST_PASSWORD = 'staffpass123';

async function seedStaff(role: StaffRole, email: string, password: string) {
  const existing = await prisma.staffAccount.findUnique({ where: { email } });
  if (existing) {
    console.log(`Staff account ${email} already exists (role: ${existing.role}) -- skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const staff = await prisma.staffAccount.create({ data: { email, passwordHash, role } });

  console.log(`Created ${role}: ${staff.email} / ${password}`);
}

type RetailFixture = {
  email: string;
  fullName: string;
  tier: 'TIER_0_UNVERIFIED' | 'TIER_1_VERIFIED';
  kycCase?: 'PENDING' | 'REJECTED';
  walletBalance?: number;
  description: string;
};

const RETAIL_FIXTURES: RetailFixture[] = [
  {
    email: 'verified@sahara.dev',
    fullName: 'Vera Verified',
    tier: 'TIER_1_VERIFIED',
    walletBalance: 500,
    description: 'verified, wallet with a $500 balance',
  },
  {
    email: 'pending@sahara.dev',
    fullName: 'Paul Pending',
    tier: 'TIER_0_UNVERIFIED',
    kycCase: 'PENDING',
    description: 'KYC submitted, awaiting officer review',
  },
  {
    email: 'rejected@sahara.dev',
    fullName: 'Rita Rejected',
    tier: 'TIER_0_UNVERIFIED',
    kycCase: 'REJECTED',
    description: 'KYC was rejected, can resubmit',
  },
  {
    email: 'unverified@sahara.dev',
    fullName: 'Uche Unverified',
    tier: 'TIER_0_UNVERIFIED',
    description: 'brand new account, hasn’t started KYC',
  },
];

async function seedRetailUser(fixture: RetailFixture) {
  const existing = await prisma.user.findUnique({ where: { email: fixture.email } });
  if (existing) {
    console.log(`User ${fixture.email} already exists -- skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email: fixture.email,
      passwordHash,
      fullName: fixture.fullName,
      kycTier: fixture.tier,
    },
  });

  const evidenceRef = JSON.stringify({ idType: 'passport', idNumber: 'TEST0000', country: 'GH' });

  if (fixture.kycCase === 'PENDING') {
    await prisma.kycCase.create({
      data: { userId: user.id, status: 'PENDING_OFFICER_REVIEW', triggerReason: 'user_submission', evidenceRef },
    });
  } else if (fixture.kycCase === 'REJECTED') {
    await prisma.kycCase.create({
      data: {
        userId: user.id,
        status: 'REJECTED',
        triggerReason: 'user_submission',
        evidenceRef,
        decisionReason: 'ID document image was blurry. Please resubmit with a clearer photo.',
        decidedAt: new Date(),
      },
    });
  }

  if (fixture.tier === 'TIER_1_VERIFIED') {
    await prisma.kycCase.create({
      data: {
        userId: user.id,
        status: 'APPROVED',
        triggerReason: 'user_submission',
        evidenceRef,
        decidedAt: new Date(),
      },
    });

    const balance = fixture.walletBalance ?? 0;
    const wallet = await prisma.wallet.create({ data: { userId: user.id, usdcBalance: balance } });
    if (balance > 0) {
      await prisma.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          type: 'DEPOSIT',
          direction: 'CREDIT',
          amountUsdc: balance,
          balanceAfter: balance,
          referenceType: 'seed',
          referenceId: 'seed',
        },
      });
    }
  }

  console.log(`Created test user: ${fixture.email} / ${TEST_PASSWORD} (${fixture.description})`);
}

type AssetFixture = {
  symbol: string;
  name: string;
  issuer: string;
  chain: string;
  minOrderUsdc: number;
  coingeckoId?: string;
};

const ASSET_FIXTURES: AssetFixture[] = [
  { symbol: 'ETH', name: 'Ethereum', issuer: 'Native', chain: 'ETH-SEPOLIA', minOrderUsdc: 5, coingeckoId: 'ethereum' },
  { symbol: 'SOL', name: 'Solana', issuer: 'Native', chain: 'SOL-DEVNET', minOrderUsdc: 5, coingeckoId: 'solana' },
  { symbol: 'XRP', name: 'XRP', issuer: 'Native', chain: 'XRP-LEDGER', minOrderUsdc: 5, coingeckoId: 'ripple' },
  { symbol: 'XLM', name: 'Stellar Lumens', issuer: 'Stellar Development Foundation', chain: 'STELLAR', minOrderUsdc: 5, coingeckoId: 'stellar' },
  { symbol: 'ONDO', name: 'Ondo', issuer: 'Ondo Finance', chain: 'ETH-SEPOLIA', minOrderUsdc: 5, coingeckoId: 'ondo-finance' },
  {
    symbol: 'KASA',
    name: 'KASA (Ghana Stock Exchange, tokenized -- roadmap)',
    issuer: 'Sahara (placeholder, not yet a real tradeable instrument)',
    chain: 'GSE-PLACEHOLDER',
    minOrderUsdc: 5,
    // No coingeckoId on purpose -- KASA doesn't correspond to any real, API-tracked
    // instrument yet. It falls back to the deterministic mock price, same as before.
  },
];

async function seedAsset(fixture: AssetFixture, createdByStaffId: string, approvedByStaffId: string) {
  const existing = await prisma.asset.findUnique({ where: { symbol: fixture.symbol } });
  if (existing) {
    console.log(`Asset ${fixture.symbol} already exists -- skipping.`);
    return;
  }

  await prisma.asset.create({
    data: {
      symbol: fixture.symbol,
      name: fixture.name,
      issuer: fixture.issuer,
      chain: fixture.chain,
      minOrderUsdc: fixture.minOrderUsdc,
      coingeckoId: fixture.coingeckoId,
      status: 'LIVE',
      createdByStaffId,
      approvedByStaffId,
      publishedAt: new Date(),
    },
  });

  console.log(`Listed ${fixture.symbol}: ${fixture.name}${fixture.coingeckoId ? ' (live via CoinGecko)' : ' (mock price)'}`);
}

async function main() {
  console.log('-- Staff accounts --');
  await seedStaff(
    'SUPER_ADMIN',
    process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@sahara.dev',
    process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'change-me-immediately',
  );
  await seedStaff(
    'KYC_OFFICER',
    process.env.SEED_KYC_OFFICER_EMAIL ?? 'kyc@sahara.dev',
    process.env.SEED_KYC_OFFICER_PASSWORD ?? 'change-me-immediately',
  );
  await seedStaff('SUPPORT_AGENT', 'support@sahara.dev', STAFF_TEST_PASSWORD);
  await seedStaff('FINANCE_MANAGER', 'finance@sahara.dev', STAFF_TEST_PASSWORD);
  await seedStaff('LISTING_ADMIN', 'listings@sahara.dev', STAFF_TEST_PASSWORD);
  await seedStaff('AUDITOR', 'auditor@sahara.dev', STAFF_TEST_PASSWORD);

  console.log('');
  console.log('-- Retail test users --');
  for (const fixture of RETAIL_FIXTURES) {
    await seedRetailUser(fixture);
  }

  console.log('');
  console.log('-- Asset listings --');
  const listingAdmin = await prisma.staffAccount.findUniqueOrThrow({ where: { email: 'listings@sahara.dev' } });
  const superAdmin = await prisma.staffAccount.findUniqueOrThrow({
    where: { email: process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@sahara.dev' },
  });
  for (const fixture of ASSET_FIXTURES) {
    await seedAsset(fixture, listingAdmin.id, superAdmin.id);
  }

  console.log('');
  console.log('All accounts log in at /login -- staff accounts need the "Sign in as staff" checkbox checked.');
  console.log(`Retail test users share the password: ${TEST_PASSWORD}`);
  console.log(`New staff test accounts (support/finance/listings/auditor) share the password: ${STAFF_TEST_PASSWORD}`);
  console.log('admin@sahara.dev and kyc@sahara.dev keep their own password (change-me-immediately by default).');
  console.log('These are dev-only accounts -- rotate or remove them before anything production-like.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
