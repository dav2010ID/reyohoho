// No credentials in argv, logs, git-tracked files or build artifacts.
import { readFile, writeFile } from 'node:fs/promises'
import { spawn, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

const root = fileURLToPath(new URL('../', import.meta.url))
const privatePath = fileURLToPath(new URL('../backend/.env', import.meta.url))
const configPath = fileURLToPath(
  new URL('../workers/kinobox-search/wrangler.local.jsonc', import.meta.url)
)
const webhookUrl = 'https://api.reyhoho.fun/api/auth/telegram-webhook'

async function wrangler(args, input) {
  // All args below are controlled by this script, never secrets or user-supplied shell fragments.
  const command = `npx --yes wrangler ${args.join(' ')}`
  const child =
    process.platform === 'win32'
      ? spawn('cmd.exe', ['/d', '/s', '/c', command], {
          cwd: root,
          stdio: [input ? 'pipe' : 'inherit', 'inherit', 'inherit']
        })
      : spawn('npx', ['--yes', 'wrangler', ...args], {
          cwd: root,
          stdio: [input ? 'pipe' : 'inherit', 'inherit', 'inherit']
        })
  if (input) {
    child.stdin.on('error', () => {})
    child.stdin.end(input)
  }
  await new Promise((resolve, reject) => {
    child.on('error', () => reject(new Error('Wrangler could not start')))
    child.on('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error('Wrangler failed; check Cloudflare login/permissions'))
    )
  })
}

async function main() {
  execFileSync('git', ['check-ignore', 'backend/.env'], { cwd: root, stdio: 'pipe' })
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', 'backend/.env'], {
      cwd: root,
      stdio: 'pipe'
    })
    throw new Error('Private environment file is tracked by Git')
  } catch (error) {
    if (error.message === 'Private environment file is tracked by Git') throw error
    if (error.status !== 1) throw new Error('Cannot verify that the private file is untracked')
  }
  let contents = await readFile(privatePath, 'utf8')
  const values = Object.fromEntries(
    contents.split(/\r?\n/).flatMap((line) => {
      const match = /^([A-Z_]+)=(.*)$/.exec(line)
      return match ? [[match[1], match[2].trim().replace(/^(['"])(.*)\1$/, '$2')]] : []
    })
  )
  const botToken = values.TELEGRAM_BOT_TOKEN
  if (!botToken)
    throw new Error('Fill TELEGRAM_BOT_TOKEN in ignored backend/.env; do not put it in chat or Git')
  let secret = values.TELEGRAM_WEBHOOK_SECRET
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(secret || '')) {
    secret = randomBytes(48).toString('base64url')
    contents = contents.replace(
      /^TELEGRAM_WEBHOOK_SECRET=.*$/m,
      `TELEGRAM_WEBHOOK_SECRET=${secret}`
    )
    if (!/^TELEGRAM_WEBHOOK_SECRET=/m.test(contents))
      contents += `\nTELEGRAM_WEBHOOK_SECRET=${secret}\n`
    await writeFile(privatePath, contents)
  }
  async function telegram(method, body = {}) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error('Telegram request failed')
      return data.result
    } catch {
      throw new Error(`Telegram ${method} failed (credentials and URLs redacted)`)
    }
  }
  const bot = await telegram('getMe')
  if (!/^[A-Za-z0-9_]{5,32}$/.test(bot.username || '')) throw new Error('Bot username unavailable')
  if (
    values.TELEGRAM_BOT_USERNAME &&
    values.TELEGRAM_BOT_USERNAME.replace(/^@/, '') !== bot.username
  )
    throw new Error('Configured bot username does not match token; update the private file')
  const info = await telegram('getWebhookInfo')
  if (info.url && info.url !== webhookUrl)
    throw new Error(
      'This bot already has a different webhook. Do not overwrite it without reviewing the old deployment'
    )

  let oldConfig
  try {
    oldConfig = await readFile(configPath, 'utf8')
  } catch {
    throw new Error('Create ignored workers/kinobox-search/wrangler.local.jsonc with your account and D1 IDs; see docs/worker-telegram.md')
  }
  const config = JSON.parse(oldConfig)
  if (!config.account_id || !config.d1_databases?.some((db) => db.binding === 'HISTORY_DB' && db.database_id))
    throw new Error('Local Wrangler config requires account_id and the HISTORY_DB database_id')
  config.vars.TELEGRAM_AUTH_ENABLED = 'true'
  config.vars.TELEGRAM_BOT_USERNAME = bot.username
  try {
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`)
    await wrangler(['deploy', '--dry-run', '--config', 'workers/kinobox-search/wrangler.local.jsonc'])
    await wrangler([
      'd1',
      'migrations',
      'apply',
      'reyohoho-history',
      '--remote',
      '--config',
      'workers/kinobox-search/wrangler.local.jsonc'
    ])
    await wrangler(
      ['secret', 'bulk', '--config', 'workers/kinobox-search/wrangler.local.jsonc'],
      JSON.stringify({
        TELEGRAM_BOT_TOKEN: botToken,
        TELEGRAM_WEBHOOK_SECRET: secret
      })
    )
    await wrangler(['deploy', '--keep-vars', '--config', 'workers/kinobox-search/wrangler.local.jsonc'])
  } catch (error) {
    await writeFile(configPath, oldConfig)
    throw error
  }
  await telegram('setWebhook', {
    url: webhookUrl,
    secret_token: secret,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: false
  })
  const registered = await telegram('getWebhookInfo')
  if (registered.url !== webhookUrl) throw new Error('Webhook registration not confirmed')
  console.log(
    'Worker deployed and webhook registered. Verify real Telegram login before enabling the frontend flag. No Git push performed.'
  )
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
