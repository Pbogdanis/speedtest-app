import './style.css'
import SpeedTest from '@cloudflare/speedtest'

const originalLog = console.log
const originalWarn = console.warn

console.log = (...args) => {
  const msg = args[0]
  if (typeof msg === 'string' && /^(serverTimeDelta|latency|download|upload|results)\b/.test(msg)) {
    return
  }
  originalLog.apply(console, args)
}

console.warn = (...args) => {
  const msg = args[0]
  if (typeof msg === 'string' && /^(Requested|Error fetching)\b/.test(msg)) {
    return
  }
  originalWarn.apply(console, args)
}

const els = {
  status: document.getElementById('status'),
  downloadValue: document.getElementById('downloadValue'),
  uploadValue: document.getElementById('uploadValue'),
  latencyValue: document.getElementById('latencyValue'),
  jitterValue: document.getElementById('jitterValue'),
  statusValue: document.getElementById('statusValue'),
  durationValue: document.getElementById('durationValue'),
  startBtn: document.getElementById('startBtn'),
  stopBtn: document.getElementById('stopBtn'),
  downloadFill: document.getElementById('downloadFill'),
  downloadIcon: document.getElementById('downloadIcon'),
  downloadLabel: document.getElementById('downloadLabel'),
  uploadFill: document.getElementById('uploadFill'),
  uploadIcon: document.getElementById('uploadIcon'),
  uploadLabel: document.getElementById('uploadLabel'),
  results: document.getElementById('results'),
  resultDownload: document.getElementById('resultDownload'),
  resultUpload: document.getElementById('resultUpload'),
  resultLatency: document.getElementById('resultLatency'),
  resultJitter: document.getElementById('resultJitter'),
}

let speedTest = null
let currentPhase = 'idle'
let durationTimer = null
let startTime = 0

function formatMbps(bps) {
  if (!bps || bps <= 0) return '0.00'
  return (bps / 1e6).toFixed(2)
}

function formatMs(ms) {
  if (!ms && ms !== 0) return '0'
  return Number(ms).toFixed(2)
}

function setBarPhase(phase) {
  const downloadFill = els.downloadFill
  const downloadIcon = els.downloadIcon
  const uploadFill = els.uploadFill
  const uploadIcon = els.uploadIcon

  downloadFill.classList.remove('active', 'download', 'upload', 'paused')
  downloadIcon.classList.remove('active', 'download', 'upload', 'paused')
  uploadFill.classList.remove('active', 'download', 'upload', 'paused')
  uploadIcon.classList.remove('active', 'download', 'upload', 'paused')

  if (phase === 'idle') {
    els.downloadLabel.textContent = 'Idle'
    els.uploadLabel.textContent = 'Idle'
    currentPhase = 'idle'
    return
  }

  if (phase === 'download') {
    downloadFill.classList.add('active', 'download')
    downloadIcon.classList.add('active', 'download')
    els.downloadLabel.textContent = 'Active'
    pauseBar(uploadFill, uploadIcon)
    els.uploadLabel.textContent = 'Paused'
  }

  if (phase === 'upload') {
    uploadFill.classList.add('active', 'upload')
    uploadIcon.classList.add('active', 'upload')
    els.uploadLabel.textContent = 'Active'
    pauseBar(downloadFill, downloadIcon)
    els.downloadLabel.textContent = 'Paused'
  }

  currentPhase = phase
}

function pauseBar(fill, icon) {
  fill.classList.add('paused')
  icon.classList.add('paused')
}

function resumeBar(fill, icon) {
  fill.classList.remove('paused')
  icon.classList.remove('paused')
}

function setRunningState(running) {
  els.startBtn.disabled = running
  els.stopBtn.disabled = !running
}

function resetUI() {
  els.status.textContent = 'Ready to start'
  els.downloadValue.textContent = '0.00 Mbps'
  els.uploadValue.textContent = '0.00 Mbps'
  els.latencyValue.textContent = '0 ms'
  els.jitterValue.textContent = '0 ms'
  els.statusValue.textContent = 'Ready'
  els.durationValue.textContent = '0.0s'
  setBarPhase('idle')
  els.results.hidden = true
  setRunningState(false)
  currentPhase = 'idle'
  if (durationTimer) {
    clearInterval(durationTimer)
    durationTimer = null
  }
}

function startDurationTimer() {
  startTime = Date.now()
  durationTimer = setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    els.durationValue.textContent = `${elapsed}s`
  }, 100)
}

function stopDurationTimer() {
  if (durationTimer) {
    clearInterval(durationTimer)
    durationTimer = null
  }
}

function startTest() {
  if (speedTest && speedTest.isRunning) return

  resetUI()
  speedTest = new SpeedTest({
    measurements: [
      { type: 'latency', numPackets: 5 },
      { type: 'download', bytes: 1e5, count: 4 },
      { type: 'download', bytes: 1e6, count: 4 },
      { type: 'download', bytes: 1e7, count: 4 },
      { type: 'upload', bytes: 1e5, count: 4 },
      { type: 'upload', bytes: 1e6, count: 4 },
      { type: 'upload', bytes: 1e7, count: 4 },
    ],
  })

  speedTest.onRunningChange = (running) => {
    setRunningState(running)
    if (running) {
      els.status.textContent = 'Testing...'
      els.statusValue.textContent = 'Running'
      startDurationTimer()
    } else {
      els.status.textContent = 'Finished'
      els.statusValue.textContent = 'Complete'
      stopDurationTimer()
    }
  }

  speedTest.onResultsChange = ({ type }) => {
    const results = speedTest.results

    if (type === 'latency') {
      const lat = results.getUnloadedLatency()
      const jit = results.getUnloadedJitter()
      els.latencyValue.textContent = `${formatMs(lat)} ms`
      els.jitterValue.textContent = `${formatMs(jit)} ms`
      if (currentPhase !== 'idle') {
        pauseBar(els.downloadFill, els.downloadIcon)
        pauseBar(els.uploadFill, els.uploadIcon)
        els.downloadLabel.textContent = 'Paused'
        els.uploadLabel.textContent = 'Paused'
      }
      return
    }

    if (type === 'download' || type === 'download_loaded_latency') {
      const bw = results.getDownloadBandwidth()
      els.downloadValue.textContent = `${formatMbps(bw)} Mbps`
      if (currentPhase !== 'download') {
        setBarPhase('download')
        resumeBar(els.downloadFill, els.downloadIcon)
      }
    }

    if (type === 'upload' || type === 'upload_loaded_latency') {
      const bw = results.getUploadBandwidth()
      els.uploadValue.textContent = `${formatMbps(bw)} Mbps`
      if (currentPhase !== 'upload') {
        setBarPhase('upload')
        resumeBar(els.uploadFill, els.uploadIcon)
      }
    }
  }

  speedTest.onFinish = (results) => {
    const summary = results.getSummary()
    els.resultDownload.textContent = `${formatMbps(summary.download)} Mbps`
    els.resultUpload.textContent = `${formatMbps(summary.upload)} Mbps`
    els.resultLatency.textContent = `${formatMs(summary.latency)} ms`
    els.resultJitter.textContent = `${formatMs(summary.jitter)} ms`
    els.results.hidden = false
    els.status.textContent = 'Test complete'
    els.statusValue.textContent = 'Complete'
    setRunningState(false)
    stopDurationTimer()
    setBarPhase('idle')
  }

  speedTest.onError = (error) => {
    els.status.textContent = `Error: ${error}`
    els.statusValue.textContent = 'Error'
    setRunningState(false)
    stopDurationTimer()
    setBarPhase('idle')
  }

  setRunningState(true)
  speedTest.play()
}

function stopTest() {
  if (!speedTest) return
  speedTest.restart()
  resetUI()
}

els.startBtn.addEventListener('click', startTest)
els.stopBtn.addEventListener('click', stopTest)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}