AI GIF生成器 后端功能设计文档（Node.js 实现版）

> **实施状态**：原始需求稿。可落地的技术方案（HappyHorse 1.1 + FFmpeg、待定）见 **[ecom.gif.solution.md](./ecom.gif.solution.md)**。
 
适配截图前端界面，用于交付AI开发人员编码实现；整体核心逻辑：文本/参考图 → AI生成短视频MP4 → FFmpeg转码优化输出GIF
 
一、项目概述
 
1.1 产品说明
 
前端页面名称：AI GIF生成器
核心机制：后端先调用文生视频模型生成短视频，再通过FFmpeg将视频转码为GIF；不直接由AI模型输出GIF文件。
界面提示原文：
 
请用通俗易懂的语言描述动画；我们会渲染一段短视频，然后将其转换为GIF格式。CogVideoX可在我们的每日免费GPU池上运行。高级版Hailu/Luma可渲染更清晰的细节。2–3秒的视频片段最适合制作GIF格式——更长的视频片段会导致文件更大。
 
1.2 技术栈约定
 
- 运行环境：Node.js
- AI推理：调用远程CogVideoX视频模型、Stable Diffusion XL图生图模型
- 媒体处理：child_process 调用 FFmpeg、gifsicle
- 任务模式：异步队列（防止并发请求耗尽GPU资源）
 
 
 
二、前端请求参数定义（HTTP请求Body）
 
前端所有控件一一映射为JSON结构
 
typescript
  
{
  // 动画类型选择
  animationType: string; 
  // 枚举值：["无缝循环","反应GIF","变形过渡","加载中/旋转图标","动态照片","动画文本"]

  // 提示词
  prompt: string;        // 正向提示词，最大400字符
  negativePrompt: string;// 高级选项：负面提示词

  // 基础生成参数
  duration: string;      // 时长下拉："2 秒 (最小文件)"、"3 秒"
  size: string;          // 尺寸："480像素 (默认值)"
  fps: number;           // 帧率：24
  mainModel: string;     // 视频主模型："CogVideoX – 免费"

  // 图生图相关配置
  refImageModel: string; // 参考图底模："稳定扩散XL（免费）"
  referenceImage?: string; // 参考图片（base64/URL，为空=文生视频，有值=图生视频）
  strength: number;      // 参考图影响强度 0~1
  imageCount: number;    // 并行生成数量，默认1
  seed: string | number; // "随机的" / 数字种子
  aspectRatio: string;   // 长宽比枚举："1:1","16:9","9:16","4:6","3:4","4:3"
}
 
 
参数预处理规则（后端统一转换）
 
1.  duration  文本转为数字： 2 秒 (最小文件)  →  2 ； 3 秒  →  3 
2. 总帧数计算： totalFrames = 时长 * fps 
3. animationType 自动追加至正向Prompt
前端选择 追加Prompt文本 
无缝循环 seamless loop animation，首帧与尾帧画面自然衔接，无限循环 
反应GIF rich expression, vivid local movement 
变形过渡 smooth morph transition between elements 
加载中/旋转图标 simple loop loading spinner graphic 
动态照片(Cinemagraph) 主体静止，仅局部缓慢微动，静态照片微动效果 
动画文本 text animation, clear text 
4. 分辨率计算：根据 size 宽度 +  aspectRatio 自动计算宽高
5. seed处理： 随机的  → 后端自动生成随机整数种子
 
 
 
三、后端完整业务执行流程
 
mermaid
  
graph LR
A[接收前端创建任务请求] --> B[参数合法性校验]
B -->|校验失败| Z[直接返回错误信息]
B -->|校验通过| C[生成唯一taskId，任务入队，返回taskId给前端]
C --> D[队列消费任务：预处理Prompt、组装模型调用参数]
D --> E{是否存在参考图片referenceImage?}
E -->|存在【图生视频I2V】| F[SDXL基于参考图生成首帧画面]
E -->|不存在【文生视频T2V】| G[直接调用CogVideoX]
F --> G
G --> H[CogVideoX生成短视频，输出临时MP4文件]
H --> I[调用FFmpeg，MP4转高质量GIF（调色板优化）]
I --> J[gifsicle压缩GIF，减小文件体积]
J --> K[持久化最终GIF文件，生成访问URL]
K --> L[更新任务状态success]
L --> M[前端轮询查询到结果，加载GIF]
 
 
分步详细说明
 
步骤1 参数校验规则
 
1. prompt 必填，字符上限400；
2. strength存在时，数值区间必须 0 ≤ strength ≤ 1；
3. 长宽比、时长、模型、动画类型必须在枚举范围内；
 
步骤2 AI模型调用链路
 
1. 文生视频（无参考图）
直接推送增强后的Prompt、负面提示词、分辨率、总帧数、seed至CogVideoX服务，输出MP4
2. 图生视频（上传参考图）
① 使用SDXL基于参考图、strength生成基准画面；
② 将基准画面送入CogVideoX执行图生视频，输出MP4
 
步骤3 FFmpeg 视频转GIF核心命令（关键，避免色彩断层）
 
Node.js 通过  child_process  串行执行两条命令
 
bash
  
# 1. 根据视频生成全局最优调色板
ffmpeg -i temp_source.mp4 -vf "fps=【传入帧率】, palettegen=stats_mode=diff" palette_temp.png
# 2. 绑定调色板渲染GIF，开启无限循环loop=0
ffmpeg -i temp_source.mp4 -i palette_temp.png -filter_complex "fps=【传入帧率】[v];[v][1:v] paletteuse=dither=none" raw_output.gif
 
 
步骤4 GIF二次压缩
 
bash
  
gifsicle --optimize=3 raw_output.gif -o final.gif
 
 
步骤5 临时文件清理规则
 
任务结束/任务失败后，自动删除： temp_source.mp4 、 palette_temp.png 、 raw_output.gif ，仅保留最终成品 final.gif 
 
 
 
四、任务状态管理（前后端异步交互）
 
生成耗时较长，不使用同步阻塞接口，采用轮询模式
 
状态枚举
 
-  pending ：任务排队等待执行
-  generating_video ：AI模型正在渲染短视频
-  converting_gif ：FFmpeg正在转码、压缩GIF
-  success ：生成完成
-  failed ：任务失败，附带错误描述
 
五、接口定义（RESTful Node.js）
 
接口1 创建GIF生成任务
 
 POST /api/gif/create 
请求Body：前端完整参数
成功返回：
 
json
  
{
  "code": 200,
  "data": {
    "taskId": "uuid字符串"
  }
}
 
 
接口2 查询任务状态
 
 GET /api/gif/status/:taskId 
✅ 成功示例
 
json
  
{
  "code": 200,
  "data": {
    "status": "success",
    "gifUrl": "shturl.cc/HUcZgz8cpnASq66",
    "params": {
      "duration": 2,
      "fps": 24
    }
  }
}
 
 
❌ 失败示例
 
json
  
{
  "code": 200,
  "data": {
    "status": "failed",
    "message": "AI视频生成超时，请稍后重试"
  }
}
 
 
 
 
六、异常处理清单
 
1. 请求参数不合法 → 400错误，返回具体字段提示
2. AI模型服务调用超时/返回报错 → 任务标记 failed 
3. FFmpeg执行失败（源视频损坏）→ 任务标记 failed ，清理临时文件
4. 文件读写、存储异常 → 回收临时资源，返回错误
5. 队列任务堆积过载 → 拒绝新任务，提示“当前任务繁忙”
 
七、业务约束（来自界面产品提示）
 
1. 推荐时长：2~3秒；前端增加提示，时长越长GIF体积越大
2. 默认画布宽度480px，不建议默认提供更高分辨率
3. 提示词约束：引导用户动作描述简洁，GIF压缩会丢失细节
4. 预留模型扩展字段：后续可接入Hailu、Luma高清视频模型
5. GIF统一设置无限循环  loop=0 
 
八、交付开发备注（直接复制给AI编码）
 
开发要求：基于Node.js实现整套服务
 
1. 使用child_process执行ffmpeg、gifsicle命令；环境提前部署ffmpeg
2. 实现任务队列，限制并发，防止大量请求打满GPU推理服务
3. 任务完成自动清理全部临时中间文件
4. 严格按照本文档参数映射规则，前端参数无缝映射模型入参
5. 转GIF必须使用「palettegen+paletteuse」两段式方案，解决色彩失真
6. 自动区分文生视频、图生视频两条业务链路，依据referenceImage是否存在自动切换
7. animationType自动拼接至正向prompt，不要遗漏
8. 完整实现创建任务、轮询状态两套接口
9. 增加日志输出，记录每个任务的阶段、耗时、错误信息