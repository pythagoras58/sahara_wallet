import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  initiateDeveloperControlledWalletsClient,
  type CircleDeveloperControlledWalletsClient,
} from '@circle-fin/developer-controlled-wallets';

/** Chains we support for now -- Ethereum + Solana, per product decision 2026-07-09. */
export type SupportedChain = 'ETH-SEPOLIA' | 'SOL-DEVNET';
// Swap to the mainnet ids ('ETH', 'SOL') once we're ready to hold real funds.

@Injectable()
export class CircleService {
  private readonly logger = new Logger(CircleService.name);
  private client: CircleDeveloperControlledWalletsClient | null = null;

  constructor(private readonly config: ConfigService) {}

  /** True once CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET are both set. */
  isConfigured(): boolean {
    return !!this.config.get('CIRCLE_API_KEY') && !!this.config.get('CIRCLE_ENTITY_SECRET');
  }

  private getClient(): CircleDeveloperControlledWalletsClient {
    if (this.client) return this.client;

    const apiKey = this.config.get<string>('CIRCLE_API_KEY');
    const entitySecret = this.config.get<string>('CIRCLE_ENTITY_SECRET');
    if (!apiKey || !entitySecret) {
      throw new ServiceUnavailableException(
        'Circle is not configured yet -- CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET must both be set.',
      );
    }

    this.client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
    return this.client;
  }

  /** One wallet set per user, holding their ETH + SOL wallets. */
  async createWalletSetForUser(userId: string) {
    const client = this.getClient();
    const { data } = await client.createWalletSet({ name: `user:${userId}` });
    if (!data?.walletSet) {
      throw new ServiceUnavailableException('Circle did not return a wallet set.');
    }
    return data.walletSet;
  }

  /**
   * Creates one wallet per supported chain within the given wallet set.
   * accountType is EOA, not SCA -- SCA (smart contract accounts) is an EVM-only concept,
   * Solana rejects it with "SCA account is not supported on the given blockchain."
   */
  async createWalletsForSet(walletSetId: string, chains: SupportedChain[] = ['ETH-SEPOLIA', 'SOL-DEVNET']) {
    const client = this.getClient();
    const { data } = await client.createWallets({
      walletSetId,
      blockchains: chains,
      accountType: 'EOA',
      count: 1,
    });
    if (!data?.wallets) {
      throw new ServiceUnavailableException('Circle did not return any wallets.');
    }
    return data.wallets;
  }

  async getWalletBalances(walletId: string) {
    const client = this.getClient();
    const { data } = await client.getWalletTokenBalance({ id: walletId });
    return data?.tokenBalances ?? [];
  }

  async createTransfer(params: {
    walletId: string;
    tokenId: string;
    destinationAddress: string;
    amount: string;
  }) {
    const client = this.getClient();
    const { data } = await client.createTransaction({
      walletId: params.walletId,
      tokenId: params.tokenId,
      destinationAddress: params.destinationAddress,
      amount: [params.amount],
      fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
    });
    if (!data) {
      throw new ServiceUnavailableException('Circle did not return a transaction.');
    }
    return data;
  }
}
