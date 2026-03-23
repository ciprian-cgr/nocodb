import { createEventHook } from '@vueuse/core'
import { describe, expect, it, vi } from 'vitest'
import { reloadSmartsheetRow } from '../../../components/smartsheet/reloadRow'

describe('reloadSmartsheetRow', () => {
  it('reloads the current row before syncing the view', async () => {
    const loadRow = vi.fn()
    const reloadViewDataTrigger = createEventHook<{ shouldShowLoading?: boolean; offset?: number } | void>()
    const reloadViewDataListener = vi.fn()

    reloadViewDataTrigger.on(reloadViewDataListener)

    await reloadSmartsheetRow({
      isNew: false,
      loadRow,
      reloadViewDataTrigger,
      params: {
        offset: 25,
      },
    })

    expect(loadRow).toHaveBeenCalledTimes(1)
    expect(reloadViewDataListener).toHaveBeenCalledTimes(1)
    expect(reloadViewDataListener).toHaveBeenCalledWith({
      offset: 25,
      shouldShowLoading: false,
    })
    expect(loadRow.mock.invocationCallOrder[0]).toBeLessThan(reloadViewDataListener.mock.invocationCallOrder[0])
  })

  it('skips reloading and syncing for new rows', async () => {
    const loadRow = vi.fn()
    const reloadViewDataTrigger = createEventHook<{ shouldShowLoading?: boolean; offset?: number } | void>()
    const reloadViewDataListener = vi.fn()

    reloadViewDataTrigger.on(reloadViewDataListener)

    await reloadSmartsheetRow({
      isNew: true,
      loadRow,
      reloadViewDataTrigger,
    })

    expect(loadRow).not.toHaveBeenCalled()
    expect(reloadViewDataListener).not.toHaveBeenCalled()
  })
})
