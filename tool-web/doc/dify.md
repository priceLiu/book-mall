## 嵌入网站, 代码 
<script>
 window.difyChatbotConfig = {
  token: 'zIqjmKXr9kaCClGo',
  inputs: {
    // You can define the inputs from the Start node here
    // key is the variable name
    // e.g.
    // name: "NAME"
  },
  systemVariables: {
    // user_id: 'YOU CAN DEFINE USER ID HERE',
    // conversation_id: 'YOU CAN DEFINE CONVERSATION ID HERE, IT MUST BE A VALID UUID',
  },
  userVariables: {
    // avatar_url: 'YOU CAN DEFINE USER AVATAR URL HERE',
    // name: 'YOU CAN DEFINE USER NAME HERE',
  },
 }
</script>
<script
 src="https://udify.app/embed.min.js"
 id="zIqjmKXr9kaCClGo"
 defer>
</script>
<style>
  #dify-chatbot-bubble-button {
    background-color: #1C64F2 !important;
  }
  #dify-chatbot-bubble-window {
    width: 24rem !important;
    height: 40rem !important;
  }
</style>


## 用文件更新线上的知识库文档 

curl --request POST \
  --url https://api.dify.ai/v1/datasets/{dataset_id}/documents/{document_id}/update-by-file \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: multipart/form-data' \
  --form file='@example-file' \
  --form 'data={"indexing_technique":"high_quality","doc_form":"text_model","doc_language":"English","process_rule":{"mode":"automatic"}}'



{
  "document": {
    "id": "a8e0e5b5-78c6-4130-a5ce-25feb0e0b4ac",
    "position": 1,
    "data_source_type": "upload_file",
    "data_source_info": {
      "upload_file_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    },
    "data_source_detail_dict": {
      "upload_file": {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "name": "guide.txt",
        "size": 2048,
        "extension": "txt",
        "mime_type": "text/plain",
        "created_by": "ad313dd6-ef04-4dd1-a5b0-c0f0b9e2e7e4",
        "created_at": 1741267200
      }
    },
    "dataset_process_rule_id": "e1f2a3b4-c5d6-7890-ef12-345678901234",
    "name": "guide.txt",
    "created_from": "api",
    "created_by": "ad313dd6-ef04-4dd1-a5b0-c0f0b9e2e7e4",
    "created_at": 1741267200,
    "tokens": 512,
    "indexing_status": "completed",
    "error": null,
    "enabled": true,
    "disabled_at": null,
    "disabled_by": null,
    "archived": false,
    "display_status": "available",
    "word_count": 350,
    "hit_count": 0,
    "doc_form": "text_model",
    "doc_metadata": [],
    "summary_index_status": null,
    "need_summary": false
  },
  "batch": "20250306150245647595"
}



## 引用页面 用文件更新知识库文档

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dify.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# 用文件更新文档

> 通过上传新文件更新现有文档。将重新触发索引——使用返回的 `batch` ID 配合 [获取文档嵌入状态（进度）](/api-reference/文档/获取文档嵌入状态（进度）) 跟踪进度。



## OpenAPI

````yaml /zh/api-reference/openapi_knowledge.json post /datasets/{dataset_id}/documents/{document_id}/update-by-file
openapi: 3.0.1
info:
  title: 知识库 API
  description: >-
    用于管理知识库、文档、分段、元数据和标签的 API，包括创建、检索和配置操作。**注意：**单个知识库 API
    密钥有权操作同一账户下所有可见的知识库。请注意数据安全。
  version: 1.0.0
servers:
  - url: '{apiBaseUrl}'
    description: Knowledge API 的基础 URL。
    variables:
      apiBaseUrl:
        default: https://api.dify.ai/v1
        description: API 的实际基础 URL
security:
  - ApiKeyAuth: []
tags:
  - name: 知识库
    description: 用于管理知识库的操作，包括创建、配置和检索。
  - name: 文档
    description: 用于在知识库中创建、更新和管理文档的操作。
  - name: 分段
    description: 用于管理分段和子分段的操作。
  - name: 元数据
    description: 用于管理知识库元数据字段和文档元数据值的操作。
  - name: 标签
    description: 用于管理知识库标签和标签绑定的操作。
  - name: 模型
    description: 用于获取可用模型的操作。
  - name: 知识流水线
    description: 用于管理和运行知识流水线的操作，包括数据源插件和流水线执行。
paths:
  /datasets/{dataset_id}/documents/{document_id}/update-by-file:
    post:
      tags:
        - 文档
      summary: 用文件更新文档
      description: >-
        通过上传新文件更新现有文档。将重新触发索引——使用返回的 `batch` ID 配合
        [获取文档嵌入状态（进度）](/api-reference/文档/获取文档嵌入状态（进度）) 跟踪进度。
      operationId: updateDocumentByFile
      parameters:
        - name: dataset_id
          in: path
          required: true
          schema:
            type: string
            format: uuid
          description: 知识库 ID。
        - name: document_id
          in: path
          required: true
          schema:
            type: string
            format: uuid
          description: 文档 ID.
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                file:
                  type: string
                  format: binary
                  description: 要上传的文件。
                data:
                  type: string
                  description: >-
                    包含配置信息的 JSON 字符串。接受与 [从文本创建文档](/api-reference/文档/从文本创建文档)
                    相同的字段（`indexing_technique`、`doc_form`、`doc_language`、`process_rule`、`retrieval_model`、`embedding_model`、`embedding_model_provider`），但不包括
                    `name` 和 `text`。
                  example: >-
                    {"indexing_technique":"high_quality","doc_form":"text_model","doc_language":"English","process_rule":{"mode":"automatic"}}
      responses:
        '200':
          description: 文档更新成功。
          content:
            application/json:
              schema:
                type: object
                properties:
                  document:
                    $ref: '#/components/schemas/Document'
                  batch:
                    type: string
                    description: 用于跟踪索引进度的批次 ID。
              examples:
                success:
                  summary: 响应示例
                  value:
                    document:
                      id: a8e0e5b5-78c6-4130-a5ce-25feb0e0b4ac
                      position: 1
                      data_source_type: upload_file
                      data_source_info:
                        upload_file_id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
                      data_source_detail_dict:
                        upload_file:
                          id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
                          name: guide.txt
                          size: 2048
                          extension: txt
                          mime_type: text/plain
                          created_by: ad313dd6-ef04-4dd1-a5b0-c0f0b9e2e7e4
                          created_at: 1741267200
                      dataset_process_rule_id: e1f2a3b4-c5d6-7890-ef12-345678901234
                      name: guide.txt
                      created_from: api
                      created_by: ad313dd6-ef04-4dd1-a5b0-c0f0b9e2e7e4
                      created_at: 1741267200
                      tokens: 512
                      indexing_status: completed
                      error: null
                      enabled: true
                      disabled_at: null
                      disabled_by: null
                      archived: false
                      display_status: available
                      word_count: 350
                      hit_count: 0
                      doc_form: text_model
                      doc_metadata: []
                      summary_index_status: null
                      need_summary: false
                    batch: '20250306150245647595'
        '400':
          description: >-
            - `too_many_files` : 仅允许上传一个文件。

            - `filename_not_exists_error` : 指定的文件名不存在。

            - `provider_not_initialize` : 未找到有效的模型提供商凭据。请前往设置 -> 模型提供商完成凭据配置。

            - `invalid_param` : 知识库不存在、不支持外部数据集、文件过大、不支持的文件类型或 doc_form 无效（必须为
            `text_model`、`hierarchical_model` 或 `qa_model`）。
          content:
            application/json:
              examples:
                too_many_files:
                  summary: too_many_files
                  value:
                    status: 400
                    code: too_many_files
                    message: Only one file is allowed.
                filename_not_exists_error:
                  summary: filename_not_exists_error
                  value:
                    status: 400
                    code: filename_not_exists_error
                    message: The specified filename does not exist.
                provider_not_initialize:
                  summary: provider_not_initialize
                  value:
                    status: 400
                    code: provider_not_initialize
                    message: >-
                      No valid model provider credentials found. Please go to
                      Settings -> Model Provider to complete your provider
                      credentials.
                invalid_param_dataset:
                  summary: invalid_param (dataset)
                  value:
                    status: 400
                    code: invalid_param
                    message: Dataset does not exist.
                invalid_param_external:
                  summary: invalid_param (external)
                  value:
                    status: 400
                    code: invalid_param
                    message: External datasets are not supported.
                invalid_param_file_too_large:
                  summary: invalid_param (file_too_large)
                  value:
                    status: 400
                    code: invalid_param
                    message: File size exceeded.
                invalid_param_unsupported_file_type:
                  summary: invalid_param (unsupported_file_type)
                  value:
                    status: 400
                    code: invalid_param
                    message: File type not allowed.
components:
  schemas:
    Document:
      type: object
      properties:
        id:
          type: string
          description: 文档的唯一标识符。
        position:
          type: integer
          description: 文档在列表中的显示位置。
        data_source_type:
          type: string
          description: 文档的创建方式。文件上传为 `upload_file`，Notion 导入为 `notion_import`。
        data_source_info:
          type: object
          description: 原始数据源信息，随 `data_source_type` 而异。
        data_source_detail_dict:
          type: object
          description: 详细的数据源信息，包括文件详情。
        dataset_process_rule_id:
          type: string
          description: 应用于该文档的处理规则 ID。
        name:
          type: string
          description: 文档名称。
        created_from:
          type: string
          description: 文档来源。通过 API 创建时为 `api`，通过 UI 创建时为 `web`。
        created_by:
          type: string
          description: 创建该文档的用户 ID。
        created_at:
          type: number
          description: 创建时间戳（Unix 纪元，单位为秒）。
        tokens:
          type: integer
          description: 文档中的令牌总数。
        indexing_status:
          type: string
          description: >-
            当前索引状态。`waiting` 表示排队中，`parsing` 表示正在提取内容，`cleaning`
            表示正在去噪，`splitting` 表示正在分块，`indexing` 表示正在构建向量，`completed`
            表示就绪，`error` 表示失败，`paused` 表示手动暂停。
        error:
          type: string
          nullable: true
          description: 索引失败时的错误消息。无错误时为 `null`。
        enabled:
          type: boolean
          description: 该文档是否启用检索。
        disabled_at:
          type: number
          nullable: true
          description: 文档被禁用的时间戳。启用时为 `null`。
        disabled_by:
          type: string
          nullable: true
          description: 禁用该文档的用户 ID。启用时为 `null`。
        archived:
          type: boolean
          description: 文档是否已归档。
        display_status:
          type: string
          description: 基于 `indexing_status` 和 `enabled` 状态派生的面向用户的显示状态。
        word_count:
          type: integer
          description: 文档的总字数。
        hit_count:
          type: integer
          description: 该文档在检索查询中被匹配的次数。
        doc_form:
          type: string
          description: >-
            文档分块模式。`text_model` 表示标准文本分块，`hierarchical_model` 表示父子结构，`qa_model`
            表示问答对提取。
        doc_metadata:
          type: array
          description: 分配给该文档的元数据值。
          items:
            type: object
            properties:
              id:
                type: string
                description: 元数据字段标识符。
              name:
                type: string
                description: 元数据字段名称。
              type:
                type: string
                description: 元数据字段值类型。
              value:
                type: string
                description: 此文档的元数据值。
        summary_index_status:
          type: string
          nullable: true
          description: 该文档的摘要索引状态。未配置摘要索引时为 `null`。
        need_summary:
          type: boolean
          description: 是否需要为该文档生成摘要。
  securitySchemes:
    ApiKeyAuth:
      type: http
      scheme: bearer
      bearerFormat: API_KEY
      description: >-
        API Key 认证。对于所有 API 请求，请在 `Authorization` HTTP 头中包含您的 API Key，并加上
        `Bearer ` 前缀。示例：`Authorization: Bearer {API_KEY}`。**强烈建议将 API Key
        存储在服务端，不要在客户端共享或存储，以避免 API Key 泄漏导致严重后果。**

````
