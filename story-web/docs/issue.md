1. TS 两条报错都在 app/api/story/model-config/route.ts:28 与 app/api/story/space/route.ts:30——这两个文件本期没改，都是 next-auth session.user 类型与 Prisma User.name 的 string | null | undefined vs string | null 老问题，与本次 schema 改动无关（我只加了 storyProjects 反向关系，不影响 name 字段类型）。等 B1 走 PR 时可顺手补 ??= 收敛。

2. 没有引用，可以删掉死代码