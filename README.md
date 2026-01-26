<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1eb9aVcW0xgHuqOEDYKId0hNZVsfQlRb7

## Run Locally

**Prerequisites:**  Node.js, Supabase CLI

### Install Supabase CLI

**Windows (using Scoop):**
```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**macOS (using Homebrew):**
```bash
brew install supabase/tap/supabase
```

**Linux:**
```bash
# For amd64/x86_64 (most common)
curl -LO https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz
tar -xzf supabase_linux_amd64.tar.gz
sudo mv supabase /usr/local/bin/
rm supabase_linux_amd64.tar.gz

# For arm64, use: supabase_linux_arm64.tar.gz
# See https://github.com/supabase/cli/releases for other architectures
```

**Verify installation:**
```bash
supabase --version
```

### Run the Application

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## UX lint (AI presence guardrails)

```bash
bash scripts/ux-lint.sh
```
