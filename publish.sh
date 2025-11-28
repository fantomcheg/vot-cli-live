#!/bin/bash

# 🚀 Скрипт для публикации vot-cli-live v1.7.0 на GitHub и npm

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     🚀 Publishing vot-cli-live v1.7.0                   ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Проверяем что мы в правильной директории
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this script from project root."
    exit 1
fi

# Проверяем версию в package.json
VERSION=$(node -p "require('./package.json').version")
echo "📦 Current version: $VERSION"
echo ""

# 1. Push to GitHub
echo "📤 Step 1/4: Pushing to GitHub..."
echo "   └─ Branch: feature/add-live-voices-support"
git push myfork feature/add-live-voices-support
if [ $? -eq 0 ]; then
    echo "   └─ ✅ Branch pushed successfully"
else
    echo "   └─ ❌ Failed to push branch"
    exit 1
fi
echo ""

# 2. Push tags to GitHub
echo "📤 Step 2/4: Pushing tags to GitHub..."
git push myfork --tags
if [ $? -eq 0 ]; then
    echo "   └─ ✅ Tags pushed successfully"
else
    echo "   └─ ❌ Failed to push tags"
    exit 1
fi
echo ""

# 3. Ask about creating release on GitHub
echo "🎯 Step 3/4: GitHub Release"
echo "   You can create a release manually at:"
echo "   └─ https://github.com/fantomcheg/vot-cli-live/releases/new"
echo "   └─ Tag: v1.7.0"
echo "   └─ Title: v1.7.0 - Major Update: Bug Fixes & Beautiful UI"
echo "   └─ Description: Copy from RELEASE-NOTES-v1.7.0.md"
echo ""
read -p "   Press Enter to continue to npm publish..."
echo ""

# 4. Publish to npm
echo "📦 Step 4/4: Publishing to npm..."
echo "   └─ Package: vot-cli-live"
echo "   └─ Version: $VERSION"
echo ""

# Проверяем залогинены ли в npm
npm whoami > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "⚠️  You are not logged in to npm"
    echo "   Run: npm login"
    echo ""
    read -p "   Do you want to login now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm login
    else
        echo "❌ Skipping npm publish"
        exit 0
    fi
fi

echo ""
echo "🔍 Running final checks..."
echo "   └─ Running npm pack (dry-run)..."
npm pack --dry-run
echo ""

read -p "📦 Ready to publish to npm? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "   └─ Publishing to npm..."
    npm publish
    if [ $? -eq 0 ]; then
        echo "   └─ ✅ Published to npm successfully!"
        echo ""
        echo "╔═══════════════════════════════════════════════════════════╗"
        echo "║          🎉 PUBLICATION COMPLETED! 🎉                    ║"
        echo "╚═══════════════════════════════════════════════════════════╝"
        echo ""
        echo "✅ Version 1.7.0 published!"
        echo "📦 npm: https://www.npmjs.com/package/vot-cli-live"
        echo "🐙 GitHub: https://github.com/fantomcheg/vot-cli-live"
        echo ""
        echo "Install with: npm install -g vot-cli-live"
        echo ""
    else
        echo "   └─ ❌ npm publish failed"
        exit 1
    fi
else
    echo "❌ npm publish cancelled"
fi

echo ""
echo "🎯 Next steps:"
echo "1. Create GitHub release: https://github.com/fantomcheg/vot-cli-live/releases/new"
echo "2. Update README with new features"
echo "3. Share on social media! 🎊"
echo ""
