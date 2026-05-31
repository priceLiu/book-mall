import { describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import type { TextModelConfig } from '@prompt-optimizer/core'

import TextModelQuickSwitch from '../../../src/components/TextModelQuickSwitch.vue'
import type { ModelSelectOption } from '../../../src/types/select-options'

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}

vi.mock('../../../src/composables/ui/useToast', () => ({
  useToast: () => toast,
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) =>
        params?.model ? `${key}:${params.model}` : key,
    }),
  }
})

const NSelectStub = defineComponent({
  name: 'NSelect',
  props: {
    value: { type: [String, Number], default: '' },
    options: { type: Array, default: () => [] },
    title: { type: String, default: '' },
    ariaLabel: { type: String, default: '' },
  },
  emits: ['update:value', 'update:show', 'focus'],
  setup(props, { emit }) {
    return () =>
      h(
        'select',
        {
          'data-testid': 'quick-switch-select',
          value: props.value,
          title: props.title,
          'aria-label': props.ariaLabel,
          onFocus: () => emit('focus'),
          onChange: (event: Event) => {
            emit('update:value', (event.target as HTMLSelectElement).value)
          },
        },
        (props.options as Array<{ value: string | number; label: string }>).map((option) =>
          h('option', { value: option.value }, option.label),
        ),
      )
  },
})

const simpleStub = (name: string, tag = 'div') =>
  defineComponent({
    name,
    setup(_, { slots, attrs }) {
      return () => h(tag, attrs, slots.default?.())
    },
  })

const createConfig = (): TextModelConfig => ({
  id: 'config-1',
  name: 'Gateway Config',
  enabled: true,
  providerMeta: {
    id: 'custom',
    name: 'Custom API',
    requiresApiKey: true,
    defaultBaseURL: 'https://api.example.com/v1',
    supportsDynamicModels: true,
  },
  modelMeta: {
    id: 'model-a',
    name: 'Model A',
    providerId: 'custom',
    capabilities: {
      supportsTools: false,
    },
    parameterDefinitions: [],
  },
  connectionConfig: {
    apiKey: 'secret',
    baseURL: 'https://api.example.com/v1',
    customHeaders: {
      'x-auth-token': 'token',
    },
  },
})

const createOption = (config: TextModelConfig): ModelSelectOption => ({
  primary: config.name,
  secondary: config.providerMeta.name,
  value: config.id,
  raw: config,
})

const mountComponent = (config = createConfig(), extraProps: Record<string, unknown> = {}) => {
  const updateModel = vi.fn().mockResolvedValue(undefined)
  const fetchModelList = vi.fn().mockResolvedValue([
    { value: 'model-b', label: 'Model B' },
  ])
  const refreshModels = vi.fn().mockResolvedValue(undefined)

  const services = ref({
    modelManager: {
      updateModel,
    },
    llmService: {
      fetchModelList,
    },
    textAdapterRegistry: {
      getAdapter: vi.fn().mockReturnValue({
        getProvider: vi.fn().mockReturnValue(config.providerMeta),
        getModels: vi.fn().mockReturnValue([]),
        buildDefaultModel: vi.fn((modelId: string) => ({
          id: modelId,
          name: modelId,
          providerId: config.providerMeta.id,
          capabilities: {
            supportsTools: false,
          },
          parameterDefinitions: [],
        })),
      }),
      getStaticModels: vi.fn().mockReturnValue([config.modelMeta]),
    },
  })

  const wrapper = mount(TextModelQuickSwitch, {
    props: {
      modelKey: config.id,
      options: [createOption(config)],
      refreshModels,
      ...extraProps,
    },
    global: {
      provide: {
        services,
      },
      stubs: {
        NSelect: NSelectStub,
        'n-select': NSelectStub,
        Select: NSelectStub,
        NTag: simpleStub('NTag', 'span'),
        'n-tag': simpleStub('NTag', 'span'),
        Tag: simpleStub('NTag', 'span'),
        NText: simpleStub('NText', 'span'),
        'n-text': simpleStub('NText', 'span'),
        Text: simpleStub('NText', 'span'),
      },
    },
  })

  return {
    wrapper,
    updateModel,
    fetchModelList,
    refreshModels,
    config,
  }
}

describe('TextModelQuickSwitch', () => {
  it('renders a full-width select with the current model and accessible title', async () => {
    const { wrapper } = mountComponent()

    await flushPromises()

    const select = wrapper.get('[data-testid="quick-switch-select"]')
    expect(select.element.value).toBe('model-a')
    expect(select.attributes('title')).toBe('Custom API / Model A')
    expect(select.attributes('aria-label')).toBe(
      'model.quickSwitch.modelTagTitle - Custom API / Model A',
    )
    expect(wrapper.find('.text-model-quick-switch--block').exists()).toBe(true)
  })

  it('shows provider hint when showProviderHint is enabled', async () => {
    const { wrapper } = mountComponent(createConfig(), { showProviderHint: true })

    await flushPromises()

    expect(wrapper.text()).toContain('Custom API')
    expect(wrapper.find('.text-model-quick-switch__provider').exists()).toBe(true)
  })

  it('loads models on mount and updates model identity when selection changes', async () => {
    const { wrapper, updateModel, fetchModelList, refreshModels, config } = mountComponent()

    await flushPromises()

    expect(fetchModelList).toHaveBeenCalledWith('custom', expect.objectContaining({
      id: 'config-1',
      connectionConfig: expect.objectContaining({
        customHeaders: expect.objectContaining({
          'x-auth-token': 'token',
        }),
      }),
    }))

    await wrapper.get('[data-testid="quick-switch-select"]').setValue('model-b')
    await flushPromises()

    expect(updateModel).toHaveBeenCalledWith('config-1', {
      modelId: 'model-b',
      modelMeta: expect.objectContaining({
        id: 'model-b',
        name: 'Model B',
        providerId: config.providerMeta.id,
      }),
    })
    expect(refreshModels).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('model.quickSwitch.updateSuccess:Model B')
  })
})
