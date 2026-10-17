import { db, redis } from '../db/index.js';

export type ReputationLevel = 'high' | 'medium' | 'low' | 'unknown';

export type ReputationResult = {
  url: string;
  domain: string;
  level: ReputationLevel;
  score: number;
  reasons: string[];
  sources: string[];
  cached: boolean;
};

// Hàm check WHOIS (Domain Age)
async function checkDomainAge(domain: string): Promise<{ ageDays: number; reasons: string[]; penalty: number }> {
  try {
    const tld = domain.split('.').pop()?.toLowerCase();
    let rdapUrl = `https://rdap.org/domain/${domain}`; // Fallback
    
    // Chọn server RDAP chính thức cho các TLD phổ biến
    if (tld === 'org') {
      rdapUrl = `https://rdap.publicinterestregistry.org/rdap/domain/${domain}`;
    } else if (tld === 'com' || tld === 'net') {
      rdapUrl = `https://rdap.verisign.com/${tld}/v1/domain/${domain}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(rdapUrl, {
      headers: { 'Accept': 'application/rdap+json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const text = await res.text();
    if (text.trim().startsWith('<')) {
       throw new Error('Server trả về HTML thay vì JSON');
    }
    const data = JSON.parse(text);

    const regEvent = data.events?.find((e: any) => e.eventAction === 'registration');
    
    if (!regEvent || !regEvent.eventDate) {
      console.log(`[RDAP] ${domain} - Không tìm thấy ngày đăng ký trong data`);
      return { ageDays: -1, reasons: [], penalty: 0 };
    }

    const creationDate = new Date(regEvent.eventDate);
    const ageDays = Math.floor((Date.now() - creationDate.getTime()) / (1000 * 60 * 60 * 24));
    
    console.log(`[RDAP] ${domain} - Age: ${ageDays} days`);
    
    if (ageDays < 7) return { ageDays, reasons: [`domain_age_${ageDays}d (<7 days)`], penalty: 40 };
    if (ageDays < 30) return { ageDays, reasons: [`domain_age_${ageDays}d (<30 days)`], penalty: 25 };
    if (ageDays < 90) return { ageDays, reasons: [`domain_age_${ageDays}d (<90 days)`], penalty: 10 };
    if (ageDays > 365) return { ageDays, reasons: [`domain_age_${ageDays}d (>1 year)`], penalty: -30 };
    return { ageDays, reasons: [`domain_age_${ageDays}d`], penalty: 0 };
  } catch (err) {
    console.log(`[RDAP] ${domain} - Lỗi lookup:`, (err as Error).message);
    return { ageDays: -1, reasons: ['rdap_lookup_failed'], penalty: 0 };
  }
}

// Hàm giả lập Google Safe Browsing (Để tích hợp thật, cần API Key từ Google Cloud)
async function checkSafeBrowsing(domain: string): Promise<{ isMalicious: boolean; reasons: string[] }> {
  // Giả lập: Các domain chứa từ khóa xấu sẽ bị block
  if (domain.includes('phishing') || domain.includes('malware') || domain.includes('free-gift')) {
    return { isMalicious: true, reasons: ['google_safe_browsing_malware', 'phishing_detected'] };
  }
  return { isMalicious: false, reasons: [] };
}

export async function getReputation(urlStr: string): Promise<ReputationResult> {
  let domain = '';
  try {
    domain = new URL(urlStr).hostname;
  } catch {
    return { url: urlStr, domain: 'invalid', level: 'unknown', score: 0, reasons: ['invalid_url'], sources: [], cached: false };
  }

  // 1. Check Redis Cache
  const cacheKey = `rep:${domain}`;
  const cachedData = await redis.get(cacheKey);
  if (cachedData) {
    return { ...JSON.parse(cachedData), url: urlStr, cached: true };
  }

  // 2. Check Postgres
  const dbRes = await db.query('SELECT * FROM reputation_cache WHERE domain = $1 AND checked_at > NOW() - INTERVAL \'1 day\'', [domain]);
  if (dbRes.rows.length > 0) {
    const row = dbRes.rows[0];
    const result: ReputationResult = {
      url: urlStr, domain, level: row.level, score: row.score,
      reasons: row.reasons, sources: row.sources, cached: true
    };
    await redis.setex(cacheKey, 3600, JSON.stringify({ ...result, url: undefined, cached: undefined }));
    return result;
  }

  // 3. Phân tích thực tế (GSB + WHOIS)
  let score = 50; // Điểm cơ bản
  let reasons: string[] = [];
  let sources: string[] = ['local_heuristic'];
  let level: ReputationLevel = 'medium';

  // 3.1 Check GSB
  const gsb = await checkSafeBrowsing(domain);
  if (gsb.isMalicious) {
    score = 0;
    reasons.push(...gsb.reasons);
    sources.push('google_safe_browsing');
    level = 'low';
  } else {
    // 3.2 Check WHOIS (chỉ check nếu không phải domain nổi tiếng)
    const famousDomains = ['google.com', 'facebook.com', 'youtube.com', 'example.com', 'github.com'];
    if (!famousDomains.includes(domain)) {
      const whoisInfo = await checkDomainAge(domain);
      if (whoisInfo.ageDays !== -1) {
        score -= whoisInfo.penalty;
        reasons.push(...whoisInfo.reasons);
        sources.push('rdap');
        console.log(`[WHOIS] ${domain} - Age: ${whoisInfo.ageDays} days, Penalty: ${whoisInfo.penalty}, Score: ${score}`);
      } else {
        console.log(`[WHOIS] ${domain} - Lookup failed or no date`);
      }
    } else {
      score = 95;
      reasons.push('trusted_famous_domain');
    }

    if (score >= 80) level = 'high';
    else if (score >= 50) level = 'medium';
    else if (score < 30) level = 'low';
    else level = 'unknown';
  }

  const result: ReputationResult = {
    url: urlStr, domain, level, score, reasons, sources, cached: false
  };

  // 4. Save to DB & Redis (Cache domain low trust ngắn hơn)
  const ttl = level === 'low' ? 3600 : 86400; 
  await db.query(
    'INSERT INTO reputation_cache (domain, level, score, reasons, sources, ttl) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (domain) DO UPDATE SET level = EXCLUDED.level, score = EXCLUDED.score, reasons = EXCLUDED.reasons, checked_at = NOW()',
    [domain, level, score, JSON.stringify(reasons), JSON.stringify(sources), ttl]
  );
  await redis.setex(cacheKey, ttl, JSON.stringify({ ...result, url: undefined, cached: undefined }));

  return result;
}
