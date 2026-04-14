import type { EventHook } from '@vueuse/core'

type ReloadRowParams = {
  shouldShowLoading?: boolean
  offset?: number
}

export async function reloadSmartsheetRow({
  isNew,
  loadRow,
  reloadViewDataTrigger,
  params,
}: {
  isNew: boolean
  loadRow: () => Promise<void> | void
  reloadViewDataTrigger?: EventHook<
    | {
        shouldShowLoading?: boolean
        offset?: number
      }
    | void
  >
  params?: ReloadRowParams | void
}) {
  if (isNew) return

  await loadRow()

  await reloadViewDataTrigger?.trigger({
    ...params,
    shouldShowLoading: params?.shouldShowLoading ?? false,
  })
}
