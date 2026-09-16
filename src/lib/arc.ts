import {
  createPublicClient,
  defineChain,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  http,
  isAddress,
  parseAbi,
  toHex,
  type Address,
  type Hex,
} from 'viem'

export const ARC_CHAIN_ID = 5042
export const ARC_RPC = 'https://rpc.mainnet.arc.io'
export const ARC_RPC_FALLBACK = 'https://rpc.quicknode.mainnet.arc.io'
export const ARC_EXPLORER = 'https://explorer.arc.io'
export const USDC = '0x3600000000000000000000000000000000000000' as Address
export const MEMO = '0x5294E9927c3306DcBaDb03fe70b92e01cCede505' as Address

export const arcMainnet = defineChain({
  id: ARC_CHAIN_ID,
  name: 'Arc',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: [ARC_RPC, ARC_RPC_FALLBACK] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: ARC_EXPLORER },
  },
})

export const publicClient = createPublicClient({
  chain: arcMainnet,
  transport: http(ARC_RPC, { timeout: 12_000 }),
})

export const memoAbi = parseAbi([
  'function memo(address target, bytes data, bytes32 memoId, bytes memoData) external',
  'event Memo(address indexed sender, address indexed target, bytes32 callDataHash, bytes32 indexed memoId, bytes memo, uint256 memoIndex)',
])

export type Pulse = {
  chainId: number
  blockNumber: bigint
  latencyMs: number
  ok: boolean
  error?: string
}

export async function fetchPulse(): Promise<Pulse> {
  const started = performance.now()
  try {
    const [chainId, blockNumber] = await Promise.all([
      publicClient.getChainId(),
      publicClient.getBlockNumber(),
    ])
    return {
      chainId,
      blockNumber,
      latencyMs: Math.round(performance.now() - started),
      ok: chainId === ARC_CHAIN_ID,
      error: chainId === ARC_CHAIN_ID ? undefined : `Unexpected chain id ${chainId}`,
    }
  } catch (error) {
    return {
      chainId: 0,
      blockNumber: 0n,
      latencyMs: Math.round(performance.now() - started),
      ok: false,
      error: error instanceof Error ? error.message : 'RPC unreachable',
    }
  }
}

export type ReadyCheck = {
  address: Address
  nativeWei: bigint
  erc6: bigint
  nativeFormatted: string
  ercFormatted: string
  scaleMatch: boolean
  canCoverGas: boolean
}

export async function checkAddress(address: string): Promise<ReadyCheck> {
  if (!isAddress(address)) {
    throw new Error('Enter a valid 0x address')
  }
  const addr = address as Address
  const [nativeWei, erc6] = await Promise.all([
    publicClient.getBalance({ address: addr }),
    publicClient.readContract({
      address: USDC,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [addr],
    }),
  ])
  // Arc: native 18 decimals and ERC-20 6 decimals share one pool; scale is 1e12.
  const expectedErc = nativeWei / 10n ** 12n
  return {
    address: addr,
    nativeWei,
    erc6,
    nativeFormatted: formatUnits(nativeWei, 18),
    ercFormatted: formatUnits(erc6, 6),
    scaleMatch: expectedErc === erc6,
    canCoverGas: nativeWei >= 10n ** 14n, // ~0.0001 native USDC
  }
}

export function buildMemoCalldata(from: Address, message: string): Hex {
  const trimmed = message.trim()
  if (!trimmed) throw new Error('Write a short memo first')
  if (trimmed.length > 140) throw new Error('Keep the memo under 140 characters')

  const inner = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [from],
  })
  const memoId = toHex(crypto.getRandomValues(new Uint8Array(32)))
  return encodeFunctionData({
    abi: memoAbi,
    functionName: 'memo',
    args: [USDC, inner, memoId, toHex(trimmed)],
  })
}

export function txUrl(hash: Hex) {
  return `${ARC_EXPLORER}/tx/${hash}`
}

export function addressUrl(address: Address) {
  return `${ARC_EXPLORER}/address/${address}`
}
