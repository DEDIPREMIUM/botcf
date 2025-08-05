import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';

// --- Konfigurasi ---
// Ganti dengan token bot Telegram Anda dari BotFather
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN';
// Ganti dengan URL dasar worker Anda
const WORKER_URL = process.env.WORKER_URL || 'https://nautica.foolvpn.me';

if (BOT_TOKEN === 'YOUR_BOT_TOKEN') {
    console.error("Silakan atur BOT_TOKEN di environment variable atau langsung di dalam file bot.ts");
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// --- Alur Bot ---

// 1. Perintah /start
//    - Mengirim pesan selamat datang dan menampilkan menu utama.
bot.start((ctx) => {
    ctx.reply(
        'Selamat datang di Nautica Proxy Bot!\n\nSilakan pilih salah satu menu di bawah ini:',
        Markup.inlineKeyboard([
            [Markup.button.callback('Dapatkan Proksi', 'get_proxies')],
            [Markup.button.url('Donasi', 'https://trakteer.id/dickymuliafiqri/tip')]
        ])
    );
});

// 2. Tombol "Dapatkan Proksi"
//    - Mengambil daftar negara yang tersedia dan menampilkannya sebagai tombol.
bot.action('get_proxies', async (ctx) => {
    try {
        await ctx.editMessageText('Mengambil daftar negara yang tersedia...');

        const kvProxyList = await fetchKvProxyList();
        const countryCodes = Object.keys(kvProxyList);

        if (countryCodes.length === 0) {
            await ctx.editMessageText('Tidak ada negara yang tersedia saat ini.');
            return;
        }

        // Membuat tombol negara secara dinamis
        const countryButtons = countryCodes.map(code => {
            // Fungsi sederhana untuk mengubah kode negara menjadi emoji bendera
            const flag = code.toUpperCase().split('').map(char => String.fromCodePoint(127397 + char.charCodeAt(0))).join('');
            return Markup.button.callback(`${flag} ${code}`, `get_country_${code}`);
        });

        // Mengelompokkan tombol ke dalam baris (misalnya, 3 tombol per baris)
        const buttonRows = [];
        const chunkSize = 3;
        for (let i = 0; i < countryButtons.length; i += chunkSize) {
            buttonRows.push(countryButtons.slice(i, i + chunkSize));
        }

        // Menambahkan tombol "Kembali"
        buttonRows.push([Markup.button.callback('Kembali ke Menu Utama', 'start_menu')]);

        await ctx.editMessageText(
            'Silakan pilih negara untuk proksi yang Anda inginkan:',
            Markup.inlineKeyboard(buttonRows)
        );

    } catch (error) {
        console.error(error);
        await ctx.editMessageText('Maaf, terjadi kesalahan saat mengambil daftar negara.');
    }
});

// 3. Tombol Pilihan Negara
//    - Mengambil data proksi dari API worker dan mengirimkannya ke pengguna.
bot.action(/get_country_(.+)/, async (ctx) => {
    const countryCode = ctx.match[1];
    try {
        await ctx.editMessageText(`Mencari proksi untuk negara ${countryCode}...`);

        const proxies = await fetchProxies(countryCode);

        if (proxies.length === 0) {
            await ctx.editMessageText(`Tidak ada proksi yang ditemukan untuk negara ${countryCode}.`);
        } else {
            // Gabungkan semua proksi menjadi satu pesan
            const proxyMessage = proxies.join('\n');
            await ctx.editMessageText(`Berikut adalah proksi untuk negara ${countryCode}:\n\n\`\`\`\n${proxyMessage}\n\`\`\``, { parse_mode: 'MarkdownV2' });
        }

    } catch (error) {
        console.error(error);
        await ctx.editMessageText('Maaf, terjadi kesalahan saat mengambil data proksi.');
    }

    // Tampilkan tombol kembali
    await ctx.reply(
        'Pilih tindakan selanjutnya:',
        Markup.inlineKeyboard([
            [Markup.button.callback('Pilih Negara Lain', 'get_proxies')],
            [Markup.button.callback('Kembali ke Menu Utama', 'start_menu')]
        ])
    );
});


// 4. Tombol "Kembali ke Menu Utama"
bot.action('start_menu', (ctx) => {
    ctx.editMessageText(
        'Selamat datang di Nautica Proxy Bot!\n\nSilakan pilih salah satu menu di bawah ini:',
        Markup.inlineKeyboard([
            [Markup.button.callback('Dapatkan Proksi', 'get_proxies')],
            [Markup.button.url('Donasi', 'https://trakteer.id/dickymuliafiqri/tip')]
        ])
    );
});


// --- Fungsi Helper ---

const KV_PROXY_URL = "https://raw.githubusercontent.com/FoolVPN-ID/Nautica/refs/heads/main/kvProxyList.json";

/**
 * Mengambil daftar negara dari file kvProxyList.json.
 * @returns Object dengan negara sebagai key.
 */
async function fetchKvProxyList(): Promise<Record<string, any>> {
    const response = await fetch(KV_PROXY_URL);
    if (!response.ok) {
        throw new Error(`Gagal mengambil daftar negara: ${response.statusText}`);
    }
    return await response.json();
}

/**
 * Mengambil daftar proksi dari API worker.
 * @param countryCode Kode negara (misal: 'ID', 'SG')
 * @returns Array of proxy strings.
 */
async function fetchProxies(countryCode: string): Promise<string[]> {
    const url = `${WORKER_URL}/api/v1/sub?cc=${countryCode}&format=raw&limit=10`;
    console.log(`Fetching from: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Gagal mengambil data: ${response.statusText}`);
    }
    const text = await response.text();
    return text.split('\n').filter(line => line.trim() !== '');
}


// --- Menjalankan Bot ---
bot.launch();
console.log('Bot sedang berjalan...');

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
