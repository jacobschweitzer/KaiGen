#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

hook_payload="$(cat || true)"

if [[ -n "${hook_payload}" ]]; then
	tool_name="$(jq -r '.tool_name // empty' <<< "${hook_payload}")"
	tool_command="$(jq -r '.tool_input.command // empty' <<< "${hook_payload}")"

	if [[ "${tool_name}" == "Bash" ]]; then
		if ! grep -Eq '(^|[[:space:]])(apply_patch|npm run (build|format|lint:js:fix|lint:php:fix)|composer exec phpcbf|mv|cp|rm|mkdir|chmod|touch)([[:space:]]|$)' <<< "${tool_command}"; then
			exit 0
		fi
	elif [[ "${tool_name}" != "apply_patch" ]]; then
		exit 0
	fi
fi

if [[ "${KAIGEN_LINT_ALL:-}" == "1" ]]; then
	npm run lint:js
	npm run lint:css
	npm run lint:php
	exit 0
fi

changed_files="$(
	{
		git diff --name-only --diff-filter=ACMR HEAD
		git diff --name-only --cached --diff-filter=ACMR
	} | sort -u
)"

if [[ -z "${changed_files}" ]]; then
	npm run lint:js
	npm run lint:css
	npm run lint:php
	exit 0
fi

run_js=0
run_css=0
run_php=0

while IFS= read -r file; do
	case "${file}" in
		*.js|*.jsx|*.ts|*.tsx)
			run_js=1
			;;
		*.css|*.scss)
			run_css=1
			;;
		*.php)
			run_php=1
			;;
	esac
done <<< "${changed_files}"

ran_linter=0

if [[ "${run_js}" == "1" ]]; then
	npm run lint:js
	ran_linter=1
fi

if [[ "${run_css}" == "1" ]]; then
	npm run lint:css
	ran_linter=1
fi

if [[ "${run_php}" == "1" ]]; then
	npm run lint:php
	ran_linter=1
fi

exit 0
