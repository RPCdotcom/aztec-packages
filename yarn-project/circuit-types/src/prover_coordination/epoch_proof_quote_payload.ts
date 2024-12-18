import { EthAddress } from '@aztec/foundation/eth-address';
import { schemas } from '@aztec/foundation/schemas';
import { BufferReader, serializeToBuffer } from '@aztec/foundation/serialize';
import { hexToBuffer } from '@aztec/foundation/string';
import { type FieldsOf } from '@aztec/foundation/types';

import omit from 'lodash.omit';
import { inspect } from 'util';
import { encodeAbiParameters, keccak256 } from 'viem';
import { parseAbiParameters } from 'viem';
import { z } from 'zod';

import { Signable } from '../p2p/index.js';

// Required so typescript can properly annotate the exported schema
export { type EthAddress };

export class EpochProofQuotePayload implements Signable {
  // Cached values
  private asBuffer: Buffer | undefined;
  private size: number | undefined;

  private typeHash: `0x${string}` = keccak256(
    Buffer.from(
      'EpochProofQuote(uint256 epochToProve,uint256 validUntilSlot,uint256 bondAmount,address prover,uint32 basisPointFee)',
    ),
  );

  constructor(
    public readonly epochToProve: bigint,
    public readonly validUntilSlot: bigint,
    public readonly bondAmount: bigint,
    public readonly prover: EthAddress,
    public readonly basisPointFee: number,
  ) {
    if (basisPointFee < 0 || basisPointFee > 10000) {
      throw new Error(`Invalid basisPointFee ${basisPointFee}`);
    }
  }

  static empty() {
    return new EpochProofQuotePayload(0n, 0n, 0n, EthAddress.ZERO, 0);
  }

  static random() {
    return new EpochProofQuotePayload(
      BigInt(Math.floor(Math.random() * 1e3)),
      BigInt(Math.floor(Math.random() * 1e6)),
      BigInt(Math.floor(Math.random() * 1e9)),
      EthAddress.random(),
      Math.floor(Math.random() * 10000),
    );
  }

  static getFields(fields: FieldsOf<EpochProofQuotePayload>) {
    return [
      fields.epochToProve,
      fields.validUntilSlot,
      fields.bondAmount,
      fields.prover,
      fields.basisPointFee,
    ] as const;
  }

  toBuffer(): Buffer {
    // We cache the buffer to avoid recalculating it
    if (this.asBuffer) {
      return this.asBuffer;
    }
    this.asBuffer = serializeToBuffer(...EpochProofQuotePayload.getFields(this));
    this.size = this.asBuffer.length;
    return this.asBuffer;
  }

  static fromBuffer(buf: Buffer | BufferReader): EpochProofQuotePayload {
    const reader = BufferReader.asReader(buf);
    return new EpochProofQuotePayload(
      reader.readUInt256(),
      reader.readUInt256(),
      reader.readUInt256(),
      reader.readObject(EthAddress),
      reader.readNumber(),
    );
  }

  getPayloadToSign(): Buffer {
    const abi = parseAbiParameters('bytes32, uint256, uint256, uint256, address, uint256');
    const encodedData = encodeAbiParameters(abi, [
      this.typeHash,
      this.epochToProve,
      this.validUntilSlot,
      this.bondAmount,
      this.prover.toString(),
      BigInt(this.basisPointFee),
    ]);
    return hexToBuffer(encodedData);
  }

  static from(fields: FieldsOf<EpochProofQuotePayload>): EpochProofQuotePayload {
    return new EpochProofQuotePayload(
      fields.epochToProve,
      fields.validUntilSlot,
      fields.bondAmount,
      fields.prover,
      fields.basisPointFee,
    );
  }

  toJSON() {
    return omit(this, 'asBuffer', 'size');
  }

  static get schema() {
    return z
      .object({
        epochToProve: schemas.BigInt,
        validUntilSlot: schemas.BigInt,
        bondAmount: schemas.BigInt,
        prover: schemas.EthAddress,
        basisPointFee: schemas.Integer,
      })
      .transform(EpochProofQuotePayload.from);
  }

  toViemArgs(): {
    epochToProve: bigint;
    validUntilSlot: bigint;
    bondAmount: bigint;
    prover: `0x${string}`;
    basisPointFee: number;
  } {
    return {
      epochToProve: this.epochToProve,
      validUntilSlot: this.validUntilSlot,
      bondAmount: this.bondAmount,
      prover: this.prover.toString(),
      basisPointFee: this.basisPointFee,
    };
  }

  getSize(): number {
    // We cache size to avoid recalculating it
    if (this.size) {
      return this.size;
    }
    // Size is cached when calling toBuffer
    this.toBuffer();
    return this.size!;
  }

  [inspect.custom](): string {
    return `EpochProofQuotePayload { epochToProve: ${this.epochToProve}, validUntilSlot: ${this.validUntilSlot}, bondAmount: ${this.bondAmount}, prover: ${this.prover}, basisPointFee: ${this.basisPointFee} }`;
  }
}
