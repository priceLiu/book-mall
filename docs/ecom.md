# AI电商工具箱 (SaaS版) 产品功能设计文档

**文档版本**：2.0  
**目标**：打造一个基于DeepSeek能力的、由157+电商技能驱动的SaaS级AI智能助手，为电商卖家提供专家级咨询和自动化操作能力。

---

## 1. 产品概述

### 1.1 产品定位
一个 **“SaaS化的AI电商分析师与执行助手”**。通过对话界面，利用专业的电商技能框架，为卖家提供从战略诊断到具体运营优化的全链路支持。

### 1.2 核心价值
*   **专业知识普惠**：将顶级电商专家的方法论封装为可调用的"技能"，大幅降低卖家的学习成本和咨询费用。
*   **数据驱动决策**：支持接入卖家自有数据，让AI的建议基于真实业务情况，而非泛泛而谈。
*   **从顾问到代理**：从提供建议，逐步演进到能直接连接电商平台执行操作，成为真正的"自动化运营官"。
*   **SaaS化运营**：多租户架构，统一部署，按需付费，持续迭代。

### 1.3 目标用户
*   **中小电商卖家**：在Amazon、Shopify、Etsy、TikTok Shop等平台销售的卖家
*   **电商运营团队**：需要数据支持和策略建议的运营人员
*   **DTC品牌主**：希望建立自有品牌并实现增长的创业者

---

## 2. SaaS系统架构设计

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层 (Web)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │  对话界面   │  │  技能管理   │  │  数据源管理面板  │   │
│  └─────────────┘  └─────────────┘  └──────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │ WebSocket/SSE
┌───────────────────────────▼─────────────────────────────────┐
│                       API网关层                              │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │  认证鉴权   │  │  限流控制   │  │  路由与负载均衡  │   │
│  └─────────────┘  └─────────────┘  └──────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                      核心业务层                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              对话管理引擎 (核心)                      │   │
│  │  ┌────────────┐  ┌───────────┐  ┌─────────────┐   │   │
│  │  │ 技能路由器 │  │ 提示词构造 │  │ 流式管理器  │   │   │
│  │  └────────────┘  └───────────┘  └─────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────┐  ┌──────────┐  ┌───────────────────┐   │
│  │ 数据增强层   │  │ 技能引擎 │  │ MCP服务器管理器   │   │
│  │ (上传/API)   │  │ (157+)   │  │ (第二阶段)        │   │
│  └──────────────┘  └──────────┘  └───────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                       数据层                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │  用户数据库  │  │  技能索引库 │  │  对话记录存储    │   │
│  └─────────────┘  └─────────────┘  └──────────────────┘   │
│  ┌─────────────┐  ┌──────────────────────────────────┐   │
│  │  API凭证库  │  │  缓存层 (Redis)                  │   │
│  │ (加密存储)  │  └──────────────────────────────────┘   │
│  └─────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 核心数据模型

```python
# 用户模型
class User:
    id: str
    email: str
    company_name: str
    subscription_plan: str  # 'free', 'pro', 'enterprise'
    created_at: datetime
    api_usage: int  # 月度API调用次数

# 技能路由规则
class SkillRoute:
    skill_id: str
    skill_name: str
    keywords: List[str]  # 触发关键词
    platforms: List[str]  # 适用平台
    categories: List[str]  # 分类
    priority: int  # 优先级
    required_data: List[str]  # 所需数据类型
    confidence_score: float  # 匹配置信度

# 对话会话
class Conversation:
    id: str
    user_id: str
    messages: List[Message]
    active_skills: List[str]  # 当前会话激活的技能
    context: dict  # 会话上下文数据
    created_at: datetime
    updated_at: datetime

# 数据源连接
class DataSource:
    id: str
    user_id: str
    platform: str  # 'shopify', 'amazon', 'google_analytics'
    connection_type: str  # 'oauth', 'api_key'
    credentials: dict  # 加密存储
    is_active: bool
    last_sync: datetime
```

---

## 3. 技能路由器算法详解

技能路由器是整个系统的"大脑"，负责将用户的自然语言问题精准路由到最匹配的技能上。以下是完整的算法设计。

### 3.1 路由流程

```
用户输入
    │
    ▼
┌─────────────────────────────────┐
│  步骤1: 意图识别与预处理         │
│  - 实体提取 (平台、产品、指标)   │
│  - 问题类型分类                  │
│  - 去噪和标准化                  │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  步骤2: 技能检索 (多路召回)      │
│  路径A: 关键词匹配               │
│  路径B: 语义相似度 (嵌入向量)    │
│  路径C: 上下文关联               │
│  路径D: 平台/分类过滤            │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  步骤3: 置信度评分与排序         │
│  - 综合加权计算                  │
│  - 优先级调整                    │
│  - 阈值过滤                      │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  步骤4: 多技能协调               │
│  - 确定主技能                    │
│  - 识别辅助技能                  │
│  - 生成技能组合策略              │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  步骤5: 数据需求匹配与验证       │
│  - 检查所需数据是否可用          │
│  - 如不可用，生成数据收集问题    │
└─────────────────────────────────┘
```

### 3.2 核心算法实现

```python
class SkillRouter:
    def __init__(self):
        self.skill_index = self._build_skill_index()
        self.embedding_model = self._load_embedding_model()
        self.cache = RedisCache()
    
    def route(self, user_query: str, context: dict) -> List[SkillRouteResult]:
        """
        主路由方法，返回排序后的技能列表
        """
        # 步骤1: 预处理
        processed_query = self._preprocess_query(user_query)
        entities = self._extract_entities(processed_query)
        query_type = self._classify_query_type(processed_query)
        
        # 步骤2: 多路召回
        candidates = []
        
        # 路径A: 关键词匹配 (快速)
        keyword_matches = self._keyword_search(processed_query)
        candidates.extend(keyword_matches)
        
        # 路径B: 语义匹配 (精准)
        semantic_matches = self._semantic_search(processed_query)
        candidates.extend(semantic_matches)
        
        # 路径C: 上下文关联
        context_matches = self._context_search(context)
        candidates.extend(context_matches)
        
        # 路径D: 平台/分类过滤
        filtered = self._filter_by_entities(candidates, entities)
        
        # 步骤3: 置信度评分
        scored = self._calculate_confidence(
            filtered, 
            processed_query, 
            entities,
            context
        )
        
        # 步骤4: 排序和选择
        sorted_results = sorted(scored, key=lambda x: x.confidence, reverse=True)
        top_results = [r for r in sorted_results if r.confidence > 0.6]
        
        # 步骤5: 多技能协调
        final_results = self._coordinate_skills(top_results, entities, context)
        
        # 步骤6: 数据需求检查
        final_results = self._check_data_availability(final_results, context)
        
        return final_results
    
    def _keyword_search(self, query: str) -> List[Skill]:
        """
        基于关键词的快速检索
        使用倒排索引和TF-IDF算法
        """
        # 实现要点:
        # 1. 为每个技能建立关键词索引 (从SKILL.md提取)
        # 2. 计算查询与每个技能关键词集的匹配度
        # 3. 返回匹配度>阈值的结果
        pass
    
    def _semantic_search(self, query: str) -> List[Skill]:
        """
        基于嵌入向量的语义检索
        使用轻量级嵌入模型
        """
        # 实现要点:
        # 1. 将查询文本转换为向量
        # 2. 在技能向量数据库中搜索最相似的top-K
        # 3. 返回相似度>阈值的结果
        pass
    
    def _calculate_confidence(
        self, 
        skills: List[Skill], 
        query: str, 
        entities: dict,
        context: dict
    ) -> List[ScoredSkill]:
        """
        综合计算置信度评分
        """
        scores = []
        for skill in skills:
            # 因子1: 关键词匹配度 (权重0.3)
            keyword_score = self._calc_keyword_score(skill, query)
            
            # 因子2: 语义相似度 (权重0.4)
            semantic_score = self._calc_semantic_score(skill, query)
            
            # 因子3: 上下文匹配度 (权重0.2)
            context_score = self._calc_context_score(skill, context)
            
            # 因子4: 实体匹配度 (权重0.1)
            entity_score = self._calc_entity_score(skill, entities)
            
            # 综合评分
            total = (
                keyword_score * 0.3 +
                semantic_score * 0.4 +
                context_score * 0.2 +
                entity_score * 0.1
            )
            
            # 优先级调整
            total *= (1 + skill.priority * 0.1)
            
            scores.append(ScoredSkill(skill=skill, confidence=total))
        
        return scores
    
    def _coordinate_skills(
        self, 
        top_skills: List[ScoredSkill], 
        entities: dict,
        context: dict
    ) -> List[ScoredSkill]:
        """
        协调多个技能的使用策略
        """
        if not top_skills:
            return []
        
        # 主技能：最高分
        primary = top_skills[0]
        
        # 辅助技能：与主技能互补且分数>0.7
        secondary = [
            s for s in top_skills[1:] 
            if s.confidence > 0.7 and self._is_complementary(s.skill, primary.skill)
        ]
        
        # 限制辅助技能数量 (最多3个)
        secondary = secondary[:3]
        
        # 重新排序：主技能第一，辅助技能按相关性排列
        result = [primary] + secondary
        
        return result
    
    def _check_data_availability(
        self, 
        skills: List[ScoredSkill], 
        context: dict
    ) -> List[ScoredSkill]:
        """
        检查技能所需数据是否可用
        如不可用，标记需要用户提供
        """
        for skill in skills:
            required_data = skill.skill.required_data
            available_data = context.get('available_data', [])
            
            missing = set(required_data) - set(available_data)
            skill.missing_data = missing
            skill.is_ready = len(missing) == 0
        
        return skills
```

### 3.3 技能索引构建

```python
class SkillIndexBuilder:
    def __init__(self, skills_directory: str):
        self.skills_dir = skills_directory
        self.index = {}
    
    def build_index(self) -> dict:
        """
        构建技能索引
        """
        skills = self._load_all_skills()
        
        for skill in skills:
            self.index[skill.id] = {
                'skill': skill,
                'keywords': self._extract_keywords(skill),
                'embedding': self._generate_embedding(skill),
                'platforms': skill.platforms,
                'categories': skill.categories,
                'required_data': skill.required_data,
                'priority': skill.priority,
                'related_skills': self._find_related_skills(skill, skills)
            }
        
        return self.index
    
    def _extract_keywords(self, skill: Skill) -> List[str]:
        """
        从SKILL.md中提取关键词
        策略:
        1. 标题和描述中的高价值词汇
        2. 平台名称和功能词
        3. 使用TF-IDF提取关键术语
        """
        keywords = []
        
        # 从标题提取
        title_keywords = self._tokenize(skill.title)
        keywords.extend(title_keywords)
        
        # 从描述提取 (使用NLP提取名词短语)
        description_keywords = self._extract_noun_phrases(skill.description)
        keywords.extend(description_keywords)
        
        # 从标签提取
        if skill.tags:
            keywords.extend(skill.tags)
        
        # 去重和过滤
        keywords = list(set(keywords))
        keywords = [k for k in keywords if len(k) > 2]
        
        return keywords
    
    def _generate_embedding(self, skill: Skill) -> np.ndarray:
        """
        生成技能的嵌入向量
        使用预训练模型 (如sentence-transformers)
        """
        text = f"{skill.title} {skill.description} {' '.join(skill.tags)}"
        return self.embedding_model.encode(text)
```

### 3.4 路由缓存策略

```python
class RouteCache:
    def __init__(self):
        self.cache = {}
        self.ttl = 3600  # 1小时
    
    def get_route(self, query_hash: str) -> List[str]:
        """获取缓存的路由结果"""
        if query_hash in self.cache:
            cached = self.cache[query_hash]
            if cached['timestamp'] + self.ttl > time.time():
                return cached['result']
        return None
    
    def set_route(self, query_hash: str, skill_ids: List[str]):
        """缓存路由结果"""
        self.cache[query_hash] = {
            'result': skill_ids,
            'timestamp': time.time()
        }
```

---

## 4. MCP服务器设计方案 (第二阶段开发)

MCP (Model Context Protocol) 服务器让AI从"分析顾问"升级为"执行代理"。以下是一个标准化的MCP服务器设计方案。

### 4.1 MCP服务器架构

```
┌─────────────────────────────────────────────────────────────┐
│                      MCP服务器集群                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌─────────────────────────────┐    │
│  │  MCP核心引擎      │  │  工具注册中心              │    │
│  │  - 协议处理      │  │  - 工具发现                │    │
│  │  - 认证管理      │  │  - 版本管理                │    │
│  │  - 会话管理      │  │  - 热加载                  │    │
│  └──────────────────┘  └─────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ 平台适配器   │  │ 平台适配器   │  │ 平台适配器   │   │
│  │ (Shopify)    │  │ (Amazon)     │  │ (Etsy)       │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ 安全管控     │  │ 审计日志     │  │ 执行监控     │   │
│  │ - 权限检查   │  │ - 操作记录   │  │ - 异常告警   │   │
│  │ - 限流控制   │  │ - 回溯追踪   │  │ - 性能监控   │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 MCP工具定义规范

每个MCP工具需要遵循以下标准定义格式：

```json
{
  "tool_id": "shopify_update_product_price",
  "name": "更新Shopify产品价格",
  "description": "更新指定Shopify产品的销售价格和对比价格",
  "version": "1.0.0",
  "platform": "shopify",
  "category": "product_management",
  "risk_level": "medium",  // low, medium, high
  "requires_approval": true,
  
  "input_schema": {
    "type": "object",
    "properties": {
      "product_id": {
        "type": "string",
        "description": "Shopify产品ID"
      },
      "price": {
        "type": "number",
        "description": "新的销售价格"
      },
      "compare_at_price": {
        "type": "number",
        "description": "对比价格(可选)"
      }
    },
    "required": ["product_id", "price"]
  },
  
  "output_schema": {
    "type": "object",
    "properties": {
      "success": {"type": "boolean"},
      "updated_product": {"type": "object"},
      "message": {"type": "string"}
    }
  },
  
  "error_handling": {
    "retry_policy": {
      "max_retries": 3,
      "backoff_factor": 2
    },
    "timeout": 30
  }
}
```

### 4.3 MCP服务器核心实现

```python
class MCPServer:
    """MCP服务器核心实现"""
    
    def __init__(self):
        self.tools = {}
        self.platforms = {}
        self.auth_manager = AuthManager()
        self.session_manager = SessionManager()
        self.audit_logger = AuditLogger()
        self.rate_limiter = RateLimiter()
        self.confirmation_manager = ConfirmationManager()
    
    def register_tool(self, tool_def: dict, handler: callable):
        """注册一个MCP工具"""
        tool_id = tool_def['tool_id']
        self.tools[tool_id] = {
            'definition': tool_def,
            'handler': handler,
            'metrics': {'calls': 0, 'success': 0, 'error': 0}
        }
    
    async def execute_tool(
        self, 
        tool_id: str, 
        user_id: str, 
        params: dict,
        session_id: str
    ) -> dict:
        """
        执行MCP工具
        包含完整的管控链路
        """
        # 1. 验证工具是否存在
        if tool_id not in self.tools:
            return self._error_response("Tool not found")
        
        tool = self.tools[tool_id]
        
        # 2. 认证检查
        if not self.auth_manager.verify_user(user_id):
            return self._error_response("Authentication failed")
        
        # 3. 权限检查
        if not self._check_permissions(user_id, tool_id):
            return self._error_response("Insufficient permissions")
        
        # 4. 限流检查
        if not self.rate_limiter.check(user_id, tool_id):
            return self._error_response("Rate limit exceeded")
        
        # 5. 高风险操作需要用户确认
        if tool['definition']['risk_level'] == 'high' or tool['definition']['requires_approval']:
            approved = await self.confirmation_manager.request_confirmation(
                user_id, session_id, tool_id, params
            )
            if not approved:
                return self._error_response("Operation rejected by user")
        
        # 6. 参数验证
        if not self._validate_params(tool['definition']['input_schema'], params):
            return self._error_response("Invalid parameters")
        
        # 7. 执行工具
        try:
            result = await self._execute_with_retry(
                tool['handler'], 
                params, 
                tool['definition']['error_handling']
            )
            
            # 记录成功
            self.audit_logger.log(
                user_id, tool_id, params, result, status='success'
            )
            return self._success_response(result)
            
        except Exception as e:
            # 记录失败
            self.audit_logger.log(
                user_id, tool_id, params, str(e), status='error'
            )
            return self._error_response(str(e))
    
    async def _execute_with_retry(self, handler, params, error_config):
        """带重试的执行逻辑"""
        max_retries = error_config.get('retry_policy', {}).get('max_retries', 1)
        backoff = error_config.get('retry_policy', {}).get('backoff_factor', 1)
        timeout = error_config.get('timeout', 30)
        
        for attempt in range(max_retries):
            try:
                return await asyncio.wait_for(
                    handler(params), 
                    timeout=timeout
                )
            except Exception as e:
                if attempt == max_retries - 1:
                    raise
                await asyncio.sleep(backoff ** attempt)
```

### 4.4 具体平台适配器示例

```python
class ShopifyAdapter:
    """Shopify平台适配器"""
    
    def __init__(self):
        self.client = None
        self.scopes = [
            'read_products', 'write_products',
            'read_orders', 'write_orders',
            'read_inventory', 'write_inventory'
        ]
    
    def initialize(self, access_token: str, shop_domain: str):
        """初始化Shopify客户端"""
        self.client = ShopifyClient(
            shop_domain=shop_domain,
            access_token=access_token,
            api_version='2024-01'
        )
    
    async def update_product_price(self, params: dict) -> dict:
        """更新产品价格"""
        product_id = params['product_id']
        price = params['price']
        compare_at_price = params.get('compare_at_price')
        
        variant = await self.client.get_variant(product_id)
        variant.price = price
        if compare_at_price:
            variant.compare_at_price = compare_at_price
        
        updated = await variant.save()
        
        return {
            'success': True,
            'updated_product': {
                'id': updated.id,
                'price': updated.price,
                'compare_at_price': updated.compare_at_price
            }
        }
    
    async def create_cart_abandonment_email(self, params: dict) -> dict:
        """创建购物车放弃挽回邮件流"""
        template = params.get('template', 'standard')
        flow_data = {
            'name': 'Abandoned Cart Recovery',
            'trigger': 'cart_abandoned',
            'delay': params.get('delay_minutes', 60),
            'email_template': self._get_template(template),
            'discount_code': params.get('discount_code')
        }
        
        flow = await self.client.create_flow(flow_data)
        return {'flow_id': flow.id, 'status': 'created'}
```

### 4.5 确认管理机制

```python
class ConfirmationManager:
    """操作确认管理"""
    
    def __init__(self):
        self.pending_requests = {}  # session_id -> request
        self.timeout = 300  # 5分钟超时
    
    async def request_confirmation(
        self, 
        user_id: str, 
        session_id: str,
        tool_id: str,
        params: dict
    ) -> bool:
        """请求用户确认高风险操作"""
        
        request_id = str(uuid.uuid4())
        
        # 构造确认请求
        request = {
            'request_id': request_id,
            'user_id': user_id,
            'session_id': session_id,
            'tool_id': tool_id,
            'params': params,
            'status': 'pending',
            'created_at': time.time()
        }
        
        self.pending_requests[session_id] = request
        
        # 通过WebSocket推送到前端
        await self._send_confirmation_request(session_id, request)
        
        # 等待用户响应
        try:
            response = await asyncio.wait_for(
                self._wait_for_response(request_id),
                timeout=self.timeout
            )
            return response['approved']
        except asyncio.TimeoutError:
            return False
        finally:
            del self.pending_requests[session_id]
    
    async def confirm_request(self, request_id: str, approved: bool):
        """用户确认或拒绝"""
        for session_id, request in self.pending_requests.items():
            if request['request_id'] == request_id:
                request['status'] = 'approved' if approved else 'rejected'
                request['timestamp'] = time.time()
                break
```

### 4.6 审计日志系统

```python
class AuditLogger:
    """完整的审计日志系统"""
    
    def __init__(self):
        self.db = Database()
        self.alert_thresholds = {
            'high_risk_operations': 3,
            'failed_attempts': 5,
            'unusual_hours': True
        }
    
    def log(
        self, 
        user_id: str, 
        tool_id: str, 
        params: dict,
        result: Any,
        status: str
    ):
        """记录审计日志"""
        
        log_entry = {
            'timestamp': datetime.utcnow(),
            'user_id': user_id,
            'tool_id': tool_id,
            'params': self._sanitize_params(params),  # 移除敏感信息
            'result': self._format_result(result),
            'status': status,
            'ip': self._get_client_ip(),
            'session_id': self._get_session_id()
        }
        
        # 保存到数据库
        self.db.audit_logs.insert_one(log_entry)
        
        # 触发告警检查
        self._check_alerts(log_entry)
    
    def _sanitize_params(self, params: dict) -> dict:
        """移除敏感参数"""
        sensitive_keys = ['api_key', 'access_token', 'password']
        sanitized = params.copy()
        for key in sensitive_keys:
            if key in sanitized:
                sanitized[key] = '***REDACTED***'
        return sanitized
    
    def _check_alerts(self, log_entry: dict):
        """检查是否需要告警"""
        # 高风险操作监控
        if self._is_high_risk_tool(log_entry['tool_id']):
            self._increment_counter(f'high_risk:{log_entry["user_id"]}')
            
            if self._get_counter(f'high_risk:{log_entry["user_id"]}') > self.alert_thresholds['high_risk_operations']:
                self._send_alert(log_entry['user_id'], '高风险操作过多')
        
        # 失败尝试监控
        if log_entry['status'] == 'error':
            self._increment_counter(f'failed:{log_entry["user_id"]}')
            
            if self._get_counter(f'failed:{log_entry["user_id"]}') > self.alert_thresholds['failed_attempts']:
                self._send_alert(log_entry['user_id'], 'API调用失败次数过多')
```

---

## 5. 用户界面与交互设计

### 5.1 对话界面布局

```
┌──────────────────────────────────────────────────────────────┐
│  AI电商工具箱                                          [设置] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  🤖 助手  正在分析您的店铺数据...                   │   │
│  │  根据您的Shopify销售数据，我发现以下优化机会：      │   │
│  │  • 购物车放弃率为68%，高于行业平均(62%)             │   │
│  │  • 建议启用购物车放弃挽回邮件序列                   │   │
│  │  • 预计可挽回5-8%的流失订单                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  👤 用户  我该怎么设置购物车放弃挽回？              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ⚡ 正在调用技能: ecommerce-email-marketing-builder         │
│  ⚡ 已连接数据源: Shopify店铺 [My Store]                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  🤖 助手  已为您设计好邮件挽回流程！                │   │
│  │  建议采用以下三步序列：                            │   │
│  │  1小时: 温和提醒 (打开率最高)                      │   │
│  │  24小时: 展示产品优势 + 用户评价                   │   │
│  │  48小时: 提供10%折扣作为最后机会                   │   │
│  │                                                   │   │
│  │  [🚀 一键创建此邮件流程]  [✏️ 自定义修改]          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  [输入框...]                              [发送] [上传]│   │
│  └──────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────┤
│  技能: 📊 增长策略 | 📧 邮件营销 | 💰 定价分析            │
│  数据源: 🔗 Shopify已连接 | 📁 上传文件(2)                 │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 数据源管理界面

```
┌──────────────────────────────────────────────────────────────┐
│  数据源管理                                                 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  已连接的平台                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  🛍️ Shopify                                    已连接 │   │
│  │  店铺: mystore.myshopify.com                         │   │
│  │  连接时间: 2026-07-15                               │   │
│  │  数据权限: 产品/订单/客户                           │   │
│  │  [刷新数据]  [断开连接]                             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  📦 Amazon Seller Central                     已连接 │   │
│  │  市场: US, UK, DE                                   │   │
│  │  连接时间: 2026-07-20                               │   │
│  │  数据权限: 订单/FBA库存/广告                        │   │
│  │  [刷新数据]  [断开连接]                             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  [+ 连接新平台]                                             │
│                                                              │
│  手动上传的数据文件                                         │
│  📄 sales_2026_Q3.csv (1.2MB)    [查看] [删除]             │
│  📄 competitor_prices.xlsx (256KB) [查看] [删除]            │
│                                                              │
│  [+ 上传新文件]                                             │
└──────────────────────────────────────────────────────────────┘
```

### 5.3 技能管理界面

```
┌──────────────────────────────────────────────────────────────┐
│  技能库 (157个技能)                                         │
├──────────────────────────────────────────────────────────────┤
│  [搜索技能...]                        [分类] [平台] [状态]   │
│                                                              │
│  📊 增长与扩张 (16)                                        │
│  ├── ⭐ ecommerce-growth-strategy   ✅ 已安装              │
│  │   └── 战略增长顾问 - 基于单位经济学制定增长计划        │
│  ├── cross-border-ecommerce         ✅ 已安装              │
│  │   └── 跨境电商 - 国际市场评估与合规                   │
│  └── ...                                                  │
│                                                              │
│  💰 定价与盈利 (7)                                         │
│  ├── profit-margin-calculator-shopify  ✅ 已安装           │
│  │   └── Shopify利润计算器 - 含广告成本和LTV分析          │
│  ├── competitive-pricing-strategy     ✅ 已安装            │
│  │   └── 竞争定价策略 - 价格架构与动态定价               │
│  └── ...                                                  │
│                                                              │
│  📣 营销与广告 (16)                                        │
│  ├── ecommerce-email-marketing-builder  ✅ 已安装          │
│  ├── tiktok-influencer-marketing       ✅ 已安装           │
│  └── ...                                                  │
│                                                              │
│  [刷新技能]  [查看所有技能详情]                             │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. 部署与运维方案

### 6.1 云原生部署架构

```yaml
# docker-compose.yml (生产环境)
version: '3.8'

services:
  # 前端服务
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    environment:
      - API_URL=https://api.ecom-agent.com
    depends_on:
      - backend
  
  # 后端API服务
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
      - MONGODB_URI=mongodb://mongodb:27017/ecom_agent
      - REDIS_URL=redis://redis:6379
      - MCP_SERVER_URL=http://mcp-server:9000
    depends_on:
      - mongodb
      - redis
      - mcp-server
    deploy:
      replicas: 3
  
  # MCP服务器
  mcp-server:
    build: ./mcp-server
    ports:
      - "9000:9000"
    environment:
      - PLATFORM_CREDENTIALS_PATH=/credentials
      - LOG_LEVEL=INFO
    volumes:
      - ./credentials