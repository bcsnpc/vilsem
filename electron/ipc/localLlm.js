const { ipcMain, app } = require('electron/main')
const path   = require('path')
const fs     = require('fs')
const os     = require('os')
const { spawn } = require('child_process')
const axios  = require('axios')

const SERVER_PORT     = 11435
const MODEL_FILENAME  = 'microsoft_Phi-4-mini-instruct-Q4_K_M.gguf'
const DRAFT_FILENAME  = 'llama-3.2-1b-instruct-q4_k_m.gguf'  // optional: speculative decoding
const HEALTH_URL      = `http://localhost:${SERVER_PORT}/health`
const API_URL         = `http://localhost:${SERVER_PORT}/v1/chat/completions`
const STARTUP_TIMEOUT_MS = 300_000  // 5 min — Phi-4-mini first cold-load on slow disk

let serverProcess = null
let serverReady   = false

function getResourcePath(rel) {
  return app.isPackaged
    ? path.join(process.resourcesPath, rel)
    : path.join(__dirname, '../../', rel)   // __dirname = electron/ipc/, ../../ = project root
}

function getBinaryPath()  { return getResourcePath(path.join('bin', 'llama-server.exe')) }
function getBinaryDir()   { return getResourcePath('bin') }
function getModelPath()   { return getResourcePath(path.join('models', MODEL_FILENAME)) }
function getDraftPath()   { return getResourcePath(path.join('models', DRAFT_FILENAME)) }

function isModelPresent()  { try { return fs.existsSync(getModelPath()) } catch { return false } }
function isBinaryPresent() { try { return fs.existsSync(getBinaryPath()) } catch { return false } }
function isDraftPresent()  { try { return fs.existsSync(getDraftPath())  } catch { return false } }

function isRunning() { return serverProcess !== null && serverReady }

async function waitForReady(timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await axios.get(HEALTH_URL, { timeout: 2000 })
      if (res.status === 200) return true
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 1500))
  }
  return false
}

async function startServer() {
  if (serverProcess) return { started: false, reason: 'already running' }
  if (!isBinaryPresent()) throw new Error(`llama-server.exe not found at: ${getBinaryPath()}`)
  if (!isModelPresent())  throw new Error(`Model file not found at: ${getModelPath()}`)

  console.log('[localLlm] Starting llama-server...')
  serverReady = false

  const threads  = Math.max(4, os.cpus().length)
  const hasDraft = isDraftPresent()

  const args = [
    '-m',         getModelPath(),
    '--port',     String(SERVER_PORT),
    '-ngl',       '0',      // CPU only — single binary ships everywhere
    '--ctx-size', '4096',   // intent prompts are <300 tokens; 4K is plenty
    '--threads',  String(threads),
    '--log-disable',
  ]

  if (hasDraft) {
    args.push('-md', getDraftPath(), '--draft-max', '8')
    console.log('[localLlm] Draft model found — speculative decoding enabled')
  }

  console.log(`[localLlm] threads: ${threads} | draft: ${hasDraft}`)

  serverProcess = spawn(getBinaryPath(), args, {
    cwd:   getBinaryDir(),        // DLLs must be co-located with the exe
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  serverProcess.stdout.on('data', d => console.log('[llama-server]', d.toString().trim()))
  serverProcess.stderr.on('data', d => console.log('[llama-server]', d.toString().trim()))

  serverProcess.on('exit', (code) => {
    console.log(`[localLlm] llama-server exited (code ${code})`)
    serverProcess = null
    serverReady   = false
  })

  serverProcess.on('error', (err) => {
    console.error('[localLlm] spawn error:', err.message)
    serverProcess = null
    serverReady   = false
  })

  const ready = await waitForReady(STARTUP_TIMEOUT_MS)
  if (!ready) {
    stopServer()
    throw new Error('llama-server failed to become ready within the timeout.')
  }

  serverReady = true
  console.log('[localLlm] llama-server ready on port', SERVER_PORT)
  return { started: true }
}

function stopServer() {
  if (!serverProcess) return
  try { serverProcess.kill() } catch {}
  serverProcess = null
  serverReady   = false
  console.log('[localLlm] llama-server stopped')
}

async function generate(messages, systemPrompt, maxTokens) {
  if (!serverReady) await startServer()

  const start = Date.now()
  const response = await axios.post(API_URL, {
    model:       'gemma-local',
    messages:    [{ role: 'system', content: systemPrompt }, ...messages],
    max_tokens:  Math.min(maxTokens, 2500),  // cap: 16K ctx - ~5K prompt = ~11K headroom, 2500 is safe
    temperature: 0.1,
  }, { timeout: 180_000 })

  const choice  = response.data.choices?.[0]
  const content = choice?.message?.content || ''
  const usage   = response.data.usage || {}

  return {
    content,
    usage: {
      inputTokens:   usage.prompt_tokens     || 0,
      outputTokens:  usage.completion_tokens || 0,
      totalTokens:   usage.total_tokens      || 0,
      elapsedMs:     Date.now() - start,
      estimatedCost: 0,
    },
  }
}

function getStatus() {
  return {
    running:       isRunning(),
    modelPresent:  isModelPresent(),
    binaryPresent: isBinaryPresent(),
    draftPresent:  isDraftPresent(),
    modelPath:     getModelPath(),
    draftPath:     getDraftPath(),
    port:          SERVER_PORT,
  }
}

function register() {
  ipcMain.handle('start-local-llm',      async () => startServer())
  ipcMain.handle('stop-local-llm',       async () => { stopServer(); return { stopped: true } })
  ipcMain.handle('get-local-llm-status', async () => getStatus())
}

module.exports = { register, startServer, stopServer, generate, isRunning, isModelPresent, getStatus }
