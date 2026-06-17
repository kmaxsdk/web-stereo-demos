# three-stereo-demo

这是 `@kmax/three-stereo` SDK 的最小 Three.js 示例，用来展示 Kmax 立体显示、追踪数据接入和触控笔射线交互。

## 开发

```powershell
npm run dev:three-stereo
```

## 构建

```powershell
npm run build:three-stereo
```

Demo 入口是 `index.js`，页面入口是 `index.html`。业务代码只需要从 `@kmax/three-stereo` 导入 SDK API，不需要关心内部 WASM 资源。
