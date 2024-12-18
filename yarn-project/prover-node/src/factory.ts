import { type Archiver, createArchiver } from '@aztec/archiver';
import { EpochProofQuoteHasher, type ProverCoordination, type ProvingJobBroker } from '@aztec/circuit-types';
import { EpochCache } from '@aztec/epoch-cache';
import { Buffer32 } from '@aztec/foundation/buffer';
import { EthAddress } from '@aztec/foundation/eth-address';
import { type Logger, createLogger } from '@aztec/foundation/log';
import { type DataStoreConfig } from '@aztec/kv-store/config';
import { RollupAbi } from '@aztec/l1-artifacts';
import { createProverClient } from '@aztec/prover-client';
import { createAndStartProvingBroker } from '@aztec/prover-client/broker';
import { L1Publisher } from '@aztec/sequencer-client';
import { type TelemetryClient } from '@aztec/telemetry-client';
import { NoopTelemetryClient } from '@aztec/telemetry-client/noop';
import { createWorldStateSynchronizer } from '@aztec/world-state';

import { createBondManager } from './bond/factory.js';
import { type ProverNodeConfig, type QuoteProviderConfig } from './config.js';
import { ClaimsMonitor } from './monitors/claims-monitor.js';
import { EpochMonitor } from './monitors/epoch-monitor.js';
import { createProverCoordination } from './prover-coordination/factory.js';
import { ProverNode, type ProverNodeOptions } from './prover-node.js';
import { HttpQuoteProvider } from './quote-provider/http.js';
import { SimpleQuoteProvider } from './quote-provider/simple.js';
import { QuoteSigner } from './quote-signer.js';

/** Creates a new prover node given a config. */
export async function createProverNode(
  config: ProverNodeConfig & DataStoreConfig,
  deps: {
    telemetry?: TelemetryClient;
    log?: Logger;
    aztecNodeTxProvider?: ProverCoordination;
    archiver?: Archiver;
    publisher?: L1Publisher;
    broker?: ProvingJobBroker;
  } = {},
) {
  const telemetry = deps.telemetry ?? new NoopTelemetryClient();
  const log = deps.log ?? createLogger('prover-node');
  const archiver = deps.archiver ?? (await createArchiver(config, telemetry, { blockUntilSync: true }));
  log.verbose(`Created archiver and synced to block ${await archiver.getBlockNumber()}`);

  const worldStateConfig = { ...config, worldStateProvenBlocksOnly: false };
  const worldStateSynchronizer = await createWorldStateSynchronizer(worldStateConfig, archiver, telemetry);
  await worldStateSynchronizer.start();

  const broker = deps.broker ?? (await createAndStartProvingBroker(config, telemetry));
  const prover = await createProverClient(config, worldStateSynchronizer, broker, telemetry);

  // REFACTOR: Move publisher out of sequencer package and into an L1-related package
  const publisher = deps.publisher ?? new L1Publisher(config, telemetry);

  // Dependencies of the p2p client
  const epochCache = await EpochCache.create(config.l1Contracts.rollupAddress, config);
  const epochProofQuoteHasher = new EpochProofQuoteHasher(config.l1Contracts.rollupAddress, config.l1ChainId);

  // If config.p2pEnabled is true, createProverCoordination will create a p2p client where quotes will be shared and tx's requested
  // If config.p2pEnabled is false, createProverCoordination request information from the AztecNode
  const proverCoordination = await createProverCoordination(config, {
    aztecNodeTxProvider: deps.aztecNodeTxProvider,
    worldStateSynchronizer,
    archiver,
    telemetry,
    epochCache,
    epochProofQuoteHasher,
  });

  const quoteProvider = createQuoteProvider(config);
  const quoteSigner = createQuoteSigner(config, epochProofQuoteHasher);

  const proverNodeConfig: ProverNodeOptions = {
    maxPendingJobs: config.proverNodeMaxPendingJobs,
    pollingIntervalMs: config.proverNodePollingIntervalMs,
    maxParallelBlocksPerEpoch: config.proverNodeMaxParallelBlocksPerEpoch,
  };

  const claimsMonitor = new ClaimsMonitor(publisher, telemetry, proverNodeConfig);
  const epochMonitor = new EpochMonitor(archiver, telemetry, proverNodeConfig);

  const rollupContract = publisher.getRollupContract();
  const walletClient = publisher.getClient();
  const bondManager = await createBondManager(rollupContract, walletClient, config);

  return new ProverNode(
    prover,
    publisher,
    archiver,
    archiver,
    archiver,
    worldStateSynchronizer,
    proverCoordination,
    quoteProvider,
    quoteSigner,
    claimsMonitor,
    epochMonitor,
    bondManager,
    telemetry,
    proverNodeConfig,
  );
}

function createQuoteProvider(config: QuoteProviderConfig) {
  return config.quoteProviderUrl
    ? new HttpQuoteProvider(config.quoteProviderUrl)
    : new SimpleQuoteProvider(config.quoteProviderBasisPointFee, config.quoteProviderBondAmount);
}

function createEpochProofQuoteHasher(config: ProverNodeConfig) {}

function createQuoteSigner(config: ProverNodeConfig, epochProofQuoteHasher: EpochProofQuoteHasher) {
  const { publisherPrivateKey } = config;

  const privateKey = Buffer32.fromString(publisherPrivateKey);
  return QuoteSigner.new(epochProofQuoteHasher, privateKey);
}
