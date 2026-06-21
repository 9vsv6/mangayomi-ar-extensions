const mangayomiSources = [{
    "name": "Anime4Up",
    "lang": "ar",
    "baseUrl": "https://w1.anime4up.rest",
    "apiUrl": "",
    "iconUrl": "https://raw.githubusercontent.com/9vsv6/mangayomi-ar-extensions/refs/heads/main/icons/anime4up.png",
    "typeSource": "single",
    "itemType": 1,
    "version": "0.0.6",
    "pkgPath": "",
    "notes": "Fix Uqload extractor and add deleted file filter for Mp4Upload"
}];

class DefaultExtension extends MProvider {
    getHeaders(url) {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://w1.anime4up.rest/"
        };
    }
    
    fixUtf8(str) {
        if (!str) return "";
        let result = "";
        let i = 0;
        while (i < str.length) {
            const c1 = str.charCodeAt(i++);
            if (c1 < 128) {
                result += String.fromCharCode(c1);
            } else if (c1 > 191 && c1 < 224) {
                if (i >= str.length) break;
                const c2 = str.charCodeAt(i++);
                result += String.fromCharCode(((c1 & 31) << 6) | (c2 & 63));
            } else if (c1 > 223 && c1 < 240) {
                if (i + 1 >= str.length) break;
                const c2 = str.charCodeAt(i++);
                const c3 = str.charCodeAt(i++);
                result += String.fromCharCode(((c1 & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
            } else if (c1 > 239 && c1 < 248) {
                if (i + 2 >= str.length) break;
                const c2 = str.charCodeAt(i++);
                const c3 = str.charCodeAt(i++);
                const c4 = str.charCodeAt(i++);
                let cp = ((c1 & 7) << 18) | ((c2 & 63) << 12) | ((c3 & 63) << 6) | (c4 & 63);
                if (cp < 0x10000) {
                    result += String.fromCharCode(cp);
                } else {
                    cp -= 0x10000;
                    result += String.fromCharCode((cp >> 10) + 0xD800, (cp & 0x3FF) + 0xDC00);
                }
            }
        }
        return result;
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
        const url = `https://w1.anime4up.rest/%D9%82%D8%A7%D8%A6%D9%85%D8%A9-%D8%A7%D9%84%D8%A7%D9%86%D9%85%D9%8A/page/${page}/`;
            
        const res = await client.get(url, this.getHeaders(url));
        if (res.statusCode !== 200) {
            throw new Error(`Failed to fetch popular list: ${res.statusCode}`);
        }
        
        const doc = new Document(this.fixUtf8(res.body));
        const cards = doc.select('div.anime-card-container');
        const list = [];
        for (const card of cards) {
            const titleEl = card.selectFirst('div.anime-card-title h3 a');
            const overlayEl = card.selectFirst('div.anime-card-poster a.overlay');
            const imgEl = card.selectFirst('div.anime-card-poster img');
            
            if (titleEl && imgEl) {
                const name = titleEl.text.trim();
                const link = titleEl.getHref || (overlayEl ? overlayEl.getHref : "");
                const imageUrl = imgEl.attr('data-src') || imgEl.attr('data-image') || imgEl.getSrc || "";
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
        const url = `https://w1.anime4up.rest/episode/page/${page}/`;
            
        const res = await client.get(url, this.getHeaders(url));
        if (res.statusCode !== 200) {
            throw new Error(`Failed to fetch latest list: ${res.statusCode}`);
        }
        
        const doc = new Document(this.fixUtf8(res.body));
        const cards = doc.select('div.anime-card-container');
        const list = [];
        for (const card of cards) {
            const titleEl = card.selectFirst('div.anime-card-details div.anime-card-title h3 a');
            const imgEl = card.selectFirst('div.anime-card-poster img');
            const epEl = card.selectFirst('div.anime-card-poster div.ep_num a') || card.selectFirst('div.episodes-card-title h3 a');
            
            if (titleEl && imgEl) {
                let name = titleEl.text.trim();
                if (epEl) {
                    name = name + " - " + epEl.text.trim().replace(/\s+/g, ' ');
                }
                const link = titleEl.getHref || "";
                const imageUrl = imgEl.attr('data-src') || imgEl.attr('data-image') || imgEl.getSrc || "";
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
                ? `https://w1.anime4up.rest/?s=${encodeURIComponent(query)}`
                : `https://w1.anime4up.rest/page/${page}/?s=${encodeURIComponent(query)}`;
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
                    ? `https://w1.anime4up.rest/${filterPath}`
                    : `https://w1.anime4up.rest/${filterPath}page/${page}/`;
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
        
        const doc = new Document(this.fixUtf8(res.body));
        const cards = doc.select('div.anime-card-container');
        const list = [];
        for (const card of cards) {
            const titleEl = card.selectFirst('div.anime-card-title h3 a');
            const overlayEl = card.selectFirst('div.anime-card-poster a.overlay');
            const imgEl = card.selectFirst('div.anime-card-poster img');
            
            if (titleEl && imgEl) {
                const name = titleEl.text.trim();
                const link = titleEl.getHref || (overlayEl ? overlayEl.getHref : "");
                const imageUrl = imgEl.attr('data-src') || imgEl.attr('data-image') || imgEl.getSrc || "";
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
        
        // If it's an episode page, resolve parent anime details URL first
        if (url.includes("/episode/")) {
            const tempRes = await client.get(url, this.getHeaders(url));
            if (tempRes.statusCode === 200) {
                const tempDoc = new Document(this.fixUtf8(tempRes.body));
                const parentEl = tempDoc.selectFirst('a[href*="/anime/"]');
                if (parentEl) {
                    url = parentEl.getHref;
                }
            }
        }
        
        const res = await client.get(url, this.getHeaders(url));
        if (res.statusCode !== 200) {
            throw new Error(`Failed to fetch detail: ${res.statusCode}`);
        }
        
        const doc = new Document(this.fixUtf8(res.body));
        
        const titleEl = doc.selectFirst('h1.anime-details-title');
        const name = titleEl ? titleEl.text.trim() : "";
        
        const imgEl = doc.selectFirst('img.thumbnail.img-responsive') || doc.selectFirst('img.thumbnail');
        const imageUrl = imgEl ? (imgEl.attr('data-src') || imgEl.attr('data-image') || imgEl.getSrc || "") : "";
        
        const descEl = doc.selectFirst('p.anime-story');
        const description = descEl ? descEl.text.trim() : "";
        
        const genres = [];
        const genreElements = doc.select('a[href*="/anime-genre/"]');
        for (const element of genreElements) {
            genres.push(element.text.trim());
        }
        
        let status = 5;
        
        const chapters = [];
        let page = 1;
        let hasNextPage = true;
        
        while (hasNextPage) {
            const pageUrl = page === 1 ? url : `${url.replace(/\/$/, '')}/page/${page}/`;
            const pageRes = await client.get(pageUrl, this.getHeaders(pageUrl));
            if (pageRes.statusCode !== 200) {
                break;
            }
            
            const pageDoc = new Document(this.fixUtf8(pageRes.body));
            const cards = pageDoc.select('div#episodesList div.pinned-card');
            if (cards.length === 0) {
                break;
            }
            
            for (const card of cards) {
                const img_a = card.selectFirst('a.image');
                const ep_span = card.selectFirst('a.badge span') || card.selectFirst('a.badge');
                const ep_name = ep_span ? ep_span.text.trim().replace(/\s+/g, ' ') : "";
                const ep_url = img_a ? img_a.getHref : "";
                const thumbnail = img_a ? (img_a.attr('data-src') || img_a.attr('data-image') || img_a.getSrc || "") : "";
                
                chapters.push({
                    name: ep_name,
                    url: ep_url,
                    thumbnailUrl: thumbnail
                });
            }
            
            const nextEl = pageDoc.selectFirst('a.next.page-numbers');
            hasNextPage = nextEl !== null;
            page++;
            
            if (page > 50) break;
        }
        
        chapters.reverse();
        
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
            "Referer": "https://w1.anime4up.rest/"
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
        
        const linksMatch = p.match(/var\s+links\s*=\s*(\{.*?\});/);
        if (!linksMatch) {
            return [];
        }
        
        const linksObj = JSON.parse(linksMatch[1]);
        let masterUrl = linksObj.hls4 || linksObj.hls3 || linksObj.hls2;
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
    
    async customShare4maxExtractor(url, prefix) {
        const client = new Client();
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://w1.anime4up.rest/"
        };
        const res = await client.get(url, headers);
        if (res.statusCode !== 200) return [];
        
        const html = res.body;
        const versionMatch = html.match(/"version"\s*:\s*["']([a-fA-F0-9]+)["']/);
        if (!versionMatch) return [];
        const version = versionMatch[1];
        
        const inertiaHeaders = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": url,
            "X-Inertia": "true",
            "X-Inertia-Version": version,
            "X-Inertia-Partial-Component": "files/mirror/video",
            "X-Inertia-Partial-Data": "streams",
            "X-Requested-With": "XMLHttpRequest"
        };
        
        const inertiaRes = await client.get(url, inertiaHeaders);
        if (inertiaRes.statusCode !== 200) return [];
        
        const data = JSON.parse(inertiaRes.body);
        const streams = data.props && data.props.streams ? data.props.streams.data : [];
        const videos = [];
        
        for (const stream of streams) {
            const label = stream.label || "HD";
            const mirrors = stream.mirrors || [];
            
            for (const mirror of mirrors) {
                let link = mirror.link;
                if (!link) continue;
                if (link.startsWith("//")) link = "https:" + link;
                
                const driver = mirror.driver || "mirror";
                const qLabel = `${prefix} (${label} - ${driver})`;
                
                if (driver.includes("stream") || driver.includes("wish") || link.includes("streamwish") || link.includes("hgcloud.to")) {
                    try {
                        const wish = await this.customStreamWishExtractor(link, qLabel);
                        if (wish) videos.push(...wish);
                    } catch (e) {}
                } else if (driver.includes("mp4upload") || link.includes("mp4upload.com")) {
                    try {
                        const mp4 = await this.customMp4UploadExtractor(link, qLabel);
                        if (mp4) videos.push(...mp4);
                    } catch (e) {}
                } else if (driver.includes("voe") || link.includes("voe.sx")) {
                    try {
                        const voe = await this.customVoeExtractor(link, qLabel);
                        if (voe) videos.push(...voe);
                    } catch (e) {}
                } else if (driver.includes("uqload") || link.includes("uqload")) {
                    try {
                        const uq = await this.customUqloadExtractor(link, qLabel);
                        if (uq) videos.push(...uq);
                    } catch (e) {}
                }
            }
        }
        
        return videos;
    }
    
    async customLarhuExtractor(url, prefix) {
        const client = new Client();
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://w1.anime4up.rest/"
        };
        const res = await client.get(url, headers);
        if (res.statusCode !== 200) return [];
        
        const html = res.body;
        const fileMatch = html.match(/file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
        if (!fileMatch) return [];
        
        const fileUrl = fileMatch[1];
        
        return [{
            url: fileUrl,
            quality: `${prefix} - Larhu`,
            originalUrl: fileUrl,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": url
            }
        }];
    }
    
    async customVoeExtractor(url, prefix) {
        const client = new Client();
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://w1.anime4up.rest/"
        };
        
        let res = await client.get(url, headers);
        if (res.statusCode !== 200) return [];
        
        let html = res.body;
        const redirectMatch = html.match(/window\.location\.href\s*=\s*['"](https?:\/\/[^'"]+)['"]/);
        let finalUrl = url;
        if (redirectMatch) {
            finalUrl = redirectMatch[1];
            res = await client.get(finalUrl, headers);
            if (res.statusCode !== 200) return [];
            html = res.body;
        }
        
        const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
        let m;
        let obfStr = "";
        while ((m = scriptRegex.exec(html)) !== null) {
            const content = m[1].trim();
            if (content.startsWith('[') && content.endsWith(']') && content.includes('DQAk#&')) {
                const arr = JSON.parse(content);
                if (arr && arr.length > 0) {
                    obfStr = arr[0];
                    break;
                }
            }
        }
        
        if (!obfStr) return [];
        
        const step1 = this.rot13(obfStr);
        const step2 = this.replacePatterns(step1);
        const step3 = this.base64Decode(step2);
        const step4 = this.shiftChars(step3, 3);
        const step5 = step4.split("").reverse().join("");
        const step6 = this.base64Decode(step5);
        
        const videoData = JSON.parse(step6);
        const sourceUrl = videoData.source;
        if (!sourceUrl) return [];
        
        return [{
            url: sourceUrl,
            quality: `${prefix} - VOE`,
            originalUrl: sourceUrl,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": finalUrl
            }
        }];
    }
    
    rot13(text) {
        return text.replace(/[a-zA-Z]/g, function (c) {
            return String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26);
        });
    }

    replacePatterns(txt) {
        const pats = ['@$', '^^', '~@', '%?', '*~', '!!', '#&'];
        for (const pat of pats) {
            txt = txt.replaceAll(pat, '');
        }
        return txt;
    }

    shiftChars(text, shift) {
        let out = "";
        for (let i = 0; i < text.length; i++) {
            out += String.fromCharCode(text.charCodeAt(i) - shift);
        }
        return out;
    }
    
    async customUqloadExtractor(url, prefix) {
        const client = new Client();
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://w1.anime4up.rest/"
        };
        const res = await client.get(url, headers);
        if (res.statusCode !== 200) return [];
        
        const html = res.body;
        const match = html.match(/eval\(function\(p,a,c,k,e,d\).*?return p\}\('(.*?)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'(.*?)'\.split\('\|'\)/s);
        if (!match) return [];
        
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
        
        const srcMatch = p.match(/file\s*:\s*["']([^"']+)["']/);
        if (!srcMatch) return [];
        
        const fileUrl = srcMatch[1];
        
        return [{
            url: fileUrl,
            quality: `${prefix} - Uqload`,
            originalUrl: fileUrl,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": url
            }
        }];
    }
    
    async getVideoList(url) {
        const client = new Client();
        const res = await client.get(url, this.getHeaders(url));
        if (res.statusCode !== 200) {
            throw new Error(`Failed to fetch episode page: ${res.statusCode}`);
        }
        
        const doc = new Document(this.fixUtf8(res.body));
        const serverElements = doc.select('ul#episode-servers li');
        const videos = [];
        
        for (const element of serverElements) {
            const embedUrl = element.attr('data-watch');
            if (!embedUrl) continue;
            
            const serverNameA = element.selectFirst('a');
            let serverName = "Server";
            if (serverNameA) {
                const badge = serverNameA.selectFirst('span.quality');
                let text = serverNameA.text;
                if (text.includes('<')) {
                    text = text.split('<')[0];
                }
                if (badge) {
                    text = text.replace(badge.text, "");
                }
                serverName = text.trim();
            }
            
            if (embedUrl.includes("share4max.com")) {
                try {
                    const shareVideos = await this.customShare4maxExtractor(embedUrl, serverName);
                    if (shareVideos) videos.push(...shareVideos);
                } catch (e) {
                    console.log(`Share4max extractor error: ${e}`);
                }
            } else if (embedUrl.includes("larhu.website")) {
                try {
                    const larhuVideos = await this.customLarhuExtractor(embedUrl, serverName);
                    if (larhuVideos) videos.push(...larhuVideos);
                } catch (e) {
                    console.log(`Larhu extractor error: ${e}`);
                }
            } else if (embedUrl.includes("mp4upload.com")) {
                try {
                    const mp4Videos = await this.customMp4UploadExtractor(embedUrl, serverName);
                    if (mp4Videos) videos.push(...mp4Videos);
                } catch (e) {
                    console.log(`Mp4Upload extractor error: ${e}`);
                }
            } else if (embedUrl.includes("streamwish") || embedUrl.includes("hgcloud.to")) {
                try {
                    const wishVideos = await this.customStreamWishExtractor(embedUrl, serverName);
                    if (wishVideos) videos.push(...wishVideos);
                } catch (e) {
                    console.log(`StreamWish extractor error: ${e}`);
                }
            } else if (embedUrl.includes("voe.sx")) {
                try {
                    const voeVideos = await this.customVoeExtractor(embedUrl, serverName);
                    if (voeVideos) videos.push(...voeVideos);
                } catch (e) {
                    console.log(`Voe extractor error: ${e}`);
                }
            } else if (embedUrl.includes("uqload")) {
                try {
                    const uqVideos = await this.customUqloadExtractor(embedUrl, serverName);
                    if (uqVideos) videos.push(...uqVideos);
                } catch (e) {
                    console.log(`Uqload extractor error: ${e}`);
                }
            }
        }
        
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
                    { type_name: 'SelectOption', name: 'أكشن', value: 'anime-genre/%d9%85%d8%ba%d8%a7%d9%85%d8%b1%d8%a7%d8%aa/' },
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
                name: 'النوع',
                type: 'type',
                state: 0,
                values: [
                    { type_name: 'SelectOption', name: 'الكل', value: '' },
                    { type_name: 'SelectOption', name: 'TV', value: 'anime-type/tv2/' },
                    { type_name: 'SelectOption', name: 'Movie', value: 'anime-type/movie-3/' },
                    { type_name: 'SelectOption', name: 'Special', value: 'anime-type/special/' }
                ]
            }
        ];
    }
    
    getSourcePreferences() {
        return [];
    }
}
