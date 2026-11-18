/**
 * 跨层级的一次性 UI 动作（聚焦地址栏/搜索框）。
 * 用事件总线而不是把 ref 一路 prop-drill 到 AppShell。
 */
export const appEvents = new EventTarget()

export const APP_EVENT = {
  focusOmnibox: 'mie:focus-omnibox',
  focusSearch: 'mie:focus-search',
} as const

export type AppEventName = (typeof APP_EVENT)[keyof typeof APP_EVENT]

export function emitAppEvent(name: AppEventName): void {
  appEvents.dispatchEvent(new Event(name))
}
