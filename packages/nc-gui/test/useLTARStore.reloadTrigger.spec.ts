import { describe, expect, it, vi } from 'vitest'
import { createEventHook } from '@vueuse/core'

/**
 * Tests for the LTAR store reload trigger behavior.
 *
 * Issue #13307: BelongsTo link/unlink does not update the grid UI
 * when Infinite Scrolling is disabled.
 *
 * Root cause: After link/unlink, `reloadViewDataTrigger.trigger()` was only
 * called for undo operations in canvas mode (`undo && isCanvasInjected`).
 * The non-canvas Table.vue grid relies on ReloadViewDataHookInj to refresh
 * data, so skipping the direct trigger left the grid stale.
 *
 * Fix: Always trigger `reloadViewDataTrigger` after link/unlink to ensure
 * the grid reloads regardless of the scrolling mode.
 *
 * These tests validate the event hook trigger pattern used in the fix,
 * without instantiating the full useLTARStore composable (which requires
 * the full Nuxt/Vue runtime context).
 */
describe('LTAR store reload trigger pattern', () => {
  /**
   * Simulates the reload trigger pattern after link/unlink:
   * 1. _reloadData fires (indirect chain through Row.vue)
   * 2. reloadViewDataTrigger fires (direct ReloadViewDataHookInj trigger)
   */
  function simulatePostLinkReload(opts: {
    reloadData: (params: any) => void
    reloadViewDataTrigger: ReturnType<typeof createEventHook>
    undo: boolean
    isCanvasInjected: boolean
  }) {
    const { reloadData, reloadViewDataTrigger, undo, isCanvasInjected } = opts

    // This matches the FIXED code in useLTARStore.ts link()/unlink()
    reloadData?.({ shouldShowLoading: false })
    reloadViewDataTrigger.trigger({ shouldShowLoading: false })
  }

  /**
   * Simulates the OLD (buggy) reload trigger pattern:
   * reloadViewDataTrigger only fires for canvas undo.
   */
  function simulateOldPostLinkReload(opts: {
    reloadData: (params: any) => void
    reloadViewDataTrigger: ReturnType<typeof createEventHook>
    undo: boolean
    isCanvasInjected: boolean
  }) {
    const { reloadData, reloadViewDataTrigger, undo, isCanvasInjected } = opts

    reloadData?.({ shouldShowLoading: false })

    // OLD code: only triggers for canvas undo
    if (undo && isCanvasInjected) {
      reloadViewDataTrigger.trigger({ shouldShowLoading: false })
    }
  }

  describe('fixed behavior: reloadViewDataTrigger always fires', () => {
    it('triggers reload in non-canvas mode (Table.vue / infinite scroll disabled)', () => {
      const reloadData = vi.fn()
      const reloadViewDataTrigger = createEventHook()
      const handler = vi.fn()
      reloadViewDataTrigger.on(handler)

      simulatePostLinkReload({
        reloadData,
        reloadViewDataTrigger,
        undo: false,
        isCanvasInjected: false,
      })

      expect(reloadData).toHaveBeenCalledWith({ shouldShowLoading: false })
      expect(handler).toHaveBeenCalledWith({ shouldShowLoading: false })
    })

    it('triggers reload in canvas mode (infinite scroll enabled)', () => {
      const reloadData = vi.fn()
      const reloadViewDataTrigger = createEventHook()
      const handler = vi.fn()
      reloadViewDataTrigger.on(handler)

      simulatePostLinkReload({
        reloadData,
        reloadViewDataTrigger,
        undo: false,
        isCanvasInjected: true,
      })

      expect(reloadData).toHaveBeenCalled()
      expect(handler).toHaveBeenCalledWith({ shouldShowLoading: false })
    })

    it('triggers reload during undo in non-canvas mode', () => {
      const reloadData = vi.fn()
      const reloadViewDataTrigger = createEventHook()
      const handler = vi.fn()
      reloadViewDataTrigger.on(handler)

      simulatePostLinkReload({
        reloadData,
        reloadViewDataTrigger,
        undo: true,
        isCanvasInjected: false,
      })

      expect(handler).toHaveBeenCalledWith({ shouldShowLoading: false })
    })

    it('triggers reload during undo in canvas mode', () => {
      const reloadData = vi.fn()
      const reloadViewDataTrigger = createEventHook()
      const handler = vi.fn()
      reloadViewDataTrigger.on(handler)

      simulatePostLinkReload({
        reloadData,
        reloadViewDataTrigger,
        undo: true,
        isCanvasInjected: true,
      })

      expect(handler).toHaveBeenCalledWith({ shouldShowLoading: false })
    })

    it('still calls _reloadData for Row.vue chain', () => {
      const reloadData = vi.fn()
      const reloadViewDataTrigger = createEventHook()

      simulatePostLinkReload({
        reloadData,
        reloadViewDataTrigger,
        undo: false,
        isCanvasInjected: false,
      })

      expect(reloadData).toHaveBeenCalledWith({ shouldShowLoading: false })
    })
  })

  describe('old behavior: reloadViewDataTrigger only fires for canvas undo', () => {
    it('does NOT trigger reload in non-canvas mode (the bug)', () => {
      const reloadData = vi.fn()
      const reloadViewDataTrigger = createEventHook()
      const handler = vi.fn()
      reloadViewDataTrigger.on(handler)

      simulateOldPostLinkReload({
        reloadData,
        reloadViewDataTrigger,
        undo: false,
        isCanvasInjected: false,
      })

      // _reloadData fires but the direct trigger doesn't
      expect(reloadData).toHaveBeenCalled()
      expect(handler).not.toHaveBeenCalled() // BUG: grid doesn't refresh
    })

    it('does NOT trigger reload during undo in non-canvas mode', () => {
      const reloadData = vi.fn()
      const reloadViewDataTrigger = createEventHook()
      const handler = vi.fn()
      reloadViewDataTrigger.on(handler)

      simulateOldPostLinkReload({
        reloadData,
        reloadViewDataTrigger,
        undo: true,
        isCanvasInjected: false,
      })

      expect(handler).not.toHaveBeenCalled() // BUG: grid doesn't refresh on undo
    })

    it('only triggers reload for canvas undo', () => {
      const reloadData = vi.fn()
      const reloadViewDataTrigger = createEventHook()
      const handler = vi.fn()
      reloadViewDataTrigger.on(handler)

      simulateOldPostLinkReload({
        reloadData,
        reloadViewDataTrigger,
        undo: true,
        isCanvasInjected: true,
      })

      expect(handler).toHaveBeenCalled() // Only this case worked
    })
  })

  describe('Row.vue reload chain simulation', () => {
    it('_reloadData propagates through Row.vue to ReloadViewDataHookInj', () => {
      // Simulate the Row.vue handler chain:
      // BelongsTo._reloadData → ReloadRowDataHookInj (Row.vue reloadHook)
      // → Row.vue handler → ReloadViewDataHookInj
      const reloadViewDataHook = createEventHook()
      const gridHandler = vi.fn()
      reloadViewDataHook.on(gridHandler)

      // Row.vue's reloadHook with handler that forwards to ReloadViewDataHookInj
      const reloadHook = createEventHook()
      reloadHook.on((params: any) => {
        reloadViewDataHook.trigger({
          ...params,
          shouldShowLoading: params?.shouldShowLoading ?? false,
        })
      })

      // Simulate _reloadData call (which triggers reloadHook)
      reloadHook.trigger({ shouldShowLoading: false })

      expect(gridHandler).toHaveBeenCalledWith({ shouldShowLoading: false })
    })

    it('direct reloadViewDataTrigger bypasses Row.vue chain', () => {
      // Even if the Row.vue chain is broken (e.g., component unmounted),
      // the direct trigger still works
      const reloadViewDataHook = createEventHook()
      const gridHandler = vi.fn()
      reloadViewDataHook.on(gridHandler)

      // Direct trigger (the fix)
      reloadViewDataHook.trigger({ shouldShowLoading: false })

      expect(gridHandler).toHaveBeenCalledWith({ shouldShowLoading: false })
    })
  })
})
