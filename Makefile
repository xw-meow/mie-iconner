# 根目录快捷命令：不用进子目录，直接在 monorepo 顶层操作
# 用法：make help

.PHONY: help dev test test-core test-web lint typecheck build package site-dev site-build site-lint clean

help: ## 列出所有可用命令
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  make \033[36m%-12s\033[0m %s\n", $$1, $$2}'

dev: ## 启动桌面应用（Tauri + Vite，改前端热更新）
	cd app && pnpm tauri dev

test: test-core test-web ## 运行全部测试

test-core: ## 运行 Rust 单元测试
	cd app/src-tauri && cargo test

test-web: ## 运行前端单元测试（Vitest）
	cd app && pnpm test

lint: ## 前端静态检查（oxlint）
	cd app && pnpm lint

typecheck: ## TypeScript 类型检查
	cd app && pnpm typecheck

build: ## 构建 release .app（当前架构）
	cd app && pnpm tauri build --bundles app

package: ## 打包 universal DMG（arm64 + x86_64）
	app/scripts/package.sh

site-dev: ## 启动官网开发服务器
	cd site && npm run dev

site-build: ## 构建官网
	cd site && npm run build

site-lint: ## 官网静态检查
	cd site && npm run lint

clean: ## 清理 Rust 构建产物
	cd app/src-tauri && cargo clean
