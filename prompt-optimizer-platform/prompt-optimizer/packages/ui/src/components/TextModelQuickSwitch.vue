<template>
  <div
    v-if="selectedConfig"
    class="text-model-quick-switch"
    :class="{ 'text-model-quick-switch--block': block }"
    data-testid="text-model-quick-switch"
  >
    <NSelect
      v-if="!disabled"
      :value="selectedModelId"
      :options="modelOptions"
      :loading="loading"
      filterable
      size="small"
      :placeholder="t('model.quickSwitch.placeholder')"
      :title="fullModelTitle"
      :aria-label="interactiveModelTitle"
      class="text-model-quick-switch__select"
      @focus="loadModelOptionsIfNeeded"
      @update:show="handleSelectMenuVisibility"
      @update:value="handleModelSelect"
    />
    <NTag
      v-else
      size="small"
      :bordered="false"
      class="text-model-quick-switch__model text-model-quick-switch__model--readonly"
      :title="fullModelTitle"
    >
      {{ modelLabel }}
    </NTag>
    <NText
      v-if="showProviderHint && providerLabel"
      depth="3"
      class="text-model-quick-switch__provider"
    >
      {{ providerLabel }}
    </NText>
    <NText v-if="fetchError" type="warning" depth="3" class="text-model-quick-switch__hint">
      {{ t('model.quickSwitch.fetchFailed', { error: fetchError }) }}
    </NText>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSelect, NTag, NText, type SelectOption } from 'naive-ui'
import {
  resolveTextModelMetadata,
  type ITextAdapterRegistry,
  type ModelOption,
  type TextModel,
  type TextModelConfig,
} from '@prompt-optimizer/core'

import { useToast } from '../composables/ui/useToast'
import { getProviderDisplayName } from '../utils/provider-display'
import type { ModelSelectOption } from '../types/select-options'
import type { AppServices } from '../types/services'

interface Props {
  modelKey: string
  options: ModelSelectOption[]
  disabled?: boolean
  refreshModels?: () => Promise<void>
  /** 占满父容器宽度（工作区主模型选择推荐开启） */
  block?: boolean
  /** 在下方展示 Provider 名称（平台 Gateway 单配置场景） */
  showProviderHint?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  options: () => [],
  disabled: false,
  refreshModels: undefined,
  block: true,
  showProviderHint: false,
})

const { t } = useI18n()
const toast = useToast()
const injectedServices = inject<Ref<AppServices | null>>('services', ref<AppServices | null>(null))

const loading = ref(false)
const modelOptions = ref<SelectOption[]>([])
const fetchError = ref('')
const optionsLoaded = ref(false)

const selectedConfig = computed(() =>
  props.options.find((option) => option.value === props.modelKey)?.raw ?? null
)

const providerId = computed(() => selectedConfig.value?.providerMeta?.id ?? '')
const selectedModelId = computed(() => selectedConfig.value?.modelMeta?.id ?? '')
const providerLabel = computed(() =>
  selectedConfig.value ? getProviderDisplayName(selectedConfig.value.providerMeta, t, '') : ''
)
const modelLabel = computed(() =>
  selectedConfig.value?.modelMeta?.name || selectedConfig.value?.modelMeta?.id || ''
)
const fullModelTitle = computed(() =>
  providerLabel.value ? `${providerLabel.value} / ${modelLabel.value}` : modelLabel.value
)
const interactiveModelTitle = computed(() =>
  `${t('model.quickSwitch.modelTagTitle')} - ${fullModelTitle.value}`
)

const normalizeOptions = (items: Array<ModelOption | TextModel>): SelectOption[] => {
  const seen = new Set<string>()
  const normalized: SelectOption[] = []

  for (const item of items) {
    const value = 'value' in item ? item.value : item.id
    if (!value || seen.has(value)) continue

    seen.add(value)
    normalized.push({
      value,
      label: 'label' in item ? item.label : item.name,
    })
  }

  return normalized
}

const getStaticOptions = (registry?: ITextAdapterRegistry): SelectOption[] => {
  if (!registry || !providerId.value) return []

  try {
    return normalizeOptions(registry.getStaticModels(providerId.value))
  } catch {
    return []
  }
}

const ensureCurrentOption = (options: SelectOption[]): SelectOption[] => {
  const currentId = selectedModelId.value
  if (!currentId || options.some((option) => option.value === currentId)) return options

  return [
    {
      value: currentId,
      label: modelLabel.value || currentId,
    },
    ...options,
  ]
}

const loadModelOptions = async () => {
  const config = selectedConfig.value
  const services = injectedServices.value
  if (!config || !services) {
    modelOptions.value = ensureCurrentOption([])
    return
  }

  loading.value = true
  fetchError.value = ''

  try {
    const fetched = config.providerMeta.supportsDynamicModels
      ? await services.llmService.fetchModelList(config.providerMeta.id, config)
      : []

    const dynamicOptions = normalizeOptions(fetched)
    const staticOptions = getStaticOptions(services.textAdapterRegistry)
    modelOptions.value = ensureCurrentOption(dynamicOptions.length ? dynamicOptions : staticOptions)
    optionsLoaded.value = true
  } catch (error) {
    fetchError.value = error instanceof Error ? error.message : String(error)
    modelOptions.value = ensureCurrentOption(getStaticOptions(services.textAdapterRegistry))
    optionsLoaded.value = true
  } finally {
    loading.value = false
  }
}

const loadModelOptionsIfNeeded = () => {
  if (!optionsLoaded.value && !loading.value) {
    void loadModelOptions()
  }
}

const handleSelectMenuVisibility = (show: boolean) => {
  if (show) {
    void loadModelOptions()
  }
}

const buildFallbackModelMeta = (modelId: string, label: string, current: TextModelConfig): TextModel => ({
  id: modelId,
  name: label || modelId,
  providerId: current.providerMeta.id,
  capabilities: {
    supportsTools: false,
  },
  parameterDefinitions: [],
})

const resolveModelMeta = (modelId: string, current: TextModelConfig): TextModel => {
  const optionLabel = String(modelOptions.value.find((option) => option.value === modelId)?.label || modelId)
  const registry = injectedServices.value?.textAdapterRegistry

  if (!registry) {
    return buildFallbackModelMeta(modelId, optionLabel, current)
  }

  const resolved = resolveTextModelMetadata({
    providerId: current.providerMeta.id,
    modelId,
    registry,
    existingProviderMeta: current.providerMeta,
    existingModelMeta: current.modelMeta,
  })

  return {
    ...resolved.modelMeta,
    name: optionLabel || resolved.modelMeta.name,
  }
}

const handleModelSelect = async (value: string | number | Array<string | number> | null) => {
  const modelId = Array.isArray(value) ? String(value[0] || '') : String(value || '')
  const current = selectedConfig.value
  const services = injectedServices.value
  if (!modelId || !current || !services || modelId === selectedModelId.value) return

  try {
    const modelMeta = resolveModelMeta(modelId, current)
    await services.modelManager.updateModel(current.id, { modelId, modelMeta })
    await props.refreshModels?.()
    toast.success(t('model.quickSwitch.updateSuccess', { model: modelMeta.name || modelMeta.id }))
  } catch (error) {
    toast.error(t('model.quickSwitch.updateFailed', {
      error: error instanceof Error ? error.message : String(error),
    }))
  }
}

watch(
  () => [props.modelKey, selectedModelId.value, providerId.value],
  () => {
    modelOptions.value = []
    fetchError.value = ''
    optionsLoaded.value = false
    void loadModelOptions()
  }
)

onMounted(() => {
  void loadModelOptions()
})
</script>

<style scoped>
.text-model-quick-switch {
  display: inline-flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
  vertical-align: middle;
}

.text-model-quick-switch--block {
  display: flex;
  width: 100%;
}

.text-model-quick-switch__select {
  width: 100%;
}

.text-model-quick-switch__model {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: var(--n-tag-color, var(--n-color-embedded));
  color: var(--n-text-color-2);
}

.text-model-quick-switch__model--readonly {
  align-self: flex-start;
}

.text-model-quick-switch__provider {
  font-size: 12px;
  line-height: 1.35;
}

.text-model-quick-switch__hint {
  font-size: 12px;
  line-height: 1.35;
}
</style>
