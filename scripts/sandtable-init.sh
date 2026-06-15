#!/usr/bin/env bash
#
# sandtable-init.sh — 在当前工作目录初始化 sandtable 工作区
#
# 用法: sandtable-init.sh <slug> [date]
#   <slug>  必填，仅允许 [A-Za-z0-9-]
#   [date]  可选，缺省取 `date +%F`（YYYY-MM-DD）
#
set -euo pipefail

usage() {
	cat >&2 <<'EOF'
用法: sandtable-init.sh <slug> [date]
  <slug>  必填，仅允许字符 [A-Za-z0-9-]（不可含空格、/ : & | . 或中文等）
  [date]  可选，格式 YYYY-MM-DD，缺省取当天
EOF
}

# 当前 ISO8601 时间，时区带冒号（macOS `date +%z` 输出 +0800，需补成 +08:00）。
now_iso8601() {
	local ts
	ts=$(date +%Y-%m-%dT%H:%M:%S%z)
	# 时区恒为 5 字符（±HHMM）：取除末两位外的部分，插入冒号，再接末两位。
	printf '%s:%s\n' "${ts:0:${#ts}-2}" "${ts: -2}"
}

main() {
	# --- 参数与校验（在创建任何文件之前完成）---
	if [[ $# -lt 1 || $# -gt 2 ]]; then
		usage
		exit 2
	fi

	local slug="$1"
	local date="${2:-$(date +%F)}"

	if [[ ! "$slug" =~ ^[A-Za-z0-9-]+$ ]]; then
		usage
		exit 2
	fi

	# --- 定位模板目录（相对脚本自身）---
	local script_dir templates_dir
	script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
	templates_dir="$(dirname "$script_dir")/templates"

	if [[ ! -d "$templates_dir" ]]; then
		echo "错误: 模板目录不存在: $templates_dir" >&2
		exit 1
	fi

	# --- 准备目录 ---
	local root="docs/sandtable"
	local feature_dir="$root/features/${date}-${slug}"

	# feature 目录已存在（文件或目录）即报错，绝不动已有内容。
	if [[ -e "$feature_dir" ]]; then
		echo "错误: feature 已存在: $feature_dir（不覆盖已有内容）" >&2
		exit 1
	fi

	mkdir -p "$root"

	# --- 全局文件：已存在则跳过，绝不覆盖 ---
	local created=()
	local skipped=()
	local f
	for f in project.md constraints.md lessons.md; do
		if [[ -e "$root/$f" ]]; then
			skipped+=("$root/$f")
		else
			cp "$templates_dir/$f" "$root/$f"
			created+=("$root/$f")
		fi
	done

	# --- feature 目录与 6 个模板 ---
	mkdir -p "$feature_dir"
	mkdir -p "$feature_dir/rehearsals"
	created+=("$feature_dir/")
	created+=("$feature_dir/rehearsals/")

	for f in prd.md tests.md plan.md state.md journal.md questions.md; do
		cp "$templates_dir/$f" "$feature_dir/$f"
		created+=("$feature_dir/$f")
	done

	# --- 仅对 state.md 做占位替换 ---
	local updated
	updated=$(now_iso8601)
	local state_file="$feature_dir/state.md"
	local tmp
	tmp=$(mktemp)
	sed \
		-e "s|^feature: .*|feature: ${date}-${slug}|" \
		-e "s|^updated: .*|updated: ${updated}|" \
		"$state_file" >"$tmp"
	mv "$tmp" "$state_file"

	# --- 结尾报告 ---
	echo "已初始化 sandtable 工作区: ${date}-${slug}"
	echo
	echo "创建/复用清单:"
	for f in ${created[@]+"${created[@]}"}; do
		echo "  + $f"
	done
	for f in ${skipped[@]+"${skipped[@]}"}; do
		echo "  = $f (已存在，跳过)"
	done
	echo
	echo "下一步: 运行 /sandtable-recon 开始战场侦察。"
}

main "$@"
