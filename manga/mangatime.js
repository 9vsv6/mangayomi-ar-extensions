const mangayomiSources = [{
    "id": 584930219,
    "name": "MangaTime",
    "lang": "ar",
    "baseUrl": "https://mangatime.org",
    "apiUrl": "",
    "iconUrl": "https://mangatime.org/images/logo-64.png",
    "typeSource": "single",
    "itemType": 0,
    "version": "0.0.2",
    "pkgPath": "",
    "isNsfw": false,
    "notes": "MangaTime JS Extension",
    "preferences": [
        {
            "key": "domain_url",
            "name": "Override Base URL",
            "type": "EditText",
            "value": "https://mangatime.org"
        }
    ]
}];

class DefaultExtension extends MProvider {
    getClient() {
        if (!this.client) {
            this.client = new Client();
        }
        return this.client;
    }

    getBaseUrl() {
        const preference = new SharedPreferences();
        const baseUrl = preference.get("domain_url");
        if (!baseUrl || baseUrl.length === 0) {
            return this.source.baseUrl;
        }
        if (baseUrl.endsWith("/")) {
            return baseUrl.slice(0, -1);
        }
        return baseUrl;
    }

    getHeaders(url) {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": this.getBaseUrl() + "/",
            "X-MT-Platform": "web"
        };
    }

    async getPopular(page) {
        const input = {
            "0": {
                "json": {
                    "page": page,
                    "limit": 24
                }
            }
        };
        const url = `${this.getBaseUrl()}/api/trpc/homepage.getTrending?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`;
        const client = this.getClient();
        const res = await client.get(url, this.getHeaders(url));
        const data = JSON.parse(res.body);
        const items = data[0].result.data.json.items || [];
        const list = items.map(item => ({
            name: item.title,
            imageUrl: item.coverUrl.startsWith("http") ? item.coverUrl : `${this.getBaseUrl()}${item.coverUrl}`,
            link: `${this.getBaseUrl()}/manga/${item.slug}`
        }));
        return { list: list, hasNextPage: items.length >= 24 };
    }

    async getLatestUpdates(page) {
        const input = {
            "0": {
                "json": {
                    "page": page,
                    "limit": 24,
                    "hoursAgo": 24
                }
            }
        };
        const url = `${this.getBaseUrl()}/api/trpc/homepage.getLatest24Hours?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`;
        const client = this.getClient();
        const res = await client.get(url, this.getHeaders(url));
        const data = JSON.parse(res.body);
        const items = data[0].result.data.json.items || [];
        const list = items.map(item => ({
            name: item.title,
            imageUrl: item.coverUrl.startsWith("http") ? item.coverUrl : `${this.getBaseUrl()}${item.coverUrl}`,
            link: `${this.getBaseUrl()}/manga/${item.slug}`
        }));
        return { list: list, hasNextPage: items.length >= 24 };
    }

    async search(query, page, filters) {
        if (!query) {
            query = "";
        }
        const input = {
            "0": {
                "json": {
                    "query": query,
                    "filters": {
                        "genres": null,
                        "status": null,
                        "type": null
                    },
                    "sortBy": "relevance",
                    "limit": 24,
                    "page": page
                },
                "meta": {
                    "values": {
                        "filters.genres": ["undefined"],
                        "filters.status": ["undefined"],
                        "filters.type": ["undefined"]
                    },
                    "v": 1
                }
            }
        };
        const url = `${this.getBaseUrl()}/api/trpc/search.searchSeries?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`;
        const client = this.getClient();
        const res = await client.get(url, this.getHeaders(url));
        const data = JSON.parse(res.body);
        const results = data[0].result.data.json.results || [];
        const list = results.map(item => ({
            name: item.title,
            imageUrl: item.coverUrl.startsWith("http") ? item.coverUrl : `${this.getBaseUrl()}${item.coverUrl}`,
            link: `${this.getBaseUrl()}/manga/${item.slug}`
        }));
        const hasMore = data[0].result.data.json.hasMore || false;
        return { list: list, hasNextPage: hasMore };
    }

    async getDetail(url) {
        const slug = url.split("/manga/")[1].split("?")[0].split("#")[0];
        const seriesInput = {
            "0": {
                "json": {
                    "slug": slug
                }
            }
        };
        const seriesUrl = `${this.getBaseUrl()}/api/trpc/content.getSeriesBySlug?batch=1&input=${encodeURIComponent(JSON.stringify(seriesInput))}`;
        const client = this.getClient();
        const seriesRes = await client.get(seriesUrl, this.getHeaders(seriesUrl));
        const seriesData = JSON.parse(seriesRes.body);
        const seriesJson = seriesData[0].result.data.json;
        
        const title = seriesJson.title;
        const imageUrl = seriesJson.coverUrl.startsWith("http") ? seriesJson.coverUrl : `${this.getBaseUrl()}${seriesJson.coverUrl}`;
        const description = seriesJson.description || "";
        const author = seriesJson.author || "";
        const genre = seriesJson.genres || [];
        
        let status = 5; // unknown
        if (seriesJson.status) {
            const s = seriesJson.status.toLowerCase();
            if (s.includes("ongoing") || s.includes("مستمر")) {
                status = 0;
            } else if (s.includes("completed") || s.includes("مكتمل")) {
                status = 1;
            }
        }
        
        const seriesId = seriesJson.id;
        const chaptersInput = {
            "0": {
                "json": {
                    "seriesId": seriesId,
                    "limit": -1
                }
            }
        };
        const chaptersUrl = `${this.getBaseUrl()}/api/trpc/content.getChapters?batch=1&input=${encodeURIComponent(JSON.stringify(chaptersInput))}`;
        const chaptersRes = await client.get(chaptersUrl, this.getHeaders(chaptersUrl));
        const chaptersData = JSON.parse(chaptersRes.body);
        const chaptersList = chaptersData[0].result.data.json.items || [];
        
        const chapters = chaptersList.map(chap => {
            const chapUrl = `${this.getBaseUrl()}/manga/${slug}/chapter/${chap.number}`;
            let dateUpload = "0";
            if (chap.releasedAt || chap.publishedAt) {
                dateUpload = new Date(chap.releasedAt || chap.publishedAt).getTime().toString();
            }
            return {
                name: chap.title ? `الفصل ${chap.number} : ${chap.title}` : `الفصل ${chap.number}`,
                url: chapUrl,
                dateUpload: dateUpload
            };
        });
        
        return {
            name: title,
            imageUrl: imageUrl,
            description: description,
            author: author,
            status: status,
            genre: genre,
            chapters: chapters
        };
    }

    async getPageList(url) {
        const parts = url.split("/manga/")[1].split("/chapter/");
        const slug = parts[0];
        const chapterNumber = parseFloat(parts[1].split("?")[0].split("#")[0]);
        
        const input = {
            "0": {
                "json": {
                    "seriesSlug": slug,
                    "chapterNumber": chapterNumber
                }
            }
        };
        
        const pageUrl = `${this.getBaseUrl()}/api/trpc/content.getChapterPages?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`;
        const client = this.getClient();
        const res = await client.get(pageUrl, this.getHeaders(pageUrl));
        const data = JSON.parse(res.body);
        const pagesList = data[0].result.data.json.pages || [];
        
        const pages = pagesList.map(p => {
            return {
                url: p.startsWith("http") ? p : `${this.getBaseUrl()}${p}`
            };
        });
        return pages;
    }

    getFilterList() {
        return [];
    }

    getSourcePreferences() {
        return [
            {
                key: "domain_url",
                editTextPreference: {
                    title: "Override Base URL",
                    summary: "",
                    value: "https://mangatime.org",
                    dialogTitle: "Override Base URL",
                    dialogMessage: ""
                }
            }
        ];
    }
}
