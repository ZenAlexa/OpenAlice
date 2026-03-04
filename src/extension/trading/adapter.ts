/**
 * Unified Trading Tool Factory
 *
 * Creates all AI tools for a single ITradingAccount + TradingGit pair.
 * Replaces both createCryptoTradingTools and createSecuritiesTradingTools.
 *
 * Tool names maintain backward compatibility with existing MCP descriptions:
 * - sec* prefix for securities/general tools
 * - Account-specific tools use the account's capabilities to show/hide features
 */

import { tool } from 'ai'
import { z } from 'zod'
import type { ITradingAccount } from './interfaces.js'
import type { ITradingGit } from './git/interfaces.js'
import type { OrderStatusUpdate } from './git/types.js'
import type { GitState } from './git/types.js'
import { createTradingGitTools } from './git/adapter.js'

export function createTradingTools(
  account: ITradingAccount,
  git: ITradingGit,
  getGitState?: () => Promise<GitState>,
) {
  const capabilities = account.getCapabilities()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {
    // ==================== TradingGit operations ====================
    ...createTradingGitTools(git),

    // ==================== Sync ====================

    secWalletSync: tool({
      description: `
Sync pending order statuses from broker (like "git pull").

Checks all pending orders from previous commits and fetches their latest
status from the broker. Creates a sync commit recording any changes.

Use this after placing limit/stop orders to check if they've been filled.
      `.trim(),
      inputSchema: z.object({}),
      execute: async () => {
        if (!getGitState) {
          return { message: 'Trading account not connected. Cannot sync.', updatedCount: 0 }
        }

        const pendingOrders = git.getPendingOrderIds()
        if (pendingOrders.length === 0) {
          return { message: 'No pending orders to sync.', updatedCount: 0 }
        }

        const brokerOrders = await account.getOrders()
        const updates: OrderStatusUpdate[] = []

        for (const { orderId, symbol } of pendingOrders) {
          const brokerOrder = brokerOrders.find(o => o.id === orderId)
          if (!brokerOrder) continue

          const newStatus = brokerOrder.status
          if (newStatus !== 'pending') {
            updates.push({
              orderId,
              symbol,
              previousStatus: 'pending',
              currentStatus: newStatus,
              filledPrice: brokerOrder.filledPrice,
              filledQty: brokerOrder.filledQty,
            })
          }
        }

        if (updates.length === 0) {
          return {
            message: `All ${pendingOrders.length} order(s) still pending.`,
            updatedCount: 0,
          }
        }

        const state = await getGitState()
        return await git.sync(updates, state)
      },
    }),

    // ==================== Trading operations (staged) ====================

    secPlaceOrder: tool({
      description: `
Stage a securities order in wallet (will execute on secWalletPush).

BEFORE placing orders, you SHOULD:
1. Check secWalletLog({ symbol }) to review your history for THIS symbol
2. Check secGetPortfolio to see current holdings
3. Verify this trade aligns with your stated strategy

Supports two modes:
- qty-based: Specify number of shares (supports fractional, e.g. 0.5)
- notional-based: Specify USD amount (e.g. $1000 of AAPL)

For SELLING holdings, use secClosePosition tool instead.

NOTE: This stages the operation. Call secWalletCommit + secWalletPush to execute.
      `.trim(),
      inputSchema: z.object({
        symbol: z.string().describe('Ticker symbol, e.g. "AAPL", "SPY"'),
        side: z.enum(['buy', 'sell']).describe('Buy or sell'),
        type: z
          .enum(['market', 'limit', 'stop', 'stop_limit'])
          .describe('Order type'),
        qty: z
          .number()
          .positive()
          .optional()
          .describe('Number of shares (supports fractional). Mutually exclusive with notional.'),
        notional: z
          .number()
          .positive()
          .optional()
          .describe('Dollar amount to invest (e.g. 1000 = $1000 of the stock). Mutually exclusive with qty.'),
        price: z
          .number()
          .positive()
          .optional()
          .describe('Limit price (required for limit and stop_limit orders)'),
        stopPrice: z
          .number()
          .positive()
          .optional()
          .describe('Stop trigger price (required for stop and stop_limit orders)'),
        leverage: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe('Leverage (1-20, default 1)'),
        reduceOnly: z
          .boolean()
          .optional()
          .describe('Only reduce position (close only)'),
        timeInForce: z
          .enum(['day', 'gtc', 'ioc', 'fok'])
          .default('day')
          .describe('Time in force (default: day)'),
        extendedHours: z
          .boolean()
          .optional()
          .describe('Allow pre-market and after-hours trading'),
      }),
      execute: ({
        symbol, side, type, qty, notional, price, stopPrice,
        leverage, reduceOnly, timeInForce, extendedHours,
      }) => {
        return git.add({
          action: 'placeOrder',
          params: { symbol, side, type, qty, notional, price, stopPrice, leverage, reduceOnly, timeInForce, extendedHours },
        })
      },
    }),

    secClosePosition: tool({
      description: `
Stage a securities position close in wallet (will execute on secWalletPush).

This is the preferred way to sell holdings instead of using secPlaceOrder with side="sell".

NOTE: This stages the operation. Call secWalletCommit + secWalletPush to execute.
      `.trim(),
      inputSchema: z.object({
        symbol: z.string().describe('Ticker symbol, e.g. "AAPL"'),
        qty: z
          .number()
          .positive()
          .optional()
          .describe('Number of shares to sell (default: sell all)'),
      }),
      execute: ({ symbol, qty }) => {
        return git.add({
          action: 'closePosition',
          params: { symbol, qty },
        })
      },
    }),

    secCancelOrder: tool({
      description: `
Stage an order cancellation in wallet (will execute on secWalletPush).

NOTE: This stages the operation. Call secWalletCommit + secWalletPush to execute.
      `.trim(),
      inputSchema: z.object({
        orderId: z.string().describe('Order ID to cancel'),
      }),
      execute: ({ orderId }) => {
        return git.add({
          action: 'cancelOrder',
          params: { orderId },
        })
      },
    }),

    // ==================== Query operations (direct) ====================

    secGetPortfolio: tool({
      description: `Query current securities portfolio holdings.

Each holding includes:
- symbol, side, qty, avgEntryPrice, currentPrice
- marketValue: Current market value
- unrealizedPnL / unrealizedPnLPercent: Unrealized profit/loss
- costBasis: Total cost basis
- percentageOfEquity: This holding's value as percentage of total equity
- percentageOfPortfolio: This holding's value as percentage of total portfolio

IMPORTANT: If result is an empty array [], you have no holdings.`,
      inputSchema: z.object({
        symbol: z
          .string()
          .optional()
          .describe('Filter by ticker (e.g. "AAPL"), or omit for all holdings'),
      }),
      execute: async ({ symbol }) => {
        const allPositions = await account.getPositions()
        const accountInfo = await account.getAccount()

        const totalMarketValue = allPositions.reduce(
          (sum, p) => sum + p.marketValue,
          0,
        )

        const positionsWithPercentage = allPositions.map((pos) => {
          const percentOfEquity =
            accountInfo.equity > 0
              ? (pos.marketValue / accountInfo.equity) * 100
              : 0
          const percentOfPortfolio =
            totalMarketValue > 0
              ? (pos.marketValue / totalMarketValue) * 100
              : 0

          return {
            symbol: pos.contract.symbol,
            side: pos.side,
            qty: pos.qty,
            avgEntryPrice: pos.avgEntryPrice,
            currentPrice: pos.currentPrice,
            marketValue: pos.marketValue,
            unrealizedPnL: pos.unrealizedPnL,
            unrealizedPnLPercent: pos.unrealizedPnLPercent,
            costBasis: pos.costBasis,
            leverage: pos.leverage,
            margin: pos.margin,
            liquidationPrice: pos.liquidationPrice,
            percentageOfEquity: `${percentOfEquity.toFixed(1)}%`,
            percentageOfPortfolio: `${percentOfPortfolio.toFixed(1)}%`,
          }
        })

        const filtered = (!symbol || symbol === 'all')
          ? positionsWithPercentage
          : positionsWithPercentage.filter((p) => p.symbol === symbol)

        if (filtered.length === 0) {
          return {
            positions: [],
            message: 'No open positions.',
          }
        }

        return filtered
      },
    }),

    secGetOrders: tool({
      description: 'Query securities order history (filled, pending, cancelled)',
      inputSchema: z.object({}),
      execute: async () => {
        return await account.getOrders()
      },
    }),

    secGetAccount: tool({
      description:
        'Query securities account info (cash, portfolioValue, equity, buyingPower, unrealizedPnL, realizedPnL, dayTradeCount).',
      inputSchema: z.object({}),
      execute: async () => {
        return await account.getAccount()
      },
    }),

    secGetQuote: tool({
      description: `Query the latest quote/price for a stock symbol.

Returns real-time market data from the broker:
- last: last traded price
- bid/ask: current best bid and ask
- volume: today's trading volume

Use this to check current prices before placing orders.`,
      inputSchema: z.object({
        symbol: z.string().describe('Ticker symbol, e.g. "AAPL", "SPY"'),
      }),
      execute: async ({ symbol }) => {
        return await account.getQuote({ symbol })
      },
    }),
  }

  // ==================== Capability-gated tools ====================

  if (capabilities.supportsMarketClock && account.getMarketClock) {
    tools.secGetMarketClock = tool({
      description:
        'Get current market clock status (isOpen, nextOpen, nextClose). Use this to check if the market is currently open for trading.',
      inputSchema: z.object({}),
      execute: async () => {
        return await account.getMarketClock!()
      },
    })
  }

  if (capabilities.supportsLeverage && account.adjustLeverage) {
    tools.secAdjustLeverage = tool({
      description: `
Stage a leverage adjustment in wallet (will execute on secWalletPush).

Adjust leverage for an existing position without changing position size.
This will adjust margin requirements.

NOTE: This stages the operation. Call secWalletCommit + secWalletPush to execute.
      `.trim(),
      inputSchema: z.object({
        symbol: z.string().describe('Trading pair symbol'),
        newLeverage: z
          .number()
          .int()
          .min(1)
          .max(20)
          .describe('New leverage (1-20)'),
      }),
      execute: ({ symbol, newLeverage }) => {
        return git.add({
          action: 'adjustLeverage',
          params: { symbol, newLeverage },
        })
      },
    })
  }

  if (capabilities.supportsFundingRate && account.getFundingRate) {
    tools.secGetFundingRate = tool({
      description: `Query the current funding rate for a perpetual contract.

Returns:
- fundingRate: current/latest funding rate (e.g. 0.0001 = 0.01%)
- nextFundingTime: when the next funding payment occurs
- previousFundingRate: the previous period's rate

Positive rate = longs pay shorts. Negative rate = shorts pay longs.`,
      inputSchema: z.object({
        symbol: z.string().describe('Trading pair symbol'),
      }),
      execute: async ({ symbol }) => {
        return await account.getFundingRate!({ symbol })
      },
    })
  }

  if (capabilities.supportsOrderBook && account.getOrderBook) {
    tools.secGetOrderBook = tool({
      description: `Query the order book (market depth) for a symbol.

Returns bids and asks sorted by price. Each level is [price, amount].
Use this to evaluate liquidity and potential slippage before placing large orders.`,
      inputSchema: z.object({
        symbol: z.string().describe('Trading pair symbol'),
        limit: z.number().int().min(1).max(100).optional()
          .describe('Number of price levels per side (default: 20)'),
      }),
      execute: async ({ symbol, limit }) => {
        return await account.getOrderBook!({ symbol }, limit ?? 20)
      },
    })
  }

  return tools
}
