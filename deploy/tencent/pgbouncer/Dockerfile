# 本地/国内构建：基础镜像走 docker.1ms.run 加速；不依赖 Docker Hub 上的 edoburu/pgbouncer。
ARG BASE_IMAGE=docker.1ms.run/library/alpine:3.20
FROM ${BASE_IMAGE}
RUN apk add --no-cache pgbouncer netcat-openbsd \
  && mkdir -p /etc/pgbouncer
# Alpine 的 pgbouncer 包不一定写入 passwd；显式建用户供 USER 指令使用。
RUN adduser -D -H -S -u 1000 pgbouncer 2>/dev/null || true
USER pgbouncer
EXPOSE 6432
CMD ["pgbouncer", "/etc/pgbouncer/pgbouncer.ini"]
