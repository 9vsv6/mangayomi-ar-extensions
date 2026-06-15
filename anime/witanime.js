const mangayomiSources = [{
    "name": "WitAnime",
    "lang": "ar",
    "baseUrl": "https://witanime.you",
    "apiUrl": "",
    "iconUrl": "https://witanime.you/wp-content/uploads/2023/08/cropped-Logo-WITU-192x192.png",
    "typeSource": "single",
    "itemType": 1,
    "version": "0.0.3",
    "pkgPath": "",
    "notes": "WitAnime JS Extension with custom StreamWish/Mp4Upload extractors and latest updates fix"
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
            "Host": masterHost,
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
                        headers: playlistHeaders
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
        if (res.statusCode !== 200) {
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
    
    async getVideoList(url) {
        const client = new Client();
        const res = await client.get(url, this.getHeaders(url));
        if (res.statusCode !== 200) {
            throw new Error(`Failed to fetch episode page: ${res.statusCode}`);
        }
        
        const html = res.body;
        const zgMatch = html.match(/_zG\s*=\s*["']([^"']+)["']/);
        const zhMatch = html.match(/_zH\s*=\s*["']([^"']+)["']/);
        if (!zgMatch || !zhMatch) {
            return [];
        }
        
        const zgVal = zgMatch[1];
        const zhVal = zhMatch[1];
        const resourceRegistry = JSON.parse(this.base64Decode(zgVal));
        const configRegistry = JSON.parse(this.base64Decode(zhVal));
        
        const doc = new Document(html);
        const serverElements = doc.select('a.server-link');
        const videos = [];
        const apiKey = "23a97133-caf3-4eb4-9466-93d0a4ff8198";
        const wishDomains = ["streamwish", "hgcloud.to", "hgplaycdn.com", "hglamioz.com", "niramirus.com", "playnixes.com", "medixiru.com", "hanerix.com", "audinifer.com", "vibuxer.com", "masukestin.com"];
        
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
                                             .replace("streamwish.com", "hgplaycdn.com");
                try {
                    const wishVideos = await this.customStreamWishExtractor(streamwishUrl, serverName);
                    if (wishVideos) videos.push(...wishVideos);
                } catch (e) {
                    console.log(`StreamWish error: ${e}`);
                }
            } else if (decoded.includes("mp4upload.com")) {
                try {
                    const mp4Videos = await this.customMp4UploadExtractor(decoded, serverName);
                    if (mp4Videos) videos.push(...mp4Videos);
                } catch (e) {
                    console.log(`Mp4Upload error: ${e}`);
                }
            } else if (decoded.startsWith("https://yonaplay.net/embed.php?id=")) {
                try {
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
                                                   .replace("streamwish.com", "hgplaycdn.com");
                                    const wishVideos = await this.customStreamWishExtractor(subUrl, `${serverName} (Yona)`);
                                    if (wishVideos) videos.push(...wishVideos);
                                } else if (subUrl.includes("mp4upload.com")) {
                                    const mp4Videos = await this.customMp4UploadExtractor(subUrl, `${serverName} (Yona)`);
                                    if (mp4Videos) videos.push(...mp4Videos);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.log(`Yonaplay sub-extraction error: ${e}`);
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
        return [];
    }
}
