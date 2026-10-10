// 由 guide-writer 生成（task-3）：术语表 / FAQ / 工作流 / 来源的结构化镜像。
// 页面（workflows.html / faq.html / sources.html）为静态 HTML，不依赖本文件；本文件仅供审计与二次开发。
// 事实来源：ComfyUI 官方文档（docs.comfy.org）与用户公开节点数据集 节点数据集 导出。
window.CW_CONTENT = {
  "meta": {
    "title": "ComfyUI 节点离线百科 · 内容镜像（content-data.js）",
    "compiledAt": "2026-10-10",
    "note": "本文件是 workflows.html / faq.html / sources.html 所述内容的结构化只读镜像，供审计与二次开发使用；页面运行不依赖它。所有事实来源见 sources 字段与 sources.html。",
    "license": "ComfyUI 代码为 GPL-3.0；节点说明引用自 ComfyUI 官方文档（AI 生成，需人工复核）。",
    "generatedFrom": {
      "docsIndex": "vendor/docs/node-index.json（1032 条）",
      "localObjectInfo": "节点数据集快照（1459 个节点，采集时间 2026-10-10T01:09:24.125Z）",
      "zhDocs": "vendor/docs/nodes/zh/*.md（1032 篇）",
      "sourceTree": "vendor/src/ComfyUI-master/"
    }
  },
  "workflows": [
    {
      "id": "t2i",
      "title": "文生图",
      "nodes": [
        "CheckpointLoaderSimple",
        "CLIPTextEncode",
        "EmptyLatentImage",
        "KSampler",
        "VAEDecode",
        "SaveImage"
      ]
    },
    {
      "id": "i2i",
      "title": "图生图",
      "nodes": [
        "CheckpointLoaderSimple",
        "LoadImage",
        "VAEEncode",
        "CLIPTextEncode",
        "KSampler",
        "VAEDecode",
        "SaveImage"
      ]
    },
    {
      "id": "inpaint",
      "title": "局部重绘",
      "nodes": [
        "CheckpointLoaderSimple",
        "LoadImage",
        "VAEEncodeForInpaint",
        "CLIPTextEncode",
        "KSampler",
        "VAEDecode",
        "SaveImage",
        "InpaintModelConditioning"
      ]
    },
    {
      "id": "outpaint",
      "title": "扩图",
      "nodes": [
        "LoadImage",
        "ImagePadForOutpaint",
        "VAEEncodeForInpaint",
        "KSampler",
        "VAEDecode",
        "SaveImage"
      ]
    },
    {
      "id": "upscale",
      "title": "高清放大",
      "nodes": [
        "LoadImage",
        "UpscaleModelLoader",
        "ImageUpscaleWithModel",
        "SaveImage",
        "ImageScaleBy",
        "ImageScaleToTotalPixels"
      ]
    },
    {
      "id": "lora",
      "title": "LoRA",
      "nodes": [
        "CheckpointLoaderSimple",
        "LoraLoader",
        "CLIPTextEncode",
        "KSampler",
        "VAEDecode",
        "SaveImage",
        "LoraLoaderModelOnly"
      ]
    },
    {
      "id": "controlnet",
      "title": "ControlNet",
      "nodes": [
        "LoadImage",
        "CannyEdgePreprocessor",
        "OpenposePreprocessor",
        "DepthAnythingV2Preprocessor",
        "LineArtPreprocessor",
        "HEDPreprocessor",
        "ControlNetLoader",
        "ControlNetApplyAdvanced",
        "KSampler",
        "VAEDecode",
        "SaveImage",
        "VAELoader"
      ]
    },
    {
      "id": "video",
      "title": "视频工作流",
      "nodes": [
        "UNETLoader",
        "DualCLIPLoader",
        "LoadImage",
        "Wan22ImageToVideoLatent",
        "KSampler",
        "VAEDecode",
        "CreateVideo",
        "SaveVideo",
        "WanFirstLastFrameToVideo",
        "EmptyHunyuanLatentVideo",
        "SaveWEBM",
        "CannyEdgePreprocessor",
        "OpenposePreprocessor",
        "DepthAnythingV2Preprocessor",
        "LineArtPreprocessor",
        "HEDPreprocessor",
        "ControlNetLoader",
        "ControlNetApplyAdvanced",
        "SaveImage",
        "VAELoader"
      ]
    },
    {
      "id": "audio",
      "title": "音频工作流",
      "nodes": [
        "CheckpointLoaderSimple",
        "TextEncodeAceStepAudio",
        "EmptyAceStepLatentAudio",
        "KSampler",
        "VAEDecodeAudio",
        "SaveAudio",
        "LatentOperationTonemapReinhard",
        "LoadAudio",
        "VAEEncodeAudio",
        "CLIPTextEncode",
        "EmptyLatentAudio"
      ]
    },
    {
      "id": "local-packs",
      "title": "已收录的自定义节点包",
      "nodes": [
        "SAMLoader",
        "CLIPSegDetectorProvider",
        "ONNXDetectorProvider",
        "WanVideoDecode",
        "WanVideoTextEncode",
        "WanVideoTextEncodeSingle",
        "Set VAE Decoder Noise",
        "LTXVLinearOverlapLatentTransition",
        "LTXVAddGuideAdvanced",
        "AnimeFace_SemSegPreprocessor",
        "AnyLineArtPreprocessor_aux",
        "BinaryPreprocessor",
        "BiRefNetRMBG",
        "BodySegment",
        "ClothesSegment",
        "VHS_VideoCombine",
        "VHS_LoadVideo",
        "VHS_LoadVideoPath",
        "IPAdapter",
        "IPAdapterAdvanced",
        "IPAdapterBatch",
        "ArgosTranslateCLIPTextEncodeNode",
        "ArgosTranslateTextNode",
        "DeepTranslatorCLIPTextEncodeNode",
        "UnetLoaderGGUF",
        "CLIPLoaderGGUF",
        "DualCLIPLoaderGGUF",
        "UltimateSDUpscale",
        "UltimateSDUpscaleNoUpscale",
        "UltimateSDUpscaleCustomSample",
        "SaveImageWebsocket"
      ]
    }
  ],
  "glossary": [
    {
      "term": "节点（Node）",
      "desc": "ComfyUI 中节点是我们执行任务的单元：无论是 Comfy Core 还是自定义节点，每个节点都是独立模块，节点之间通过连线连接。",
      "source": "https://docs.comfy.org/zh/basic-concepts/nodes.md"
    },
    {
      "term": "连线（Link）",
      "desc": "节点之间绘制的线条或曲线称为连线，把数据从一个节点的输出传输到另一个节点的输入，从而定义工作流的流程。",
      "source": "https://docs.comfy.org/zh/basic-concepts/links.md"
    },
    {
      "term": "端口颜色 / 数据类型",
      "desc": "每种数据类型都有独特的颜色；只能连接相同颜色的端口，以保证类型安全。常见类型：IMAGE、LATENT、MASK、MODEL、CLIP、VAE、CONDITIONING。",
      "source": "https://docs.comfy.org/zh/basic-concepts/links.md"
    },
    {
      "term": "潜空间（Latent / LATENT）",
      "desc": "扩散模型在压缩后的潜空间里运算；EmptyLatentImage 生成具有指定尺寸和批次大小的空白潜空间表示，VAEEncode 把图像编码进潜空间。",
      "source": "https://docs.comfy.org/zh/built-in-nodes/EmptyLatentImage.md"
    },
    {
      "term": "Checkpoint",
      "desc": "真正参与运算的权重文件；CheckpointLoaderSimple 把 checkpoint 拆成 MODEL（主模型）、CLIP（文本编码器）、VAE（图像编解码器）三个输出。放在 ComfyUI/models/checkpoints。",
      "source": "https://docs.comfy.org/zh/built-in-nodes/CheckpointLoaderSimple.md"
    },
    {
      "term": "CLIP",
      "desc": "文本编码器：用 CLIP 模型把提示词编码为嵌入，用来引导扩散模型。",
      "source": "https://docs.comfy.org/zh/built-in-nodes/ClipTextEncode.md"
    },
    {
      "term": "VAE",
      "desc": "图像编码器/解码器：VAEDecode 把 LATENT 解码成图像，VAEEncode 把图像编码成 LATENT。",
      "source": "https://docs.comfy.org/zh/built-in-nodes/VAEDecode.md"
    },
    {
      "term": "CONDITIONING",
      "desc": "CLIPTextEncode 的输出类型，包含用于引导扩散模型的嵌入文本。",
      "source": "https://docs.comfy.org/zh/built-in-nodes/ClipTextEncode.md"
    },
    {
      "term": "种子 seed",
      "desc": "用于生成随机噪声；相同的种子生成相同的图像。默认 0，范围 0~18446744073709551615。",
      "source": "https://docs.comfy.org/zh/built-in-nodes/KSampler.md"
    },
    {
      "term": "步数 steps",
      "desc": "去噪过程中使用的步数，步数越多结果越精确。默认 20，范围 1~10000。",
      "source": "https://docs.comfy.org/zh/built-in-nodes/KSampler.md"
    },
    {
      "term": "cfg",
      "desc": "控制生成图像与输入条件的匹配程度，官方建议 6-8，默认 8.0。",
      "source": "https://docs.comfy.org/zh/built-in-nodes/KSampler.md"
    },
    {
      "term": "采样器 sampler_name",
      "desc": "选择用于去噪的采样器，影响生成速度和风格。",
      "source": "https://docs.comfy.org/zh/built-in-nodes/KSampler.md"
    },
    {
      "term": "调度器 scheduler",
      "desc": "控制噪声的移除方式，影响生成过程。",
      "source": "https://docs.comfy.org/zh/built-in-nodes/KSampler.md"
    },
    {
      "term": "降噪 denoise",
      "desc": "决定噪声移除比例，默认 1.0，范围 0.0~1.0。图生图必须小于 1；等于 1 时潜空间图变为完全随机的噪声；等于 0 时完全不执行采样步。",
      "source": "https://docs.comfy.org/zh/tutorials/basic/image-to-image.md"
    },
    {
      "term": "LoRA",
      "desc": "在预训练模型上引入可训练的低秩矩阵，以较低计算成本实现特定任务的优化；可当作“滤镜”使用。文件放 ComfyUI/models/loras。",
      "source": "https://docs.comfy.org/zh/tutorials/basic/lora.md"
    },
    {
      "term": "ControlNet",
      "desc": "通过引入多模态输入条件（边缘检测图、深度图、姿势关键点等）提升图像生成的可控性和细节还原能力。",
      "source": "https://docs.comfy.org/zh/tutorials/controlnet/controlnet.md"
    },
    {
      "term": "遮罩（Mask）",
      "desc": "指示输入图像中需要修复区域的遮罩；扩展遮罩 grow_mask_by 越大，修复影响的区域越大。",
      "source": "https://docs.comfy.org/zh/built-in-nodes/VAEEncodeForInpaint.md"
    },
    {
      "term": "放大模型（UPSCALE_MODEL）",
      "desc": "UpscaleModelLoader 加载放大模型，ImageUpscaleWithModel 用它放大图像；模型放在 ComfyUI/models/upscale_models。",
      "source": "https://docs.comfy.org/zh/tutorials/basic/upscale.md"
    },
    {
      "term": "工作流模板（Templates）",
      "desc": "ComfyUI 中原生支持的模型工作流及自定义节点提供的模型工作流的浏览窗口。",
      "source": "https://docs.comfy.org/zh/interface/features/template.md"
    },
    {
      "term": "自定义节点",
      "desc": "第三方作者开发的扩展节点；工作流出现“丢失（Missing）”且属于自定义节点时，说明本地未安装，可用 ComfyUI Manager 安装。",
      "source": "https://docs.comfy.org/zh/basic-concepts/nodes.md"
    },
    {
      "term": "节点状态",
      "desc": "正常 / 运行 / 错误（输入有问题，红色标识出错输入）/ 丢失（原生节点丢失多为版本旧，自定义节点丢失为未安装）。",
      "source": "https://docs.comfy.org/zh/basic-concepts/nodes.md"
    },
    {
      "term": "节点数据集",
      "desc": "ComfyUI 后端节点信息接口。本站“已收录”数据来自节点数据集 导出 节点数据集快照（1459 个节点）。",
      "source": "（本地文件 节点数据集快照，本项目来源 S6）"
    }
  ],
  "faq": [
    {
      "q": "运行工作流时某个节点变成红色 / 报错怎么办？",
      "a": "那是节点的错误（Error）状态：运行后若对应节点输入存在问题就会显示该状态并用红色标识出错输入，需要解决出错输入才能正常运行。"
    },
    {
      "q": "拖入工作流后出现“丢失（Missing）”的节点，怎么办？",
      "a": "两种可能：① Comfy Core 原生节点丢失——通常是 ComfyUI 版本较旧，更新即可；② 自定义节点丢失——工作流用了第三方扩展而本地未安装，可用 ComfyUI Manager 查找安装。"
    },
    {
      "q": "为什么有些节点在官方文档里（或在本站）查不到？",
      "a": "官方内置节点文档只覆盖内置节点。数据集还安装了 11 个自定义节点包（共 635 个节点，如 ComfyUI-Impact-Pack 197 个、ComfyUI-WanVideoWrapper 147 个）。这些节点的用途请查阅各自仓库 README，本站只如实展示 节点数据集 中的参数，不描述其功能。"
    },
    {
      "q": "图生图 / 局部重绘生成出来几乎没变化，或者完全变了？",
      "a": "看 denoise：图生图必须小于 1。denoise 越小与参考图差异越小，越大差异越大；等于 1 时潜空间图变为完全随机的噪声，参考图特征全部丢失；只有 0 时才完全不执行采样步。"
    },
    {
      "q": "为什么把 denoise 调低以后，生成反而没有变快？",
      "a": "调低 denoise 不会减少实际执行的采样步数。ComfyUI 按 steps / denoise（向下取整）构建调度表，再保留最后 steps + 1 个 sigma；若要保持步长密度只采样部分噪声区间，把 steps 设为“运行步数 × denoise”。"
    },
    {
      "q": "提示词怎么写才有效？",
      "a": "尽量英文、用英文逗号分隔、尽量用短语、描述更具体；权重写法 (golden hour:1.2)；普通括号 (word) 权重 1.1；\\\\(word\\\\) 表示字面括号；{a|b|c} 为动态提示词；embedding:模型名 引用嵌入模型。"
    },
    {
      "q": "LoRA 加载了但没什么效果，怎么调？多个 LoRA 能一起用吗？",
      "a": "模型强度与 CLIP 强度取值 -100.0~100.0，日常通常 0~1，数值越高效果越明显；多个 LoRA 可把多个 LoraLoader 串联；LoRA 文件放 ComfyUI/models/loras。"
    },
    {
      "q": "ControlNet 要配什么图？为什么找不到预处理器节点？",
      "a": "不同类型的 ControlNet 需要不同类型的参考图；Comfy Core 不包含所有类型的预处理器，常需自定义节点（数据集已装 comfyui_controlnet_aux，64 个节点）。"
    },
    {
      "q": "模型文件应该放在哪个目录？",
      "a": "放到 ComfyUI/models/ 下与类型对应的子文件夹（checkpoints、loras、vae 等）；放大模型放 models/upscale_models；ControlNet 模型放 models/controlnet；放置后按 R 刷新。"
    },
    {
      "q": "生成的音频、视频保存到哪了？",
      "a": "音频保存至 ComfyUI/output/audio（由 Save Audio 节点决定子目录名）；视频由 CreateVideo/SaveVideo 决定，SaveVideo 的 filename_prefix 默认 video/ComfyUI。"
    },
    {
      "q": "找不到教程里说的官方模板，或者提示节点缺失？",
      "a": "模板找不到可能是 ComfyUI 没有更新（建议更新到最新版/每夜版）；节点缺失的另一原因是启动时有些节点导入失败；模板由独立依赖 comfyui-workflow-templates 管理。"
    },
    {
      "q": "官方文档里的中文说明可以直接相信吗？",
      "a": "官方节点文档为 AI 生成（页脚有声明），可能有错。本站对每条内容标注来源，并以节点数据集 的真实参数作为机器可核对的事实；不一致时以官方页面与本地环境为准。"
    },
    {
      "q": "这个网站为什么断网也能用？",
      "a": "纯静态页面：数据以本地 JS 文件提供，不使用 fetch/XHR，不引用 CDN、字体或远程图片，双击 index.html（file://）即可浏览；站外来源链接需要联网。"
    },
    {
      "q": "节点数据集 数据是怎么来的？",
      "a": "来自用户公开节点数据集文件 节点数据集快照（1459 个节点，采集时间 2026-10-10T01:09:24.125Z），包含真实键名、输入类型与默认值、tooltip、输出、category 与 python_module。"
    }
  ],
  "troubleshooting": [
    {
      "item": "更新到最新版",
      "how": "模板找不到、核心节点缺失时，先确认 ComfyUI 是否更新到最新版/每夜版。"
    },
    {
      "item": "确认模型目录并刷新",
      "how": "模型放在 ComfyUI/models/ 对应子目录；放置后按 R 刷新节点列表，再在加载器节点中选择。"
    },
    {
      "item": "检查红色输入",
      "how": "运行后红色标识的就是出错输入，顺着连线检查上游输出类型是否匹配。"
    },
    {
      "item": "区分核心节点缺失与自定义节点缺失",
      "how": "核心节点缺失→更新 ComfyUI；自定义节点缺失→用 ComfyUI Manager 安装对应扩展。"
    },
    {
      "item": "核对采样参数",
      "how": "文生图 denoise=1；图生图与音频到音频 denoise<1；denoise=0 时不采样。"
    },
    {
      "item": "核对参考图与模型匹配",
      "how": "ControlNet 的参考图类型要与模型匹配；放大模型放 models/upscale_models。"
    },
    {
      "item": "显存不足",
      "how": "Wan2.2 5B 配合原生 offloading 可较好适配 8GB 显存；显存充足时可尝试 720P 左右分辨率。"
    }
  ],
  "sources": [
    {
      "id": "S1",
      "name": "官方文档索引 https://docs.comfy.org/_llms/en/built-in-nodes/nodes.md（+model.md/partner.md）",
      "localPath": "vendor/docs/en-builtin-nodes-*.md、vendor/docs/node-index.json",
      "note": "节点清单与英文简介，1032 条"
    },
    {
      "id": "S2",
      "name": "官方中文节点文档 https://docs.comfy.org/zh/built-in-nodes/<Page>.md",
      "localPath": "vendor/docs/nodes/zh/<Page>.md",
      "note": "1032 篇"
    },
    {
      "id": "S3",
      "name": "官方英文节点文档 https://docs.comfy.org/built-in-nodes/<Page>.md",
      "localPath": "vendor/docs/nodes/en/<Page>.md",
      "note": "1032 篇（兜底，本期未用）"
    },
    {
      "id": "S4",
      "name": "官方源码 https://github.com/comfyanonymous/ComfyUI（master）",
      "localPath": "vendor/src/ComfyUI-master/",
      "note": "节点名与注册方式（NODE_CLASS_MAPPINGS / V3 node_id）"
    },
    {
      "id": "S5",
      "name": "官方文档站索引 https://docs.comfy.org/llms.txt",
      "localPath": "vendor/docs/llms.txt",
      "note": "页面发现与教程地址核实"
    },
    {
      "id": "S6",
      "name": "公开节点数据集 节点数据集 导出（SPEC 第 7 节）",
      "localPath": "节点数据集快照",
      "note": "1459 个节点，含自定义节点包 11 个共 635 个节点"
    }
  ]
};
