# Git Hooks

This directory contains git hooks that help maintain code quality.

## Available Hooks

### pre-push
Runs TypeScript type checking before allowing a push. This prevents pushing code with type errors.

## Installation

To install the git hooks, run:

```bash
./.githooks/install.sh
```

Or add to your npm scripts in `package.json`:

```json
{
  "scripts": {
    "setup": "./.githooks/install.sh"
  }
}
```

Then run:

```bash
npm run setup
```

## Manual Installation

You can also manually copy hooks to `.git/hooks/`:

```bash
cp .githooks/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

## Bypassing Hooks

If you need to bypass a hook in an emergency (not recommended):

```bash
git push --no-verify
```
