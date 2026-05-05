import { ChatChannelListContainer } from './ChatChannelListContainer'
import { PushApprovalPanel } from './PushApprovalPanel'

/**
 * Sidebar content for the Chat activity.
 *
 * Stacks two views in the left Side Bar (VS Code Files-activity style with
 * multiple sections):
 *   1. Channel list — chat threads navigation
 *   2. Trading panel — approval / commit actions for live trading state
 *      (analogous to Remix's "Deploy & Run" in its left sidebar)
 *
 * The trading section gets `flex-1` so PushApprovalPanel's internal scroll
 * has a definite height to compute against.
 */
export function ChatSidebarContent() {
  return (
    <>
      <ChatChannelListContainer />
      <div className="border-t border-border/60 mx-2 my-1 shrink-0" />
      <div className="flex-1 min-h-0">
        <PushApprovalPanel />
      </div>
    </>
  )
}
