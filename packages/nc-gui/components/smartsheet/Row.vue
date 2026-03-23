<script lang="ts" setup>
import { reloadSmartsheetRow } from './reloadRow'

const props = defineProps<{
  row: Row
}>()

const currentRow = toRef(props, 'row')

const { isNew, state, loadRow, pk } = useProvideSmartsheetRowStore(currentRow)

const reloadViewDataTrigger = inject(ReloadViewDataHookInj)!

// override reload trigger and use it to reload row
const reloadHook = createEventHook()

reloadHook.on(async (params) => {
  await reloadSmartsheetRow({
    isNew: isNew.value,
    loadRow,
    reloadViewDataTrigger,
    params,
  })
})

const { eventBus } = useScriptExecutor()

const eventHandler = async (event: SmartsheetScriptActions, payload: any) => {
  if (event === SmartsheetScriptActions.RELOAD_ROW) {
    // eslint-disable-next-line eqeqeq
    if (payload.rowId == pk.value) {
      await loadRow()
    }
  }
}

eventBus.on(eventHandler)

onBeforeUnmount(() => {
  eventBus.off(eventHandler)
})

provide(ReloadRowDataHookInj, reloadHook)
</script>

<template>
  <slot :state="state" />
</template>
