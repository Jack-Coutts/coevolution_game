/// <reference lib="webworker" />
import { SimCore } from './core'
import type { ToWorker } from './protocol'

const ctx = self as unknown as DedicatedWorkerGlobalScope
const core = new SimCore((msg, transfer) => ctx.postMessage(msg, transfer))

ctx.onmessage = (ev: MessageEvent<ToWorker>) => core.handle(ev.data)
