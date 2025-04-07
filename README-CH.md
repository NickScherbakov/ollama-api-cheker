# Ollama API 检查器 (ollama-api-cheker)

一个通过便捷的网页界面测试和与 Ollama API 服务器交互的工具。该项目由一个 Node.js 代理服务器和一个用于测试各种 Ollama API 端点的 HTML 页面组成。

![Ollama API 检查器界面](pic01.jpg)

## 项目描述

Ollama API 检查器提供了一个用户界面，用于与 Ollama API 交互，允许您：

- 测试与 Ollama 服务器的连接
- 查看可用模型列表
- 使用选定的模型生成文本
- 通过聊天界面与模型交互

## 特点

- **代理服务器**：解决从浏览器访问 Ollama API 时的 CORS 问题
- **可自定义 API URL**：能够连接到不同主机上的 Ollama 服务器
- **两种操作模式**：
  - **聊天**：与 AI 模型进行交互式聊天
  - **API 测试**：直接测试 API 调用
- **暗色/亮色主题**：支持暗色和亮色用户界面主题
- **流式响应处理**：正确处理来自 Ollama API 的流式 JSON 响应

![与模型的聊天界面演示](pic02.jpg)

![暗色主题界面](pic03.jpg)

## 技术细节

### 项目结构

- `server.js` - Node.js 代理服务器
- `ollama-test.html` - 带有用户界面的 HTML 页面
- `README.md` - 项目文档

### 工作原理

1. Node.js 服务器在端口 3000 上运行
2. 带有 `/api/` 前缀的请求被代理到 Ollama 服务器（默认：http://localhost:11434）
3. 对于 `/api/generate` 端点，流式响应被处理并汇编成单一响应
4. 网页提供了一个用于与 API 交互的图形界面

### API 端点

支持以下 API 端点：
- `/api/version` - 检查 Ollama 版本
- `/api/tags` - 获取可用模型列表
- `/api/generate` - 使用选定的模型生成文本

## 运行

1. 在本地机器或远程服务器上安装 Ollama
2. 克隆此存储库
3. 启动 Node.js 服务器：
```bash
node server.js
```
4. 打开浏览器并访问：http://localhost:3000

## 配置

默认情况下，项目配置为使用地址为 http://localhost:11434 的 Ollama API，但您可以在应用程序界面中更改 URL。

## 要求

- Node.js
- 运行中的 Ollama 服务器