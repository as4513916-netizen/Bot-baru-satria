const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys')
const { spawn } = require('child_process')
const fs = require('fs')
const axios = require('axios')

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (up) => {
    const { connection, lastDisconnect } = up
    if (connection === 'close') {
      const hubungUlang = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
      if (hubungUlang) startBot()
    } else if (connection === 'open') {
      console.log('✅ Bot Satria sudah terhubung!')
    }
  })

  sock.ev.on('messages.upsert', async m => {
    const pesan = m.messages[0]
    if (!pesan.message || pesan.key.fromMe) return

    const pengirim = pesan.key.remoteJid
    const teks = pesan.message.conversation || pesan.message.extendedTextMessage?.text || ''
    const link = teks.match(/https?:\/\/[^\s]+/)?.[0] || ''

    try {
      if (/tiktok\.com|vt\.tiktok\.com/.test(link)) {
        await sock.sendMessage(pengirim, { text: '🔽 Sedang ubah TikTok ke VN...' })
        const file = await tiktokKeVN(link)
        await sock.sendMessage(pengirim, { audio: { url: file }, mimetype: 'audio/mp4', ptt: true })
        fs.unlinkSync(file)
        return
      }

      if (/youtube\.com|youtu\.be/.test(link)) {
        if (teks.includes('mp3') || teks.includes('vn')) {
          await sock.sendMessage(pengirim, { text: '🎵 Mengubah YouTube ke VN...' })
          const file = await ytKeMp3(link)
          await sock.sendMessage(pengirim, { audio: { url: file }, mimetype: 'audio/mp4', ptt: true })
        } else {
          await sock.sendMessage(pengirim, { text: '🎥 Mengunduh YouTube ke MP4...' })
          const file = await ytKeMp4(link)
          await sock.sendMessage(pengirim, { video: { url: file } })
        }
        fs.unlinkSync(file)
        return
      }

      if (teks.toLowerCase() === 'menu' || teks.toLowerCase() === 'bantuan') {
        await sock.sendMessage(pengirim, {
          text: `🤖 *BOT SATRIA - PANDUAN PAKAI*
━━━━━━━━━━━━━━━━━━━━
✅ Kirim link TikTok → otomatis jadi VN
✅ Kirim link YouTube + tulis "mp3" → jadi VN
✅ Kirim link YouTube saja → jadi video MP4
━━━━━━━━━━━━━━━━━━━━
⚠️ Catatan:
- Ukuran file maksimal 16 MB
- Gunakan untuk keperluan pribadi saja`
        })
      }
    } catch (err) {
      console.error('Error:', err)
      await sock.sendMessage(pengirim, { text: '❌ Gagal memproses! Coba link lain nanti ya.' })
    }
  })
}

async function tiktokKeVN(url) {
  const nama = `tt-${Date.now()}`
  const vid = `${nama}.mp4`
  const aud = `${nama}.m4a`
  await jalankan('yt-dlp', ['-f', 'best', '-o', vid, '--no-warnings', url])
  await jalankan('ffmpeg', ['-i', vid, '-vn', '-ab', '128k', '-y', aud])
  fs.unlinkSync(vid)
  return aud
}

async function ytKeMp3(url) {
  const nama = `yt-audio-${Date.now()}.m4a`
  await jalankan('yt-dlp', ['-x', '--audio-format', 'm4a', '-o', nama, '--no-warnings', url])
  return nama
}

async function ytKeMp4(url) {
  const nama = `yt-video-${Date.now()}.mp4`
  await jalankan('yt-dlp', ['-f', 'best[ext=mp4]', '-o', nama, '--no-warnings', url])
  return nama
}

function jalankan(perintah, argumen) {
  return new Promise((berhasil, gagal) => {
    const proses = spawn(perintah, argumen)
    proses.on('close', kode => kode === 0 ? berhasil() : gagal(new Error(`Gagal: Kode ${kode}`)))
  })
}

startBot()
