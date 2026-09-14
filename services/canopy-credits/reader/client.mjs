import { SuiGrpcClient, GrpcWebFetchTransport } from '@mysten/sui/grpc';
import { MAINNET, createMainnetReader, ChainReadError } from '../mainnet-reader.mjs';
const ALLOWED = new Set([
  'sui.rpc.v2.LedgerService/GetServiceInfo', 'sui.rpc.v2.LedgerService/GetTransaction',
  'sui.rpc.v2.LedgerService/GetCheckpoint', 'sui.rpc.v2.StateService/GetCoinInfo',
]);
/** Reject transaction execution, simulation, signing, and all unneeded RPCs before transport. */
export class ReadOnlyTransport extends GrpcWebFetchTransport {
  constructor() { super({ baseUrl: MAINNET.endpoint, format: 'binary', fetchInit: { redirect: 'error' } }); }
  unary(method, input, options) {
    if (!ALLOWED.has(`${method.service.typeName}/${method.name}`)) throw new ChainReadError('rpc-method-not-readonly-allowlisted');
    return super.unary(method, input, options);
  }
  serverStreaming() { throw new ChainReadError('rpc-streaming-disabled'); }
  clientStreaming() { throw new ChainReadError('rpc-streaming-disabled'); }
  duplex() { throw new ChainReadError('rpc-streaming-disabled'); }
}
export function connectMainnetReader(options) {
  const client = new SuiGrpcClient({ network: 'mainnet', transport: new ReadOnlyTransport() });
  return createMainnetReader({
    getServiceInfo: (r, o) => client.ledgerService.getServiceInfo(r, o),
    getCoinInfo: (r, o) => client.stateService.getCoinInfo(r, o),
    getTransaction: (r, o) => client.ledgerService.getTransaction(r, o),
    getCheckpoint: (r, o) => client.ledgerService.getCheckpoint(r, o),
  }, options);
}
