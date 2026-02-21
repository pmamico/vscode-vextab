# Publish

This repository contains a VS Code extension.

## Prerequisites

- Node.js + pnpm installed
- A VS Code Marketplace publisher account
- `@vscode/vsce` installed globally

Install `vsce`:

```bash
pnpm add -g @vscode/vsce
```

## 1) Prepare the extension

From the extension folder:

```bash
cd vextab
pnpm install
pnpm run package
```

## 2) Create a publisher

Create a publisher here:

- https://marketplace.visualstudio.com/manage

Your `package.json` must contain the matching `publisher` value.

## 3) Create a Personal Access Token (PAT)

Create an Azure DevOps PAT with Marketplace publish permission:

- https://dev.azure.com/
- User settings -> Personal access tokens
- Scopes: Marketplace -> Publish

## 4) Login with vsce

```bash
vsce login <publisherId>
```

## 5) Package a VSIX

```bash
vsce package
```

This creates a `.vsix` file in the current directory.

## 6) Publish to the VS Code Marketplace

```bash
vsce publish
```

Version bump + publish:

```bash
vsce publish patch
vsce publish minor
vsce publish major
```

## Install locally (VSIX)

Install the built VSIX on any machine:

```bash
code --install-extension path/to/vextab-<version>.vsix
```

Or in VS Code: Extensions view -> "..." menu -> "Install from VSIX...".

## Notes

- Ensure `README.md`, `CHANGELOG.md`, `LICENSE`, `repository`, `bugs`, and `icon` are present before publishing.
- If you publish from CI, use `vsce publish -p <token>` (do not commit tokens).
