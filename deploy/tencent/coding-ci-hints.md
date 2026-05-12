# CODING / 其它 CI 对接提示

若你使用的是腾讯云 **控制台全自动构建部署**（关联仓库后仅配置目录与环境变量即可），**不必**阅读本文；环境变量在控制台填写即可。

本文适用于：**自建 CODING 流水线、自建 Runner、或要自己写 Shell 打镜像再推 TCR** 的情况。

---

- 构建：`docker compose build`（或分别 `docker build -f book-mall/Dockerfile book-mall` 等）
- 启动：`docker compose up -d`

在 **腾讯云 CODING** 中一般为：

1. 新建构建计划，关联本 Git 仓库。  
2. 构建节点安装 Docker（或使用官方 Docker 构建镜像）。  
3. 增加「执行 Shell」步骤：`docker compose build`，再将镜像推送到 **容器镜像服务 TCR**（或使用云托管直接从 Dockerfile 构建）。  
4. 部署阶段：在云主机执行 `docker compose pull && docker compose up -d`，或在云托管发布新版本。

两条服务的环境变量建议在 **控制台「应用配置」** 或 **SSH 下发 `deploy/tencent/book-mall.env`、`deploy/tencent/tool-web.env`**，勿把真实密钥写入 Git。
