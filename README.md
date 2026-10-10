# 角色蒸馏 Demo

这是一个**蒸馏角色的 Demo**：演示如何从基础信息、聊天样本、共同记忆和图片说明中提炼角色资料，再通过网页或 Skill 与 AI 角色聊天。初始角色“小禾”和全部记忆均为虚构示例。

当前使用角色设定与上下文提示实现模拟，尚未进行模型训练意义上的知识蒸馏或微调。

项目通过 Node.js 服务启动，可用于 Windows、macOS 和 Linux。需要 Node.js 20 或以上版本；当前只使用 Node.js 内置模块，没有第三方运行依赖，可以直接运行。

## 运行

在终端进入项目文件夹，启动服务：

```sh
cd ai-character
npm start
```

也可以直接运行：

```sh
node server.mjs
```

浏览器打开 http://127.0.0.1:3210 ，先体验聊天，再进入“整理角色资料”编辑角色并保存。服务运行期间保留终端；按 `Ctrl+C` 停止服务。实际项目文件夹名称不同时，调整 `cd` 后的路径。

没有配置 API 时是**离线规则演示，并非真实 AI**。它只有少量固定回复，不能自由推理，也不会完整模仿编辑后的语气。真正的角色对话需完成下面的配置。

## 接入真正的 AI

1. 将 `.env.example` 复制为 `.env`，用文本编辑器打开。
2. 填入 `API_KEY` 和你账号可用的 `MODEL` 名称。
3. `API_BASE_URL` 默认是 `https://api.openai.com/v1`；也可设置支持 Chat Completions 的兼容服务的基础地址，通常以 `/v1` 结尾，不要包含 `/chat/completions`。
4. 按 `Ctrl+C` 停止服务，再执行 `npm start`。页面将显示“AI 接口已配置”；第一条真实请求才能验证密钥及模型可用性。

```ini
API_BASE_URL=https://api.openai.com/v1
API_KEY=填写你自己的密钥
MODEL=填写账号可用的模型名称
PORT=3210
```

密钥只在本地服务读取，不发给网页，也不会包含在角色导出文件中。不要把 `.env` 分享给别人。真实 AI 模式会把角色资料和最近最多 39 条对话发送到所配置的模型服务，可能产生 API 费用。本项目不会自行申请密钥或调用付费模型。

接口格式依据：[OpenAI Create chat completion 官方文档](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)。不同兼容服务的模型或参数支持可能不同。

## 把示例改成自己的资料

按 `templates/preparation-guide.md` 操作。先做一页人物设定、30 段对话样本和 10 条记忆。资料较少时可先做 3 段样本与 2 条记忆。

推荐在网页里编辑：

- **称呼与起始关系**：使用虚构称呼，明确选定历史阶段或虚构关系。
- **基础事实**：兴趣、生活习惯、确定的经历。对性格的解读单独标记。
- **表达习惯**：句长、常用词、表情、如何关心人、如何表达分歧。
- **共同记忆**：事件、时间、明确说过的话、来源、确定程度。
- **对话样本**：保留上下文，并标注关系阶段和情境。
- **图片说明**：图片编号、场景、关联事件；不要从外貌推断心理。
- **角色规则**：未知就说明不确定，不声称知道本人当前的生活或感情。

保存后写入 `data/character.json`；未保存时读取 `data/character.example.json`。重启无需重新填写。也可以直接编辑 JSON，注意保持字段齐全。导入 JSON 只填入表单，点击保存后才生效。导出角色导出的是当前表单，包括未保存的修改。

资料中可识别的个人信息和私密内容应先取得对方同意；未获得同意时，使用去身份化资料构建虚构角色。排除第三方隐私及私密照片。

## 图片与聊天记录

- 本地头像只在浏览器内预览，刷新后消失，不上传到服务端或模型。
- 本版不进行图片识别，用“图片说明”提供文字场景与记忆关联。
- 对话只存在当前页面内存，刷新、关闭页面或点击清空即移除。需要留存时点击“导出对话”。
- 新聊天不会自动写入历史记忆。角色资料会整体放入模型上下文；没有向量检索或模型微调，超大聊天记录需先筛选整理。
- 更换角色时建议清空旧对话，避免旧角色上下文干扰。

## 直接调用角色 Skill

项目中的 `skills/ai-character-chat/` 封装了角色设定与资料快照。安装到支持 Skill 的助手环境后，可以调用：

```text
使用 $ai-character-chat 和我聊天，今天有点累。
```

Skill 直接让当前助手依据资料进入角色，无需启动网页或配置 API。它使用 `references/character.json` 快照；以后修改网页资料时，需把保存后的 `data/character.json` 同步到已安装 Skill 的 `references/character.json` 才会更新角色。

## 项目结构

```text
ai-character/
├── README.md
├── .env.example
├── package.json
├── server.mjs                本机 HTTP 服务、资料保存、模型接口
├── public/                   聊天界面、资料表单
├── data/
│   ├── character.example.json  虚构示例
│   └── character.json          保存后生成的资料
├── templates/                 整理步骤与空白模板（英文文件名）
├── skills/ai-character-chat/  可复用的角色聊天 Skill
└── tests/                    本地集成检查，不调用付费模型
```

## 开发检查

在项目目录中运行：

```sh
npm run check
npm test
```

也可直接执行 `node --check server.mjs`、`node --check public/app.js` 和 `node --test tests/app.test.mjs`。

如果端口被占用，先停止先前启动的服务，或修改 `.env` 的 `PORT` 并重启。改成其他端口后，浏览器也要打开对应地址；启动日志会显示实际访问地址。服务仅监听本机 `127.0.0.1`。
