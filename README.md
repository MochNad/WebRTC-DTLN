# WebRTC-DTLN

Proyek ini adalah aplikasi [Next.js](https://nextjs.org) yang mengintegrasikan teknologi WebRTC dengan algoritma Deep Noise Suppression (DTLN) untuk komunikasi audio real-time dengan pengurangan noise.

## Tentang Proyek

WebRTC-DTLN menggabungkan:

- **WebRTC**: Untuk komunikasi real-time peer-to-peer
- **DTLN (Dual-Signal Transformation LSTM Network)**: Algoritma AI untuk mengurangi noise pada audio
- **Next.js**: Framework React untuk pengembangan web modern

### Fitur Utama

- 🎙️ Komunikasi audio real-time
- 🔇 Pengurangan noise otomatis menggunakan AI
- 🌐 Koneksi peer-to-peer tanpa server perantara
- 📱 Responsif untuk desktop dan mobile
- ⚡ Performa tinggi dengan Next.js

## Persyaratan Sistem

- Node.js 18.0 atau lebih baru
- npm, yarn, pnpm, atau bun
- Browser modern yang mendukung WebRTC
- File audio WAV (mono, 16kHz) atau download dari [Dataset-DTLN Repository](https://github.com/MochNad/Dataset-DTLN)

## Instalasi

### 1. Clone Repository

```bash
git clone https://github.com/username/WebRTC-DTLN.git
cd WebRTC-DTLN
```

### 2. Install Dependencies

Pilih salah satu package manager:

```bash
# Menggunakan npm
npm install

# Atau menggunakan yarn
yarn install

# Atau menggunakan pnpm
pnpm install

# Atau menggunakan bun
bun install
```

### 3. Konfigurasi Environment

Salin file `.env.example` menjadi `.env` dan isi konfigurasi Firestore:

```bash
cp .env.example .env
```

Edit file `.env` dan tambahkan kredensial Firestore Anda.

### 4. Siapkan File Audio

Download dataset audio dari [Dataset-DTLN Repository](https://github.com/MochNad/Dataset-DTLN) atau siapkan file audio WAV dengan spesifikasi:

- Format: WAV
- Channel: Mono
- Sample Rate: 16kHz

### 5. Jalankan Development Server

**PENTING**: Aplikasi harus dijalankan dengan HTTPS untuk WebRTC berfungsi dengan baik.

```bash
# Menggunakan npm
npm run dev -- --experimental-https

# Atau menggunakan yarn
yarn dev -- --experimental-https

# Atau menggunakan pnpm
pnpm dev -- --experimental-https

# Atau menggunakan bun
bun dev -- --experimental-https
```

### 6. Akses Aplikasi

Buka [https://localhost:3000](https://localhost:3000) di browser Anda.
