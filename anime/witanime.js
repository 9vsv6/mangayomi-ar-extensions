const mangayomiSources = [{
    "name": "WitAnime",
    "lang": "ar",
    "baseUrl": "https://witanime.you",
    "apiUrl": "",
    "iconUrl": "https://witanime.you/wp-content/uploads/2023/08/cropped-Logo-WITU-192x192.png",
    "typeSource": "single",
    "itemType": 1,
    "version": "0.0.21",
    "pkgPath": "",
    "notes": "Fix Dailymotion quality selection and AV1 audio issue, scrape Mp4Upload stream links, add support for 4shared, videas, dotplay"
}];

class DefaultExtension extends MProvider {
    getHeaders(url) {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://witanime.you/"
        };
    }
    
    get supportsLatest() {
        return true;
    }
    
    base64Decode(str) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let raw = str.replace(/=+$/, '');
        let decoded = '';
        let buffer = 0;
        let bits = 0;
        for (let i = 0; i < raw.length; i++) {
            const char = raw[i];
            const val = chars.indexOf(char);
            if (val === -1) continue;
            buffer = (buffer << 6) | val;
            bits += 6;
            if (bits >= 8) {
                bits -= 8;
                decoded += String.fromCharCode((buffer >> bits) & 0xff);
            }
        }
        return decoded;
    }

    base64Encode(str) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let encoded = '';
        let i = 0;
        while (i < str.length) {
            const byte1 = str.charCodeAt(i++);
            const byte2 = i < str.length ? str.charCodeAt(i++) : NaN;
            const byte3 = i < str.length ? str.charCodeAt(i++) : NaN;
            
            const enc1 = byte1 >> 2;
            const enc2 = ((byte1 & 3) << 4) | (isNaN(byte2) ? 0 : (byte2 >> 4));
            const enc3 = isNaN(byte2) ? 64 : (((byte2 & 15) << 2) | (isNaN(byte3) ? 0 : (byte3 >> 6)));
            const enc4 = isNaN(byte3) ? 64 : (byte3 & 63);
            
            encoded += chars.charAt(enc1) + chars.charAt(enc2) +
                       (enc3 === 64 ? '=' : chars.charAt(enc3)) +
                       (enc4 === 64 ? '=' : chars.charAt(enc4));
        }
        return encoded;
    }

    base64ToBytes(str) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let raw = str.replace(/=+$/, '');
        let bytes = [];
        let buffer = 0;
        let bits = 0;
        for (let i = 0; i < raw.length; i++) {
            const char = raw[i];
            const val = chars.indexOf(char);
            if (val === -1) continue;
            buffer = (buffer << 6) | val;
            bits += 6;
            if (bits >= 8) {
                bits -= 8;
                bytes.push((buffer >> bits) & 0xff);
            }
        }
        return bytes;
    }
    
    async getPopular(page) {
        const client = new Client();
        const url = page === 1 
            ? "https://witanime.you/%D9%82%D8%A7%D8%A6%D9%85%D8%A9-%D8%A7%D9%84%D8%A7%D9%86%D9%85%D9%8a/"
            : `https://witanime.you/%D9%82%D8%A7%D8%A6%D9%85%D8%A9-%D8%A7%D9%84%D8%A7%D9%86%D9%85%D9%8a/page/${page}/`;
            
        const res = await client.get(url, this.getHeaders(url));
        if (res.statusCode !== 200) {
            throw new Error(`Failed to fetch popular list: ${res.statusCode}`);
        }
        
        const doc = new Document(res.body);
        const cards = doc.select('div.anime-card-container');
        const list = [];
        for (const card of cards) {
            const titleEl = card.selectFirst('div.anime-card-title h3 a');
            const overlayEl = card.selectFirst('div.anime-card-poster a.overlay');
            const imgEl = card.selectFirst('div.anime-card-poster img');
            
            if (titleEl && imgEl) {
                const name = titleEl.text.trim();
                const link = titleEl.getHref || (overlayEl ? overlayEl.getHref : "");
                const imageUrl = imgEl.getSrc || imgEl.attr('src') || "";
                list.push({
                    name: name,
                    link: link,
                    imageUrl: imageUrl
                });
            }
        }
        
        const nextEl = doc.selectFirst('a.next.page-numbers');
        const hasNextPage = nextEl !== null;
        
        return {
            list: list,
            hasNextPage: hasNextPage
        };
    }
    
    async getLatestUpdates(page) {
        const client = new Client();
        const url = page === 1 
            ? "https://witanime.you/episode/"
            : `https://witanime.you/episode/page/${page}/`;
            
        const res = await client.get(url, this.getHeaders(url));
        if (res.statusCode !== 200) {
            throw new Error(`Failed to fetch latest list: ${res.statusCode}`);
        }
        
        const doc = new Document(res.body);
        const cards = doc.select('div.anime-card-container');
        const list = [];
        for (const card of cards) {
            const titleEl = card.selectFirst('div.anime-card-details div.anime-card-title h3 a');
            const imgEl = card.selectFirst('div.anime-card-poster img');
            const epEl = card.selectFirst('div.episodes-card-title h3 a');
            
            if (titleEl && imgEl) {
                let name = titleEl.text.trim();
                if (epEl) {
                    name = name + " - " + epEl.text.trim();
                }
                const link = titleEl.getHref || "";
                const imageUrl = imgEl.getSrc || imgEl.attr('src') || "";
                list.push({
                    name: name,
                    link: link,
                    imageUrl: imageUrl
                });
            }
        }
        
        const nextEl = doc.selectFirst('a.next.page-numbers');
        const hasNextPage = nextEl !== null;
        
        return {
            list: list,
            hasNextPage: hasNextPage
        };
    }
    
    async search(query, page, filters) {
        const client = new Client();
        let url = "";
        
        if (query && query.trim().length > 0) {
            url = page === 1
                ? `https://witanime.you/?s=${encodeURIComponent(query)}&search_param=animes`
                : `https://witanime.you/page/${page}/?s=${encodeURIComponent(query)}&search_param=animes`;
        } else {
            let filterPath = "";
            if (filters && filters.length > 0) {
                for (const filter of filters) {
                    if (filter.state > 0 && filter.values && filter.values[filter.state]) {
                        filterPath = filter.values[filter.state].value;
                        break;
                    }
                }
            }
            if (filterPath.length > 0) {
                url = page === 1
                    ? `https://witanime.you/${filterPath}`
                    : `https://witanime.you/${filterPath}page/${page}/`;
            } else {
                return await this.getPopular(page);
            }
        }
        
        const res = await client.get(url, this.getHeaders(url));
        if (res.statusCode !== 200) {
            return {
                list: [],
                hasNextPage: false
            };
        }
        
        const doc = new Document(res.body);
        const cards = doc.select('div.anime-card-container');
        const list = [];
        for (const card of cards) {
            const titleEl = card.selectFirst('div.anime-card-title h3 a');
            const overlayEl = card.selectFirst('div.anime-card-poster a.overlay');
            const imgEl = card.selectFirst('div.anime-card-poster img');
            
            if (titleEl && imgEl) {
                const name = titleEl.text.trim();
                const link = titleEl.getHref || (overlayEl ? overlayEl.getHref : "");
                const imageUrl = imgEl.getSrc || imgEl.attr('src') || "";
                list.push({
                    name: name,
                    link: link,
                    imageUrl: imageUrl
                });
            }
        }
        
        const nextEl = doc.selectFirst('a.next.page-numbers');
        const hasNextPage = nextEl !== null;
        
        return {
            list: list,
            hasNextPage: hasNextPage
        };
    }
    
    async getDetail(url) {
        const client = new Client();
        const res = await client.get(url, this.getHeaders(url));
        if (res.statusCode !== 200) {
            throw new Error(`Failed to fetch detail: ${res.statusCode}`);
        }
        
        const doc = new Document(res.body);
        
        const titleEl = doc.selectFirst('h1.anime-details-title');
        const name = titleEl ? titleEl.text.trim() : "";
        
        const imgEl = doc.selectFirst('img.thumbnail.img-responsive');
        const imageUrl = imgEl ? (imgEl.getSrc || imgEl.attr('src') || "") : "";
        
        const descEl = doc.selectFirst('p.anime-story');
        const description = descEl ? descEl.text.trim() : "";
        
        const genres = [];
        const genreElements = doc.select('a[href*="/anime-genre/"]');
        for (const element of genreElements) {
            genres.push(element.text.trim());
        }
        
        let status = 5;
        const statusElement = doc.selectFirst('a[href*="/anime-status/"]');
        if (statusElement) {
            const statusText = statusElement.text.trim();
            if (statusText.includes("يعرض الان")) {
                status = 0;
            } else if (statusText.includes("مكتمل")) {
                status = 1;
            }
        }
        
        const html = res.body;
        const match = html.match(/processedEpisodeData\s*=\s*'([^']+)'/);
        const chapters = [];
        if (match) {
            const processedEpisodeData = match[1];
            const parts = processedEpisodeData.split('.');
            if (parts.length === 2) {
                const key = this.base64Decode(parts[1]);
                const encryptedBytes = this.base64ToBytes(parts[0]);
                let decryptedStr = "";
                for (let i = 0; i < encryptedBytes.length; i++) {
                    decryptedStr += String.fromCharCode(encryptedBytes[i] ^ key.charCodeAt(i % key.length));
                }
                const episodes = JSON.parse(decryptedStr);
                for (let i = 0; i < episodes.length; i++) {
                    const ep = episodes[i];
                    chapters.push({
                        name: ep.type + " " + ep.number,
                        url: ep.url,
                        thumbnailUrl: ep.screenshot
                    });
                }
            }
        }
        
        return {
            name: name,
            link: url,
            imageUrl: imageUrl,
            description: description,
            genre: genres,
            status: status,
            chapters: chapters
        };
    }
    
    async customStreamWishExtractor(url, prefix) {
        const client = new Client();
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://witanime.you/"
        };
        const res = await client.get(url, headers);
        if (res.statusCode !== 200) {
            return [];
        }
        
        const html = res.body;
        const match = html.match(/eval\(function\(p,a,c,k,e,d\).*?return p\}\('(.*?)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'(.*?)'\.split\('\|'\)/s);
        if (!match) {
            return [];
        }
        
        let p = match[1];
        const a = parseInt(match[2], 10);
        const c = parseInt(match[3], 10);
        const k = match[4].split('|');
        
        function baseN(num, b) {
            const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
            if (num < b) {
                return chars[num];
            }
            return baseN(Math.floor(num / b), b) + chars[num % b];
        }
        
        for (let i = c - 1; i >= 0; i--) {
            if (k[i]) {
                const baseValue = baseN(i, a);
                const regex = new RegExp('\\b' + baseValue + '\\b', 'g');
                p = p.replace(regex, () => k[i]);
            }
        }
        
        // The packed "links" object can contain nested braces (e.g. nested setup),
        // so match from "var links=" and balance braces instead of a naive .*? regex.
        const linksStart = p.indexOf("var links=");
        let linksObj = null;
        if (linksStart !== -1) {
            const braceStart = p.indexOf("{", linksStart);
            let depth = 0;
            let braceEnd = -1;
            for (let i = braceStart; i < p.length; i++) {
                if (p[i] === "{") depth++;
                else if (p[i] === "}") {
                    depth--;
                    if (depth === 0) { braceEnd = i; break; }
                }
            }
            if (braceEnd !== -1) {
                try {
                    linksObj = JSON.parse(p.substring(braceStart, braceEnd + 1));
                } catch (e) {
                    linksObj = null;
                }
            }
        }
        if (!linksObj) {
            return [];
        }

        // IMPORTANT: prefer the absolute CDN URLs (hls2/hls3) over hls4.
        // hls4 is a relative "/stream/..." path served from the player host
        // that currently returns FAKE anti-scrape segments (TikTok ad CDN URLs),
        // which causes a black screen. hls2 (.m3u8/.ts) and hls3 (.txt/.woff2)
        // are the real StreamWish CDN streams.
        let masterUrl = linksObj.hls2 || linksObj.hls3 || linksObj.hls4;
        if (!masterUrl) {
            return [];
        }
        
        function getHost(u) {
            const m = u.match(/https?:\/\/([^\/\?#]+)/);
            return m ? m[1] : "";
        }
        
        if (masterUrl.startsWith("/")) {
            masterUrl = "https://" + getHost(url) + masterUrl;
        }
        
        const playerHost = getHost(url);
        const masterHost = getHost(masterUrl);
        const playlistHeaders = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "*/*",
            "Origin": "https://" + playerHost,
            "Referer": "https://" + playerHost + "/"
        };
        
        const playlistRes = await client.get(masterUrl, playlistHeaders);
        if (playlistRes.statusCode !== 200) {
            return [];
        }
        
        const masterPlaylist = playlistRes.body;
        const pathEndIndex = masterUrl.indexOf('?');
        let cleanUrl = pathEndIndex !== -1 ? masterUrl.substring(0, pathEndIndex) : masterUrl;
        let masterBase = cleanUrl.substring(0, cleanUrl.lastIndexOf('/')) + '/';
        
        const separator = '#EXT-X-STREAM-INF:';
        const parts = masterPlaylist.split(separator);
        const videos = [];
        const onlyUaHeaders = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        };
        
        for (let i = 1; i < parts.length; i++) {
            const part = parts[i];
            let resolution = "";
            const resMatch = part.match(/RESOLUTION=\d+x(\d+)/);
            if (resMatch) {
                resolution = resMatch[1] + "p";
            } else {
                resolution = "Video";
            }
            
            const firstNewlineIndex = part.indexOf('\n');
            if (firstNewlineIndex !== -1) {
                let afterNewline = part.substring(firstNewlineIndex + 1).trim();
                const secondNewlineIndex = afterNewline.indexOf('\n');
                let subPath = secondNewlineIndex !== -1 ? afterNewline.substring(0, secondNewlineIndex).trim() : afterNewline;
                
                if (subPath.length > 0) {
                    const videoUrl = subPath.startsWith("http") ? subPath : (masterBase + subPath);
                    videos.push({
                        url: videoUrl,
                        quality: `${prefix} - ${resolution}`,
                        originalUrl: videoUrl,
                        headers: onlyUaHeaders
                    });
                }
            }
        }
        
        return videos;
    }

    async customVideaExtractor(url, prefix) {
        const client = new Client();
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://witanime.you/"
        };
        const res = await client.get(url, headers);
        if (res.statusCode !== 200) {
            return [];
        }
        
        const html = res.body;
        const videoIdMatch = url.match(/(?:\?v=|player\/v\/|videok\/[^\-]+\-)([^?#&]+)/);
        if (!videoIdMatch) {
            return [];
        }
        const videoId = videoIdMatch[1];
        
        const xtMatch = html.match(/_xt\s*=\s*"([^"]+)"/);
        if (!xtMatch) {
            return [];
        }
        
        const nonce = xtMatch[1];
        const l = nonce.substring(0, 32);
        const s = nonce.substring(32);
        const staticSecret = 'xHb0ZvME5q8CBcoQi6AngerDu3FGO9fkUlwPmLVY_RTzj2hJIS4NasXWKy1td7p';
        let result = '';
        for (let i = 0; i < 32; i++) {
            const secretIdx = staticSecret.indexOf(l[i]);
            if (secretIdx === -1) continue;
            const idx = secretIdx - 31;
            result += s[i - idx];
        }
        
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let randomSeed = "";
        for (let i = 0; i < 8; i++) {
            randomSeed += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        const tVal = result.substring(0, 16);
        const xmlUrl = `https://videa.hu/player/xml?v=${videoId}&_s=${randomSeed}&_t=${tVal}`;
        const xmlRes = await client.get(xmlUrl, headers);
        if (xmlRes.statusCode !== 200) {
            return [];
        }
        
        let xmlText = xmlRes.body;
        if (!xmlText.startsWith('<?xml')) {
            const key = result.substring(16) + randomSeed + (xmlRes.headers['x-videa-xs'] || '');
            
            // Decrypt with RC4
            function rc4Decrypt(cipherBytes, keyStr) {
                let S = [];
                for (let i = 0; i < 256; i++) {
                    S[i] = i;
                }
                let j = 0;
                for (let i = 0; i < 256; i++) {
                    j = (j + S[i] + keyStr.charCodeAt(i % keyStr.length)) % 256;
                    let temp = S[i];
                    S[i] = S[j];
                    S[j] = temp;
                }
                let i = 0;
                j = 0;
                let decrypted = "";
                for (let m = 0; m < cipherBytes.length; m++) {
                    i = (i + 1) % 256;
                    j = (j + S[i]) % 256;
                    let temp = S[i];
                    S[i] = S[j];
                    S[j] = temp;
                    let k = S[(S[i] + S[j]) % 256];
                    decrypted += String.fromCharCode(k ^ cipherBytes[m]);
                }
                return decrypted;
            }
            
            const cipherBytes = this.base64ToBytes(xmlText);
            xmlText = rc4Decrypt(cipherBytes, key);
        }
        
        const videos = [];
        const sourceUrlMatches = xmlText.match(/<video_source[^>]*>([\s\S]*?)<\/video_source>/g);
        if (sourceUrlMatches) {
            for (const match of sourceUrlMatches) {
                const urlMatch = match.match(/<video_source[^>]*>([\s\S]*?)<\/video_source>/);
                let videoUrl = urlMatch[1].trim();
                
                const nameMatch = match.match(/name="([^"]+)"/);
                const expMatch = match.match(/exp="([^"]+)"/);
                
                if (videoUrl) {
                    if (videoUrl.startsWith('//')) {
                        videoUrl = 'https:' + videoUrl;
                    }
                    
                    const name = nameMatch ? nameMatch[1] : 'Video';
                    const exp = expMatch ? expMatch[1] : '';
                    
                    if (name && exp) {
                        const hashTag = `<hash_value_${name}>([^<]+)<\/hash_value_${name}>`;
                        const hashMatch = xmlText.match(new RegExp(hashTag));
                        if (hashMatch) {
                            const hashVal = hashMatch[1].trim();
                            videoUrl = videoUrl + (videoUrl.includes('?') ? '&' : '?') + `md5=${hashVal}&expires=${exp}`;
                        }
                    }
                    
                    videos.push({
                        url: videoUrl,
                        quality: `${prefix} Videa - ${name}`,
                        originalUrl: videoUrl,
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                        }
                    });
                }
            }
        }
        
        return videos;
    }
    
    async customMp4UploadExtractor(url, prefix) {
        const client = new Client();
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://mp4upload.com/"
        };
        const res = await client.get(url, headers);
        if (res.statusCode !== 200 || res.body.includes("File was deleted") || res.body.includes("File Not Found")) {
            return [];
        }
        
        let html = res.body;
        let script = "";
        
        // Try packed first
        const match = html.match(/eval\(function\(p,a,c,k,e,d\).*?return p\}\('(.*?)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'(.*?)'\.split\('\|'\)/s);
        if (match) {
            let p = match[1];
            const a = parseInt(match[2], 10);
            const c = parseInt(match[3], 10);
            const k = match[4].split('|');
            
            function baseN(num, b) {
                const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
                if (num < b) {
                    return chars[num];
                }
                return baseN(Math.floor(num / b), b) + chars[num % b];
            }
            
            for (let i = c - 1; i >= 0; i--) {
                if (k[i]) {
                    const baseValue = baseN(i, a);
                    const regex = new RegExp('\\b' + baseValue + '\\b', 'g');
                    p = p.replace(regex, () => k[i]);
                }
            }
            script = p;
        } else {
            // Search individual script tags for player.src
            const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
            let m;
            while ((m = scriptRegex.exec(html)) !== null) {
                const content = m[1];
                if (content.includes("player.src(")) {
                    script = content;
                    break;
                }
            }
        }
        
        if (!script) {
            return [];
        }
        
        const srcMatch = script.match(/src\s*:\s*["']([^"']+)["']/);
        if (!srcMatch) {
            return [];
        }
        const videoUrl = srcMatch[1];
        
        let resolution = "Unknown resolution";
        const resMatch = script.match(/\bHEIGHT=(\d+)/i);
        if (resMatch) {
            resolution = resMatch[1] + "p";
        }
        
        const quality = `${prefix} Mp4Upload - ${resolution}`;
        
        return [{
            url: videoUrl,
            quality: quality,
            originalUrl: videoUrl,
            headers: headers
        }];
    }
    
    absoluteUrl(subPath, masterUrl) {
        if (subPath.startsWith("http")) return subPath;
        const pathEndIndex = masterUrl.indexOf('?');
        let cleanUrl = pathEndIndex !== -1 ? masterUrl.substring(0, pathEndIndex) : masterUrl;
        let masterBase = cleanUrl.substring(0, cleanUrl.lastIndexOf('/')) + '/';
        if (subPath.startsWith("/")) {
            const hostMatch = masterUrl.match(/(https?:\/\/[^\/]+)/);
            const host = hostMatch ? hostMatch[1] : "";
            return host + subPath;
        }
        return masterBase + subPath;
    }

    base64Encode(str) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let result = '';
        let i = 0;
        while (i < str.length) {
            const byte1 = str.charCodeAt(i++);
            const byte2 = i < str.length ? str.charCodeAt(i++) : NaN;
            const byte3 = i < str.length ? str.charCodeAt(i++) : NaN;

            const enc1 = byte1 >> 2;
            const enc2 = ((byte1 & 3) << 4) | (isNaN(byte2) ? 0 : (byte2 >> 4));
            const enc3 = isNaN(byte2) ? 64 : (((byte2 & 15) << 2) | (isNaN(byte3) ? 0 : (byte3 >> 6)));
            const enc4 = isNaN(byte3) ? 64 : (byte3 & 63);

            result += chars.charAt(enc1) + chars.charAt(enc2) +
                      (enc3 === 64 ? '=' : chars.charAt(enc3)) +
                      (enc4 === 64 ? '=' : chars.charAt(enc4));
        }
        return result;
    }

    async customDailymotionExtractor(url, prefix) {
        const client = new Client();
        
        // Support /embed/video/ID, /video/ID, dai.ly/ID
        let videoIdMatch = url.match(/(?:dailymotion\.com\/(?:embed\/)?video\/|dai\.ly\/)([a-zA-Z0-9]+)/);
        if (!videoIdMatch) {
            // Backup match for local relative URLs
            videoIdMatch = url.match(/(?:video|embed\/video)\/([a-zA-Z0-9]+)/);
        }
        if (!videoIdMatch) return [];
        const videoId = videoIdMatch[1];
        
        const dmHeaders = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://www.dailymotion.com/"
        };

        const normalizeUrl = (u) => {
            if (!u) return null;
            return u.replace(/\\\//g, '/').replace(/\\\\/g, '');
        };

        // The master HLS manifest URL contains all quality variants AND audio group
        // declarations. Returning the master URL for each quality label means the
        // player receives a complete, valid HLS manifest with audio for every entry.
        // This is exactly what Dailymotion's own player does and ensures reliable playback.
        const buildQualityEntries = (masterUrl, qualities) => {
            const qualityMap = [
                { label: "1080p", keys: ["1080"] },
                { label: "720p",  keys: ["720"] },
                { label: "480p",  keys: ["480"] },
                { label: "380p",  keys: ["380"] },
                { label: "240p",  keys: ["240"] },
                { label: "144p",  keys: ["144"] }
            ];

            const videos = [];
            for (const q of qualityMap) {
                let found = false;
                for (const key of q.keys) {
                    if (qualities[key] && qualities[key].length > 0) {
                        found = true;
                        break;
                    }
                }
                if (!found) continue;

                // Append unique fragment to prevent Mangayomi from deduplicating same-URL entries
                videos.push({
                    url: masterUrl + `#q=${q.label.replace('p', '')}`,
                    quality: `${prefix} Dailymotion - ${q.label}`,
                    originalUrl: masterUrl,
                    headers: dmHeaders
                });
            }

            if (videos.length === 0) {
                videos.push({
                    url: masterUrl,
                    quality: `${prefix} Dailymotion - Auto`,
                    originalUrl: masterUrl,
                    headers: dmHeaders
                });
            }

            return videos;
        };

        // Use the Dailymotion metadata API (single request - fast)
        try {
            const metadataUrl = `https://www.dailymotion.com/player/metadata/video/${videoId}`;
            const metaRes = await client.get(metadataUrl, {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "application/json, text/plain, */*"
            });
            if (metaRes.statusCode === 200) {
                const metaData = JSON.parse(metaRes.body);
                const qualities = metaData && metaData.qualities;
                if (qualities && qualities.auto && qualities.auto.length > 0) {
                    const masterUrl = normalizeUrl(qualities.auto[0].url);
                    if (masterUrl) {
                        return buildQualityEntries(masterUrl, qualities);
                    }
                }
            }
        } catch (e) {
            console.log(`Dailymotion metadata API error: ${e}`);
        }
        
        // Fallback: embed page scraping
        try {
            const embedUrl = `https://www.dailymotion.com/embed/video/${videoId}`;
            const res = await client.get(embedUrl, {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://witanime.you/"
            });
            if (res.statusCode === 200) {
                const m3u8Match = res.body.match(/"manifestUrl"\s*:\s*"([^"]+)"/);
                if (m3u8Match) {
                    const masterUrl = normalizeUrl(m3u8Match[1]);
                    if (masterUrl) {
                        const videos = [];
                        const standardQualities = ['1080p', '720p', '480p', '380p'];
                        for (const q of standardQualities) {
                            videos.push({
                                url: masterUrl + `#q=${q.replace('p', '')}`,
                                quality: `${prefix} Dailymotion - ${q}`,
                                originalUrl: masterUrl,
                                headers: dmHeaders
                            });
                        }
                        return videos;
                    }
                }
            }
        } catch (e) {
            console.log(`Dailymotion embed fallback error: ${e}`);
        }
        
        return [];
    }

    async customFourSharedExtractor(url, prefix) {
        const client = new Client();
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://yonaplay.net/"
        };
        const res = await client.get(url, headers);
        if (res.statusCode !== 200) return [];
        
        const html = res.body;
        let videoUrl = "";
        const doc = new Document(html);
        const sourceEl = doc.selectFirst('source');
        if (sourceEl) {
            videoUrl = sourceEl.attr('src');
        }
        if (!videoUrl) {
            const m = html.match(/<source[^>]*src="([^"]+)"/i);
            if (m) videoUrl = m[1];
        }
        
        if (!videoUrl) return [];
        return [{
            url: videoUrl,
            quality: `${prefix} 4Shared - Video`,
            originalUrl: videoUrl,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        }];
    }

    async customVideasExtractor(url, prefix) {
        const client = new Client();
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        };
        const res = await client.get(url, headers);
        if (res.statusCode !== 200) return [];
        
        const html = res.body;
        const scriptMatch = html.match(/<script[^>]*id="data-embed"[^>]*>([\s\S]*?)<\/script>/i);
        if (!scriptMatch) return [];
        
        try {
            const data = JSON.parse(scriptMatch[1]);
            const videos = [];
            if (data.medias && data.medias.length > 0) {
                for (const media of data.medias) {
                    if (media.src) {
                        videos.push({
                            url: media.src,
                            quality: `${prefix} Videas - Video`,
                            originalUrl: media.src,
                            headers: {
                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                            }
                        });
                    }
                }
            }
            return videos;
        } catch (e) {
            console.log(`Videas parse error: ${e}`);
            return [];
        }
    }

    async customDotPlayExtractor(url, prefix) {
        const codeMatch = url.match(/embed\/([a-zA-Z0-9]+)/);
        if (!codeMatch) return [];
        const code = codeMatch[1];
        
        const client = new Client();
        const apiUrl = `https://dotplay.net/api.php?code=${code}`;
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
            "Referer": `https://dotplay.net/embed/${code}`
        };
        
        const res = await client.get(apiUrl, headers);
        if (res.statusCode !== 200) return [];
        
        try {
            const data = JSON.parse(res.body);
            if (data.success && data.video_url) {
                const decoded = this.base64Decode(data.video_url);
                const parts = decoded.split('|');
                const videoUrl = parts[0];
                if (videoUrl) {
                    return [{
                        url: videoUrl,
                        quality: `${prefix} DotPlay - Video`,
                        originalUrl: videoUrl,
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                        }
                    }];
                }
            }
        } catch (e) {
            console.log(`DotPlay parse error: ${e}`);
        }
        return [];
    }
    
    async getVideoList(url) {
        const client = new Client();
        const res = await client.get(url, this.getHeaders(url));
        if (res.statusCode !== 200) {
            throw new Error(`Failed to fetch episode page: ${res.statusCode}`);
        }
        
        const html = res.body;
        // The site rotates variable names (was _zG/_zH, now _zX/_zK).
        // Try known names first, then fall back to extracting them
        // from the _initializeResources function.
        let zgVal = null;
        let zhVal = null;
        
        // Try current names first
        let zgMatch = html.match(/_zX\s*=\s*["']([^"']+)["']/);
        let zhMatch = html.match(/_zK\s*=\s*["']([^"']+)["']/);
        if (zgMatch && zhMatch) {
            zgVal = zgMatch[1];
            zhVal = zhMatch[1];
        }
        
        // Fallback: try old names
        if (!zgVal || !zhVal) {
            zgMatch = html.match(/_zG\s*=\s*["']([^"']+)["']/);
            zhMatch = html.match(/_zH\s*=\s*["']([^"']+)["']/);
            if (zgMatch && zhMatch) {
                zgVal = zgMatch[1];
                zhVal = zhMatch[1];
            }
        }
        
        // Last fallback: detect variable names from the init function
        if (!zgVal || !zhVal) {
            const resVarMatch = html.match(/resourceRegistry\s*=\s*JSON\.parse\(atob\(([a-zA-Z_$][a-zA-Z0-9_$]*)\)\)/);
            const cfgVarMatch = html.match(/configRegistry\s*=\s*JSON\.parse\(atob\(([a-zA-Z_$][a-zA-Z0-9_$]*)\)\)/);
            if (resVarMatch && cfgVarMatch) {
                const resVarName = resVarMatch[1];
                const cfgVarName = cfgVarMatch[1];
                const resRegex = new RegExp(resVarName + '\\s*=\\s*["\']([^"\']+)["\']');
                const cfgRegex = new RegExp(cfgVarName + '\\s*=\\s*["\']([^"\']+)["\']');
                const rm = html.match(resRegex);
                const cm = html.match(cfgRegex);
                if (rm && cm) {
                    zgVal = rm[1];
                    zhVal = cm[1];
                }
            }
        }
        
        if (!zgVal || !zhVal) {
            return [];
        }
        
        const resourceRegistry = JSON.parse(this.base64Decode(zgVal));
        const configRegistry = JSON.parse(this.base64Decode(zhVal));
        
        const doc = new Document(html);
        const serverElements = doc.select('a.server-link');
        const videos = [];
        const apiKey = "23a97133-caf3-4eb4-9466-93d0a4ff8198";
        const wishDomains = ["streamwish", "hgcloud.to", "hgplaycdn.com", "hglamioz.com", "niramirus.com", "playnixes.com", "medixiru.com", "hanerix.com", "audinifer.com", "vibuxer.com", "masukestin.com", "lulustream", "lulu"];
        
        // Run each server's extraction concurrently so a slow/dead host
        // (e.g. geoblocked videa.hu DNS hanging ~11s) cannot stall the whole
        // isolate and trigger an "isolate response timeout". Total wall time
        // becomes the slowest single server instead of the sum of all of them.
        const extractFromServer = async (decoded, serverName) => {
            const results = [];
            try {
                let streamwishUrl = decoded;
                let isStreamWish = false;
                for (const domain of wishDomains) {
                    if (streamwishUrl.includes(domain)) {
                        isStreamWish = true;
                        break;
                    }
                }

                if (isStreamWish) {
                    streamwishUrl = streamwishUrl.replace("hgcloud.to", "hgplaycdn.com")
                                                 .replace("streamwish.to", "hgplaycdn.com")
                                                 .replace("streamwish.com", "hgplaycdn.com")
                                                 .replace("lulustream.com", "hgplaycdn.com");
                    const wishVideos = await this.customStreamWishExtractor(streamwishUrl, serverName);
                    if (wishVideos) results.push(...wishVideos);
                } else if (decoded.includes("mp4upload.com")) {
                    const mp4Videos = await this.customMp4UploadExtractor(decoded, serverName);
                    if (mp4Videos) results.push(...mp4Videos);
                } else if (decoded.includes("videa.hu") || decoded.includes("videakid.hu")) {
                    const videaVideos = await this.customVideaExtractor(decoded, serverName);
                    if (videaVideos) results.push(...videaVideos);
                } else if (decoded.includes("dailymotion.com")) {
                    const dmVideos = await this.customDailymotionExtractor(decoded, serverName);
                    if (dmVideos) results.push(...dmVideos);
                } else if (decoded.includes("4shared.com")) {
                    const fsVideos = await this.customFourSharedExtractor(decoded, serverName);
                    if (fsVideos) results.push(...fsVideos);
                } else if (decoded.includes("videas.fr")) {
                    const vdVideos = await this.customVideasExtractor(decoded, serverName);
                    if (vdVideos) results.push(...vdVideos);
                } else if (decoded.includes("dotplay.net")) {
                    const dpVideos = await this.customDotPlayExtractor(decoded, serverName);
                    if (dpVideos) results.push(...dpVideos);
                } else if (decoded.startsWith("https://yonaplay.net/embed.php?id=")) {
                    const yonaHeaders = {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                        "Referer": "https://witanime.you/"
                    };
                    const yonaRes = await client.get(decoded, yonaHeaders);
                    if (yonaRes.statusCode === 200) {
                        const yonaHtml = yonaRes.body;
                        const playerMatches = yonaHtml.match(/go_to_player\('([^']+)'\)/g);
                        if (playerMatches) {
                            for (const matchText of playerMatches) {
                                const b64Text = matchText.match(/go_to_player\('([^']+)'\)/)[1];
                                let subUrl = this.base64Decode(b64Text);

                                let isSubStreamWish = false;
                                for (const domain of wishDomains) {
                                    if (subUrl.includes(domain)) {
                                        isSubStreamWish = true;
                                        break;
                                    }
                                }

                                if (isSubStreamWish) {
                                    subUrl = subUrl.replace("hgcloud.to", "hgplaycdn.com")
                                                   .replace("streamwish.to", "hgplaycdn.com")
                                                   .replace("streamwish.com", "hgplaycdn.com")
                                                   .replace("lulustream.com", "hgplaycdn.com");
                                    const wishVideos = await this.customStreamWishExtractor(subUrl, `${serverName} (Yona)`);
                                    if (wishVideos) results.push(...wishVideos);
                                } else if (subUrl.includes("mp4upload.com")) {
                                    const mp4Videos = await this.customMp4UploadExtractor(subUrl, `${serverName} (Yona)`);
                                    if (mp4Videos) results.push(...mp4Videos);
                                } else if (subUrl.includes("videa.hu") || subUrl.includes("videakid.hu")) {
                                    const videaVideos = await this.customVideaExtractor(subUrl, `${serverName} (Yona)`);
                                    if (videaVideos) results.push(...videaVideos);
                                } else if (subUrl.includes("dailymotion.com")) {
                                    const dmVideos = await this.customDailymotionExtractor(subUrl, `${serverName} (Yona)`);
                                    if (dmVideos) results.push(...dmVideos);
                                } else if (subUrl.includes("4shared.com")) {
                                    const fsVideos = await this.customFourSharedExtractor(subUrl, `${serverName} (Yona)`);
                                    if (fsVideos) results.push(...fsVideos);
                                } else if (subUrl.includes("videas.fr")) {
                                    const vdVideos = await this.customVideasExtractor(subUrl, `${serverName} (Yona)`);
                                    if (vdVideos) results.push(...vdVideos);
                                } else if (subUrl.includes("dotplay.net")) {
                                    const dpVideos = await this.customDotPlayExtractor(subUrl, `${serverName} (Yona)`);
                                    if (dpVideos) results.push(...dpVideos);
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.log(`Server ${serverName} extraction error: ${e}`);
            }
            return results;
        };

        const extractFromMp4UploadDownload = async (mp4Url, qualityLabel) => {
            try {
                let embedUrl = mp4Url;
                const mp4match = mp4Url.match(/mp4upload\.com\/(?:embed-)?([a-zA-Z0-9]+)(?:\.html)?/);
                if (mp4match) {
                    embedUrl = `https://www.mp4upload.com/embed-${mp4match[1]}.html`;
                }
                const prefixName = `Mp4Upload (Download) - ${qualityLabel}`;
                return await this.customMp4UploadExtractor(embedUrl, prefixName);
            } catch (e) {
                console.log(`Mp4Upload download extraction error: ${e}`);
            }
            return [];
        };

        const serverPromises = [];
        for (const element of serverElements) {
            const serverIdStr = element.attr('data-server-id');
            if (!serverIdStr) continue;

            const serverId = parseInt(serverIdStr, 10);
            if (serverId >= resourceRegistry.length) continue;

            const serverNameSpan = element.selectFirst('span.ser');
            const serverName = serverNameSpan ? serverNameSpan.text.trim() : `Server ${serverId}`;

            const resData = resourceRegistry[serverId];
            const confData = configRegistry[serverId];

            const resCleaned = resData.split('').reverse().join('').replace(/[^A-Za-z0-9\+\/\=]/g, '');

            const k_b64 = confData.k;
            const indexVal = parseInt(this.base64Decode(k_b64), 10);
            const offset = confData.d[indexVal];

            let decoded = this.base64Decode(resCleaned);
            if (offset > 0) {
                decoded = decoded.slice(0, -offset);
            }

            if (decoded.startsWith("https://yonaplay.net/embed.php?id=")) {
                decoded += "&apiKey=" + apiKey;
            }

            // Cap each server at 15s so a hanging/dead host (e.g. geoblocked
            // videa.hu) can never block the whole isolate. Loser servers simply
            // contribute nothing while the rest resolve.
            const timeoutGuard = new Promise((resolve) => {
                setTimeout(() => { console.log(`Server ${serverName} timed out`); resolve([]); }, 15000);
            });
            serverPromises.push(Promise.race([extractFromServer(decoded, serverName), timeoutGuard]));
        }

        // Parse download qualities for Mp4Upload
        try {
            const mrMatch = html.match(/_m\s*=\s*\{"r"\s*:\s*"([^"]+)"\}/);
            const tlMatch = html.match(/_t\s*=\s*\{"l"\s*:\s*"([^"]+)"\}/);
            const sMatch = html.match(/_s\s*=\s*(\[[^\]]+\]);/);
            
            if (mrMatch && tlMatch && sMatch) {
                const secret = this.base64Decode(mrMatch[1]);
                const count = parseInt(tlMatch[1], 10);
                const sList = JSON.parse(sMatch[1]);
                
                const pVars = {};
                for (let i = 0; i < count; i++) {
                    const pMatch = html.match(new RegExp(`_p${i}\\s*=\\s*(\\[[^\\]]*\\]);`));
                    if (pMatch) {
                        pVars[i] = JSON.parse(pMatch[1]);
                    }
                }
                
                const decryptWitUrl = (rawHex, secretKey) => {
                    let out = "";
                    const bytes = [];
                    for (let k = 0; k < rawHex.length; k += 2) {
                        bytes.push(parseInt(rawHex.substr(k, 2), 16));
                    }
                    const keylen = secretKey.length;
                    for (let k = 0; k < bytes.length; k++) {
                        out += String.fromCharCode(bytes[k] ^ secretKey.charCodeAt(k % keylen));
                    }
                    return out;
                };

                const qualityLists = doc.select('ul.quality-list');
                for (const ul of qualityLists) {
                    const firstLi = ul.selectFirst('li');
                    const labelText = firstLi ? firstLi.text.trim() : "";
                    let qualityLabel = "";
                    if (labelText.includes("FHD")) qualityLabel = "FHD";
                    else if (labelText.includes("HD")) qualityLabel = "HD";
                    else if (labelText.includes("SD")) qualityLabel = "SD";
                    else qualityLabel = labelText;

                    const downloadLinks = ul.select('a.download-link');
                    for (const link of downloadLinks) {
                        const spanNotice = link.selectFirst('span.notice');
                        const hostName = spanNotice ? spanNotice.text.trim().toLowerCase() : "";
                        if (hostName.includes("mp4upload")) {
                            const dataIndexStr = link.attr('data-index');
                            if (dataIndexStr) {
                                const dataIndex = parseInt(dataIndexStr, 10);
                                if (dataIndex < count && sList[dataIndex] && pVars[dataIndex]) {
                                    try {
                                        const seqDecrypted = decryptWitUrl(sList[dataIndex], secret);
                                        const seq = JSON.parse(seqDecrypted);
                                        const chunks = pVars[dataIndex];
                                        const decryptedChunks = chunks.map(chunk => decryptWitUrl(chunk, secret));

                                        const arranged = new Array(seq.length);
                                        for (let j = 0; j < seq.length; j++) {
                                            arranged[seq[j]] = decryptedChunks[j];
                                        }
                                        const finalUrl = arranged.join("");
                                        if (finalUrl) {
                                            const mp4TimeoutGuard = new Promise((resolve) => {
                                                setTimeout(() => { console.log(`Mp4Upload download ${qualityLabel} timed out`); resolve([]); }, 15000);
                                            });
                                            serverPromises.push(Promise.race([extractFromMp4UploadDownload(finalUrl, qualityLabel), mp4TimeoutGuard]));
                                        }
                                    } catch (err) {
                                        console.log(`Decrypt error for index ${dataIndex}: ${err}`);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.log(`Error parsing download section: ${e}`);
        }

        const allResults = await Promise.all(serverPromises);
        for (const serverVideos of allResults) {
            if (serverVideos && serverVideos.length) {
                videos.push(...serverVideos);
            }
        }

        let preferredQuality = "1080p";
        let preferredServer = "any";
        try {
            const preferences = new SharedPreferences();
            preferredQuality = preferences.get("pref_quality") || "1080p";
            preferredServer = preferences.get("pref_server") || "any";
        } catch (e) {
            console.log(`Error reading preferences: ${e}`);
        }

        const getQualityRank = (qualityStr) => {
            const q = qualityStr.toLowerCase();
            if (q.includes("1080") || q.includes("fhd")) return 1080;
            if (q.includes("720") || q.includes("hd")) return 720;
            if (q.includes("480") || q.includes("sd")) return 480;
            if (q.includes("360")) return 360;
            if (q.includes("auto") || q.includes("multi")) return 1;
            return 0;
        };

        const scoreVideo = (video) => {
            let score = 0;
            const qualityStr = video.quality;
            const qLower = qualityStr.toLowerCase();

            // 1. Check preferred quality match
            if (preferredQuality !== "auto") {
                if (qLower.includes(preferredQuality)) {
                    score += 10000;
                }
            } else {
                if (qLower.includes("auto") || qLower.includes("multi")) {
                    score += 10000;
                }
            }

            // 2. Check preferred server match
            if (preferredServer !== "any") {
                if (qLower.includes(preferredServer.toLowerCase())) {
                    score += 5000;
                }
            }

            // 3. Quality rank bonus (to prefer higher qualities)
            score += getQualityRank(qualityStr);
            return score;
        };

        videos.sort((a, b) => scoreVideo(b) - scoreVideo(a));

        return videos;
    }
    
    getFilterList() {
        return [
            {
                type_name: 'SelectFilter',
                name: 'تصنيف الأنبي',
                type: 'genre',
                state: 0,
                values: [
                    { type_name: 'SelectOption', name: 'الكل', value: '' },
                    { type_name: 'SelectOption', name: 'أكشن', value: 'anime-genre/%d8%a3%d9%83%d8%b4%d9%86/' },
                    { type_name: 'SelectOption', name: 'مغامرات', value: 'anime-genre/%d9%85%d8%ba%d8%a7%d9%85%d8%b1%d8%a7%d8%aa/' },
                    { type_name: 'SelectOption', name: 'كوميدي', value: 'anime-genre/%d9%83%d9%88%d9%85%d9%8a%d8%af%d9%8a/' },
                    { type_name: 'SelectOption', name: 'خيال', value: 'anime-genre/%d8%ae%d9%8a%d8%a7%d9%84/' },
                    { type_name: 'SelectOption', name: 'دراما', value: 'anime-genre/%d8%af%d8%b1%d8%a7%d9%85%d8%a7/' },
                    { type_name: 'SelectOption', name: 'رعب', value: 'anime-genre/%d8%b1%d8%b9%d8%a8/' },
                    { type_name: 'SelectOption', name: 'غموض', value: 'anime-genre/%d8%ba%d9%85%d9%88%d8%b6/' },
                    { type_name: 'SelectOption', name: 'رومانسي', value: 'anime-genre/%d8%b1%d9%88%d9%85%d8%a7%d9%86%d8%b3%d9%8a/' },
                    { type_name: 'SelectOption', name: 'خيال علمي', value: 'anime-genre/%d8%ae%d9%8a%d8%a7%d9%84-%d8%b9%d9%84%d9%85%d9%8a/' },
                    { type_name: 'SelectOption', name: 'شريحة من الحياة', value: 'anime-genre/%d8%b4%d8%b1%d9%8a%d8%ad%d8%a9-%d9%85%d9%86-%d8%a7%d9%84%d8%ad%d9%8a%d8%a7%d8%a9/' },
                    { type_name: 'SelectOption', name: 'خارق للطبيعة', value: 'anime-genre/%d8%ae%d8%a7%d8%b1%d9%82-%d9%84%d9%84%d8%b7%d8%a8%d9%8a%d8%b9%d8%a9/' },
                    { type_name: 'SelectOption', name: 'تشويق', value: 'anime-genre/%d8%aa%d8%b4%d9%88%d9%8a%d9%82/' }
                ]
            },
            {
                type_name: 'SelectFilter',
                name: 'حالة الأنبي',
                type: 'status',
                state: 0,
                values: [
                    { type_name: 'SelectOption', name: 'الكل', value: '' },
                    { type_name: 'SelectOption', name: 'مكتمل', value: 'anime-status/%d9%85%d9%83%d8%aa%d9%85%d9%84/' },
                    { type_name: 'SelectOption', name: 'يعرض الان', value: 'anime-status/%d9%8a%d8%b9%d8%b1%d8%b6-%d8%a7%d9%84%d8%a7%d9%86/' }
                ]
            },
            {
                type_name: 'SelectFilter',
                name: 'النوع',
                type: 'type',
                state: 0,
                values: [
                    { type_name: 'SelectOption', name: 'الكل', value: '' },
                    { type_name: 'SelectOption', name: 'TV', value: 'anime-type/tv/' },
                    { type_name: 'SelectOption', name: 'Movie', value: 'anime-type/movie/' },
                    { type_name: 'SelectOption', name: 'OVA', value: 'anime-type/ova/' },
                    { type_name: 'SelectOption', name: 'ONA', value: 'anime-type/ona/' },
                    { type_name: 'SelectOption', name: 'Special', value: 'anime-type/special/' }
                ]
            }
        ];
    }
    
    getSourcePreferences() {
        return [
            {
                key: "pref_quality",
                listPreference: {
                    title: "Preferred Quality",
                    summary: "Select your preferred video quality for streaming/downloading.",
                    value: "1080p",
                    entries: ["1080p", "720p", "480p", "360p", "Auto (Multi Quality)"],
                    entryValues: ["1080p", "720p", "480p", "360p", "auto"]
                }
            },
            {
                key: "pref_server",
                listPreference: {
                    title: "Preferred Server",
                    summary: "Select your preferred server. Note: Download-specific servers (e.g., Mp4Upload Download) are used for downloads.",
                    value: "Mp4Upload",
                    entries: ["Dailymotion", "StreamWish", "Mp4Upload", "Mp4Upload (Download)", "Yonaplay", "Videa", "Videas", "DotPlay", "Any Server"],
                    entryValues: ["Dailymotion", "StreamWish", "Mp4Upload", "Mp4Upload (Download)", "yonaplay", "videa", "videas", "dotplay", "any"]
                }
            }
        ];
    }
}
