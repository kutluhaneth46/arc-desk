import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Address, Hex } from 'viem'
import {
  ARC_CHAIN_ID,
  ARC_EXPLORER,
  ARC_RPC,
  MEMO,
  addressUrl,
  buildMemoCalldata,
  checkAddress,
  fetchPulse,
  txUrl,
  type Pulse,
  type ReadyCheck,
} from './lib/arc'

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

declare global {
  interface Window {
    ethereum?: EthereumProvider
  }
}

function formatBlock(n: bigint) {
  return n.toLocaleString('en-US')
}

export default function App() {
  const [pulse, setPulse] = useState<Pulse | null>(null)
  const [pulseError, setPulseError] = useState<string | null>(null)
  const [addressInput, setAddressInput] = useState('')
  const [ready, setReady] = useState<ReadyCheck | null>(null)
  const [readyError, setReadyError] = useState<string | null>(null)
  const [readyLoading, setReadyLoading] = useState(false)
  const [account, setAccount] = useState<Address | null>(null)
  const [memoText, setMemoText] = useState('')
  const [memoBusy, setMemoBusy] = useState(false)
  const [memoError, setMemoError] = useState<string | null>(null)
  const [memoHash, setMemoHash] = useState<Hex | null>(null)

  useEffect(() => {
    let alive = true
    const tick = async () => {
      const next = await fetchPulse()
      if (!alive) return
      setPulse(next)
      setPulseError(next.ok ? null : next.error ?? 'Pulse failed')
    }
    tick()
    const id = window.setInterval(tick, 12_000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  async function onCheck(event: FormEvent) {
    event.preventDefault()
    setReadyLoading(true)
    setReadyError(null)
    try {
      const result = await checkAddress(addressInput.trim())
      setReady(result)
    } catch (error) {
      setReady(null)
      setReadyError(error instanceof Error ? error.message : 'Check failed')
    } finally {
      setReadyLoading(false)
    }
  }

  async function connectWallet() {
    setMemoError(null)
    if (!window.ethereum) {
      setMemoError('No injected wallet found. Install MetaMask or another EIP-1193 wallet.')
      return
    }
    try {
      const accounts = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[]
      if (!accounts[0]) throw new Error('No account returned')
      setAccount(accounts[0] as Address)
      setAddressInput(accounts[0])

      const chainIdHex = (await window.ethereum.request({ method: 'eth_chainId' })) as string
      const chainId = Number.parseInt(chainIdHex, 16)
      if (chainId !== ARC_CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${ARC_CHAIN_ID.toString(16)}` }],
          })
        } catch (switchError: unknown) {
          const code = (switchError as { code?: number })?.code
          if (code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: `0x${ARC_CHAIN_ID.toString(16)}`,
                  chainName: 'Arc',
                  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 18 },
                  rpcUrls: [ARC_RPC],
                  blockExplorerUrls: [ARC_EXPLORER],
                },
              ],
            })
          } else {
            throw switchError
          }
        }
      }
    } catch (error) {
      setMemoError(error instanceof Error ? error.message : 'Wallet connect failed')
    }
  }

  async function postMemo(event: FormEvent) {
    event.preventDefault()
    setMemoBusy(true)
    setMemoError(null)
    setMemoHash(null)
    try {
      if (!window.ethereum) throw new Error('No injected wallet found')
      if (!account) throw new Error('Connect a wallet first')
      const data = buildMemoCalldata(account, memoText)
      const hash = (await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: account,
            to: MEMO,
            data,
            gas: '0x30d40',
          },
        ],
      })) as Hex
      setMemoHash(hash)
      setMemoText('')
    } catch (error) {
      setMemoError(error instanceof Error ? error.message : 'Memo transaction failed')
    } finally {
      setMemoBusy(false)
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-5 pb-20 pt-8 sm:px-8">
      <header className="rise flex items-center justify-between gap-4">
        <div className="font-display text-sm font-bold tracking-[0.2em] text-[var(--signal)]">ARC DESK</div>
        <a
          className="text-sm text-[var(--mist)] transition hover:text-[var(--signal)]"
          href="https://github.com/kutluhaneth46/arc-desk"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </header>

      <section className="relative mt-10 overflow-hidden rounded-sm hero-wash px-1 py-10 sm:py-16">
        <div className="rise rise-delay-1">
          <p className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight text-white sm:text-7xl">
            Arc Desk
          </p>
          <h1 className="mt-5 max-w-2xl text-xl font-medium text-[var(--fog)] sm:text-2xl">
            Live mainnet pulse, dual USDC balance check, and an onchain memo guestbook.
          </h1>
          <p className="mt-4 max-w-xl text-[var(--mist)]">
            Built for Arc day-one builders. USDC pays gas. Native is 18 decimals. ERC-20 is 6. Same pool.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a className="btn btn-signal" href="#ready">
              Check an address
            </a>
            <a className="btn btn-ghost" href="#memo">
              Leave a memo
            </a>
          </div>
        </div>
      </section>

      <section className="rise rise-delay-2 mt-16" aria-labelledby="pulse-title">
        <div className="mb-4 flex items-center gap-3">
          <span className="live-dot" aria-hidden />
          <h2 id="pulse-title" className="font-display text-2xl font-bold text-white">
            Mainnet pulse
          </h2>
        </div>
        <p className="mb-6 max-w-2xl text-[var(--mist)]">
          Reads chain id and tip from the public Arc mainnet RPC every twelve seconds.
        </p>
        <div className="grid gap-6 sm:grid-cols-3">
          <Stat label="Chain ID" value={pulse ? String(pulse.chainId || '—') : '…'} hint="expects 5042" />
          <Stat
            label="Block"
            value={pulse?.ok ? formatBlock(pulse.blockNumber) : '—'}
            hint={pulse ? `${pulse.latencyMs} ms` : 'probing'}
          />
          <Stat
            label="Status"
            value={pulse ? (pulse.ok ? 'Live' : 'Down') : '…'}
            hint={pulseError ?? ARC_RPC.replace('https://', '')}
            tone={pulse?.ok ? 'good' : pulse ? 'bad' : 'neutral'}
          />
        </div>
      </section>

      <section id="ready" className="rise rise-delay-3 mt-20" aria-labelledby="ready-title">
        <h2 id="ready-title" className="font-display text-2xl font-bold text-white">
          Dual USDC check
        </h2>
        <p className="mt-3 max-w-2xl text-[var(--mist)]">
          Paste any Arc address. Native balance uses 18 decimals. The USDC contract view uses 6. They should match by a
          10¹² scale.
        </p>
        <form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={onCheck}>
          <input
            className="field"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            placeholder="0x…"
            spellCheck={false}
            autoComplete="off"
          />
          <button className="btn btn-signal shrink-0" type="submit" disabled={readyLoading}>
            {readyLoading ? 'Checking…' : 'Check'}
          </button>
        </form>
        {readyError && <p className="mt-3 text-[var(--danger)]">{readyError}</p>}
        {ready && (
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <Stat label="Native USDC" value={trimAmount(ready.nativeFormatted)} hint="18 decimals · gas" />
            <Stat label="ERC-20 USDC" value={trimAmount(ready.ercFormatted)} hint="6 decimals · apps" />
            <Stat
              label="Scale check"
              value={ready.scaleMatch ? 'Aligned' : 'Drift'}
              hint="native ÷ 1e12 == balanceOf"
              tone={ready.scaleMatch ? 'good' : 'bad'}
            />
            <Stat
              label="Gas ready"
              value={ready.canCoverGas ? 'Yes' : 'Low'}
              hint={
                <a className="underline hover:text-[var(--signal)]" href={addressUrl(ready.address)} target="_blank" rel="noreferrer">
                  Open on explorer
                </a>
              }
              tone={ready.canCoverGas ? 'good' : 'warn'}
            />
          </div>
        )}
      </section>

      <section id="memo" className="mt-20" aria-labelledby="memo-title">
        <h2 id="memo-title" className="font-display text-2xl font-bold text-white">
          Onchain memo
        </h2>
        <p className="mt-3 max-w-2xl text-[var(--mist)]">
          Posts through Arc’s Memo precompile on mainnet. Needs a wallet with a little native USDC for gas. Your message
          lands in a Memo event on explorer.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="btn btn-ghost" type="button" onClick={connectWallet}>
            {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : 'Connect wallet'}
          </button>
        </div>
        <form className="mt-4 flex flex-col gap-3" onSubmit={postMemo}>
          <textarea
            className="field min-h-28 resize-y"
            value={memoText}
            onChange={(e) => setMemoText(e.target.value)}
            placeholder="Day one on Arc mainnet…"
            maxLength={140}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-signal" type="submit" disabled={memoBusy || !account}>
              {memoBusy ? 'Submitting…' : 'Post memo'}
            </button>
            <span className="text-sm text-[var(--mist)]">{memoText.length}/140</span>
          </div>
        </form>
        {memoError && <p className="mt-3 text-[var(--danger)]">{memoError}</p>}
        {memoHash && (
          <p className="mt-3 text-[var(--signal)]">
            Posted.{' '}
            <a className="underline" href={txUrl(memoHash)} target="_blank" rel="noreferrer">
              View transaction
            </a>
          </p>
        )}
      </section>

      <footer className="mt-24 border-t border-white/10 pt-8 text-sm text-[var(--mist)]">
        <p>
          Arc Desk by{' '}
          <a className="text-[var(--fog)] underline hover:text-[var(--signal)]" href="https://linktr.ee/kutluhaneth">
            kutluhaneth
          </a>
          . Reads public mainnet RPC. Writes only when you sign a Memo transaction.
        </p>
      </footer>
    </div>
  )
}

function trimAmount(value: string) {
  if (!value.includes('.')) return value
  const [whole, frac = ''] = value.split('.')
  const trimmed = frac.replace(/0+$/, '').slice(0, 6)
  return trimmed ? `${whole}.${trimmed}` : whole
}

function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: string
  hint?: ReactNode
  tone?: 'neutral' | 'good' | 'bad' | 'warn'
}) {
  const toneClass =
    tone === 'good'
      ? 'text-[var(--signal)]'
      : tone === 'bad'
        ? 'text-[var(--danger)]'
        : tone === 'warn'
          ? 'text-[var(--warn)]'
          : 'text-white'

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--mist)]">{label}</p>
      <p className={`mt-2 font-display text-3xl font-bold ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-sm text-[var(--mist)]">{hint}</p>}
    </div>
  )
}
