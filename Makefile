# 根目录快捷命令:不用进子目录,直接在 monorepo 顶层操作
# 用法:make help

.PHONY: help dev site-build test build run package

help: ## 列出所有可用命令
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  make \033[36m%-10s\033[0m %s\n", $$1, $$2}'

dev: ## 启动 site 开发服务器(Vite,改代码热更新)
	cd site && npm run dev

site-build: ## 构建 site 生产产物(输出到 site/dist)
	cd site && npm run build

test: ## 运行 app 的 Swift 单元测试
	cd app && swift test

build: ## 编译 app(debug)
	cd app && swift build

run: ## 直接运行 app
	cd app && swift run mie-iconner

package: ## 打包 app 为 DMG(输出到 app/dist)
	app/scripts/package-app.sh
