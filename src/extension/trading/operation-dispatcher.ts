/**
 * Unified Operation Dispatcher
 *
 * Bridges TradingGit's Operation → ITradingAccount method calls.
 * Used as the TradingGitConfig.executeOperation callback.
 *
 * Return values match the structure expected by TradingGit.parseOperationResult:
 * - placeOrder/closePosition: { success, order?: { id, status, filledPrice, filledQty } }
 * - cancelOrder/adjustLeverage: { success, error? }
 */

import type { Contract } from './contract.js'
import type { ITradingAccount } from './interfaces.js'
import type { Operation } from './git/types.js'

export function createOperationDispatcher(account: ITradingAccount) {
  return async (op: Operation): Promise<unknown> => {
    switch (op.action) {
      case 'placeOrder': {
        const contract: Partial<Contract> = {}
        if (op.params.aliceId) contract.aliceId = op.params.aliceId as string
        if (op.params.symbol) contract.symbol = op.params.symbol as string
        if (op.params.secType) contract.secType = op.params.secType as Contract['secType']
        if (op.params.currency) contract.currency = op.params.currency as string
        if (op.params.exchange) contract.exchange = op.params.exchange as string

        const result = await account.placeOrder({
          contract: contract as Contract,
          side: op.params.side as 'buy' | 'sell',
          type: op.params.type as 'market' | 'limit' | 'stop' | 'stop_limit',
          qty: op.params.qty as number | undefined,
          notional: op.params.notional as number | undefined,
          price: op.params.price as number | undefined,
          stopPrice: op.params.stopPrice as number | undefined,
          leverage: op.params.leverage as number | undefined,
          reduceOnly: op.params.reduceOnly as boolean | undefined,
          timeInForce: (op.params.timeInForce as 'day' | 'gtc' | 'ioc' | 'fok') ?? 'day',
          extendedHours: op.params.extendedHours as boolean | undefined,
        })

        return {
          success: result.success,
          error: result.error,
          order: result.success
            ? {
                id: result.orderId,
                status: result.filledPrice ? 'filled' : 'pending',
                filledPrice: result.filledPrice,
                filledQty: result.filledQty,
              }
            : undefined,
        }
      }

      case 'closePosition': {
        const contract: Partial<Contract> = {}
        if (op.params.aliceId) contract.aliceId = op.params.aliceId as string
        if (op.params.symbol) contract.symbol = op.params.symbol as string
        if (op.params.secType) contract.secType = op.params.secType as Contract['secType']

        const qty = op.params.qty as number | undefined
        const result = await account.closePosition(contract as Contract, qty)

        return {
          success: result.success,
          error: result.error,
          order: result.success
            ? {
                id: result.orderId,
                status: result.filledPrice ? 'filled' : 'pending',
                filledPrice: result.filledPrice,
                filledQty: result.filledQty,
              }
            : undefined,
        }
      }

      case 'cancelOrder': {
        const orderId = op.params.orderId as string
        const success = await account.cancelOrder(orderId)
        return { success, error: success ? undefined : 'Failed to cancel order' }
      }

      case 'adjustLeverage': {
        if (!account.adjustLeverage) {
          return { success: false, error: 'Account does not support leverage adjustment' }
        }

        const contract: Partial<Contract> = {}
        if (op.params.aliceId) contract.aliceId = op.params.aliceId as string
        if (op.params.symbol) contract.symbol = op.params.symbol as string

        const newLeverage = op.params.newLeverage as number
        return account.adjustLeverage(contract as Contract, newLeverage)
      }

      default:
        throw new Error(`Unknown operation action: ${op.action}`)
    }
  }
}
