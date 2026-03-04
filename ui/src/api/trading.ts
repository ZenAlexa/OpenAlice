import { fetchJson } from './client'
import type { CryptoAccount, CryptoPosition, SecAccount, SecHolding, WalletCommitLog, ReconnectResult } from './types'

// ==================== Unified Trading API ====================

export const tradingApi = {
  // ==================== Accounts ====================

  async listAccounts(): Promise<{ accounts: Array<{ id: string; provider: string; label: string }> }> {
    return fetchJson('/api/trading/accounts')
  },

  async equity(): Promise<{ totalEquity: number; totalCash: number; accounts: Array<{ id: string; label: string; equity: number; cash: number }> }> {
    return fetchJson('/api/trading/equity')
  },

  // ==================== Per-account ====================

  async reconnectAccount(accountId: string): Promise<ReconnectResult> {
    const res = await fetch(`/api/trading/accounts/${accountId}/reconnect`, { method: 'POST' })
    return res.json()
  },

  async accountInfo(accountId: string): Promise<CryptoAccount | SecAccount> {
    return fetchJson(`/api/trading/accounts/${accountId}/account`)
  },

  async positions(accountId: string): Promise<{ positions: (CryptoPosition | SecHolding)[] }> {
    return fetchJson(`/api/trading/accounts/${accountId}/positions`)
  },

  async orders(accountId: string): Promise<{ orders: unknown[] }> {
    return fetchJson(`/api/trading/accounts/${accountId}/orders`)
  },

  async marketClock(accountId: string): Promise<{ isOpen: boolean; nextOpen: string; nextClose: string }> {
    return fetchJson(`/api/trading/accounts/${accountId}/market-clock`)
  },

  async walletLog(accountId: string, limit = 20, symbol?: string): Promise<{ commits: WalletCommitLog[] }> {
    const params = new URLSearchParams({ limit: String(limit) })
    if (symbol) params.set('symbol', symbol)
    return fetchJson(`/api/trading/accounts/${accountId}/wallet/log?${params}`)
  },

  async walletShow(accountId: string, hash: string): Promise<unknown> {
    return fetchJson(`/api/trading/accounts/${accountId}/wallet/show/${hash}`)
  },

  // ==================== Backward-compat helpers ====================
  // These delegate to the per-account API using well-known account IDs.
  // UI components can migrate to the per-account API gradually.

  async reconnectCrypto(): Promise<ReconnectResult> {
    const { accounts } = await this.listAccounts()
    const crypto = accounts.find(a => a.provider === 'ccxt')
    if (!crypto) return { success: false, error: 'No crypto account' }
    return this.reconnectAccount(crypto.id)
  },

  async reconnectSecurities(): Promise<ReconnectResult> {
    const { accounts } = await this.listAccounts()
    const sec = accounts.find(a => a.provider === 'alpaca')
    if (!sec) return { success: false, error: 'No securities account' }
    return this.reconnectAccount(sec.id)
  },

  // ==================== Legacy wrappers (used by existing UI components) ====================

  async cryptoAccount(): Promise<CryptoAccount> {
    const { accounts } = await this.listAccounts()
    const crypto = accounts.find(a => a.provider === 'ccxt')
    if (!crypto) throw new Error('No crypto account')
    return fetchJson(`/api/trading/accounts/${crypto.id}/account`)
  },

  async cryptoPositions(): Promise<{ positions: CryptoPosition[] }> {
    const { accounts } = await this.listAccounts()
    const crypto = accounts.find(a => a.provider === 'ccxt')
    if (!crypto) return { positions: [] }
    return fetchJson(`/api/trading/accounts/${crypto.id}/positions`)
  },

  async cryptoOrders(): Promise<{ orders: unknown[] }> {
    const { accounts } = await this.listAccounts()
    const crypto = accounts.find(a => a.provider === 'ccxt')
    if (!crypto) return { orders: [] }
    return fetchJson(`/api/trading/accounts/${crypto.id}/orders`)
  },

  async cryptoWalletLog(limit = 20, symbol?: string): Promise<{ commits: WalletCommitLog[] }> {
    const { accounts } = await this.listAccounts()
    const crypto = accounts.find(a => a.provider === 'ccxt')
    if (!crypto) return { commits: [] }
    return this.walletLog(crypto.id, limit, symbol)
  },

  async cryptoWalletShow(hash: string): Promise<unknown> {
    const { accounts } = await this.listAccounts()
    const crypto = accounts.find(a => a.provider === 'ccxt')
    if (!crypto) throw new Error('No crypto account')
    return this.walletShow(crypto.id, hash)
  },

  async secAccount(): Promise<SecAccount> {
    const { accounts } = await this.listAccounts()
    const sec = accounts.find(a => a.provider === 'alpaca')
    if (!sec) throw new Error('No securities account')
    return fetchJson(`/api/trading/accounts/${sec.id}/account`)
  },

  async secPortfolio(): Promise<{ holdings: SecHolding[] }> {
    const { accounts } = await this.listAccounts()
    const sec = accounts.find(a => a.provider === 'alpaca')
    if (!sec) return { holdings: [] }
    // New API returns { positions }, map to { holdings } for compat
    const data = await fetchJson<{ positions: SecHolding[] }>(`/api/trading/accounts/${sec.id}/positions`)
    return { holdings: data.positions ?? [] }
  },

  async secOrders(): Promise<{ orders: unknown[] }> {
    const { accounts } = await this.listAccounts()
    const sec = accounts.find(a => a.provider === 'alpaca')
    if (!sec) return { orders: [] }
    return fetchJson(`/api/trading/accounts/${sec.id}/orders`)
  },

  async secMarketClock(): Promise<{ isOpen: boolean; nextOpen: string; nextClose: string }> {
    const { accounts } = await this.listAccounts()
    const sec = accounts.find(a => a.provider === 'alpaca')
    if (!sec) throw new Error('No securities account')
    return this.marketClock(sec.id)
  },

  async secWalletLog(limit = 20, symbol?: string): Promise<{ commits: WalletCommitLog[] }> {
    const { accounts } = await this.listAccounts()
    const sec = accounts.find(a => a.provider === 'alpaca')
    if (!sec) return { commits: [] }
    return this.walletLog(sec.id, limit, symbol)
  },

  async secWalletShow(hash: string): Promise<unknown> {
    const { accounts } = await this.listAccounts()
    const sec = accounts.find(a => a.provider === 'alpaca')
    if (!sec) throw new Error('No securities account')
    return this.walletShow(sec.id, hash)
  },
}
