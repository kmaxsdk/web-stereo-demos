# Kmax Stereo Demos

这是 Kmax 立体显示 SDK 的公开 demo 仓库，包含 Three.js 和 Babylon.js 示例。

## 安装

```powershell
npm install
```

## Three.js Demo

```powershell
npm run dev:three-stereo
```

## Babylon.js Demo

```powershell
npm run dev:babylon-stereo
```

## 构建

```powershell
npm run build
```

Demo 通过 npm 依赖使用 `@kmax/three-stereo` 和 `@kmax/babylon-stereo`。SDK 内部资源由包自身处理，示例代码只展示应用侧接入方式。
