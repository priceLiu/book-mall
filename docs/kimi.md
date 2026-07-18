一、Kimi 是国产大模型
 
Kimi 属于纯正国产大模型，主体信息：
 
1. 开发公司：北京月之暗面科技有限公司（Moonshot AI），注册地、总部在北京，是国内本土AI创业公司 。
2. 创始人杨植麟来自清华大学交叉信息研究院，核心团队以国内科研人员为主，自研整套 Moonshot 大模型底座，并非套壳海外GPT/Claude。
3. 服务器、算力、合规部署均在国内运营，面向全球但主体归属中国企业，是国内头部长文本大模型代表产品。
4. 区分：ChatGPT（美国OpenAI）、Claude（美国Anthropic）是海外模型，Kimi、文心一言、通义千问都属于国产大模型。
 
二、Kimi（Moonshot）API 完整调用指南
 
官方开放平台：platform.kimi.com（Moonshot 开放平台），API 完全兼容 OpenAI 接口格式，接入门槛很低。
 
1、前置准备
 
步骤1：注册并获取 API Key
 
1. 打开官网：https://platform.kimi.com
2. 使用手机号登录（和网页版Kimi账号互通）
3. 进入控制台 → API Keys，新建密钥，复制保存 sk-xxxx 格式密钥，严禁泄露、不要硬编码进代码。
 
基础接入信息
 
- 官方接口地址： https://api.moonshot.cn/v1 
- 主流可用模型（2026最新）：
-  kimi-k3 （最新旗舰，超长上下文、多模态）
-  moonshot-v1-128k 、 moonshot-v1-32k 、 moonshot-v1-8k 
- 带 vision 后缀的版本支持图片识图
 
2、三种主流调用方式
 
方式1：cURL 原生HTTP调用（任意语言通用）
 
bash
  
export MOONSHOT_API_KEY="你的sk密钥"

curl https://api.moonshot.cn/v1/chat/completions \
-H "Authorization: Bearer $MOONSHOT_API_KEY" \
-H "Content-Type: application/json" \
-d '{
    "model": "kimi-k3",
    "messages": [
        {"role": "user", "content": "你好，介绍下自己"}
    ]
}'
 
 
方式2：Python（使用OpenAI官方SDK，最常用）
 
因为协议完全对齐OpenAI，直接复用openai包即可：
 
python
  
# 安装依赖
# pip install --upgrade "openai>=1.0"

import os
from openai import OpenAI

# 初始化客户端
client = OpenAI(
    api_key="你的sk密钥",
    base_url="https://api.moonshot.cn/v1"
)

# 发起对话调用
resp = client.chat.completions.create(
    model="kimi-k3",
    messages=[{"role": "user", "content": "写一段茶器文案"}]
)

print(resp.choices[0].message.content)
 
 
方式3：Node.js
 
javascript
  
const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: "你的sk密钥",
  baseURL: "https://api.moonshot.cn/v1"
});

async function run() {
  const res = await client.chat.completions.create({
    model: "kimi-k3",
    messages: [{ role: "user", content: "测试调用" }]
  });
  console.log(res.choices[0].message.content);
}
run();
 
 
3、关键补充说明
 
1. 计费：按token计费，开放平台控制台可查看余额、用量账单，新用户一般有赠送额度。
2. 长文本优势：moonshot-v1-128k、kimi-k3 支持百万字上下文，非常适合文档解析、知识库场景。
3. 多模态： moonshot-v1-8k-vision-preview 、kimi-k3 支持传入图片URL做图文理解。
4. 官方文档地址：https://platform.kimi.com/docs/api/overview
 
需要我给你一份可直接运行的 Python长文件读取

