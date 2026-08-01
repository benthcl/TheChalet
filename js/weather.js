import { CHALET_LOCATION } from './config.js';

const CACHE_KEY = 'chalet_weather_v3';
const CACHE_MS = 45 * 60 * 1000; // refresh at most every 45 minutes
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Near-term: Météo-France AROME (~1.5 km) + ARPEGE blend — best free model
 * for the French Alps. Days beyond MF coverage: ECMWF fill-in.
 */
const SOURCE_LABEL = 'Météo-France AROME';

/** WMO weather codes → icon + short label */
const WMO = {
    0:  { icon: 'bi-sun-fill',           label: 'Clear',           tone: 'sun' },
    1:  { icon: 'bi-sun-fill',           label: 'Mainly clear',    tone: 'sun' },
    2:  { icon: 'bi-cloud-sun-fill',     label: 'Partly cloudy',   tone: 'mix' },
    3:  { icon: 'bi-clouds-fill',        label: 'Overcast',        tone: 'cloud' },
    45: { icon: 'bi-cloud-fog2-fill',    label: 'Fog',             tone: 'cloud' },
    48: { icon: 'bi-cloud-fog2-fill',    label: 'Rime fog',        tone: 'cloud' },
    51: { icon: 'bi-cloud-drizzle-fill', label: 'Light drizzle',   tone: 'rain' },
    53: { icon: 'bi-cloud-drizzle-fill', label: 'Drizzle',         tone: 'rain' },
    55: { icon: 'bi-cloud-drizzle-fill', label: 'Heavy drizzle',   tone: 'rain' },
    56: { icon: 'bi-cloud-drizzle-fill', label: 'Freezing drizzle',tone: 'rain' },
    57: { icon: 'bi-cloud-drizzle-fill', label: 'Freezing drizzle',tone: 'rain' },
    61: { icon: 'bi-cloud-rain-fill',    label: 'Light rain',      tone: 'rain' },
    63: { icon: 'bi-cloud-rain-fill',    label: 'Rain',            tone: 'rain' },
    65: { icon: 'bi-cloud-rain-fill',    label: 'Heavy rain',      tone: 'rain' },
    66: { icon: 'bi-cloud-rain-fill',    label: 'Freezing rain',   tone: 'rain' },
    67: { icon: 'bi-cloud-rain-fill',    label: 'Freezing rain',   tone: 'rain' },
    71: { icon: 'bi-cloud-snow-fill',    label: 'Light snow',      tone: 'snow' },
    73: { icon: 'bi-cloud-snow-fill',    label: 'Snow',            tone: 'snow' },
    75: { icon: 'bi-snow',               label: 'Heavy snow',      tone: 'snow' },
    77: { icon: 'bi-snow',               label: 'Snow grains',     tone: 'snow' },
    80: { icon: 'bi-cloud-rain-fill',    label: 'Rain showers',    tone: 'rain' },
    81: { icon: 'bi-cloud-rain-fill',    label: 'Rain showers',    tone: 'rain' },
    82: { icon: 'bi-cloud-rain-fill',    label: 'Heavy showers',   tone: 'rain' },
    85: { icon: 'bi-cloud-snow-fill',    label: 'Snow showers',    tone: 'snow' },
    86: { icon: 'bi-snow',               label: 'Heavy snow showers', tone: 'snow' },
    95: { icon: 'bi-cloud-lightning-fill', label: 'Thunderstorm',  tone: 'storm' },
    96: { icon: 'bi-cloud-lightning-fill', label: 'Storm & hail',  tone: 'storm' },
    99: { icon: 'bi-cloud-lightning-fill', label: 'Storm & hail',  tone: 'storm' }
};

function weatherInfo(code) {
    return WMO[code] || { icon: 'bi-cloud-fill', label: '—', tone: 'cloud' };
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function roundTemp(n) {
    if (n == null || Number.isNaN(n)) return '–';
    return `${Math.round(n)}°`;
}

function formatWind(kmh) {
    if (kmh == null) return '–';
    return `${Math.round(kmh)} km/h`;
}

function parseLocalDay(isoDate) {
    const [y, m, d] = String(isoDate).split('-').map(Number);
    return new Date(y, m - 1, d);
}

function formatDayLabel(isoDate) {
    const d = parseLocalDay(isoDate);
    return {
        weekday: WEEKDAYS[d.getDay()],
        dayNum: d.getDate(),
        month: MONTHS[d.getMonth()]
    };
}

function locationParams() {
    const { latitude, longitude, elevation, timezone } = CHALET_LOCATION;
    const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        timezone: timezone || 'Europe/Paris',
        forecast_days: '7'
    });
    if (elevation != null) params.set('elevation', String(elevation));
    return params;
}

/** Highest-res free French Alpine forecast (AROME HD + ARPEGE seamless). */
function buildMeteoFranceUrl() {
    const params = locationParams();
    params.set('current', [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'precipitation',
        'weather_code',
        'wind_speed_10m',
        'is_day'
    ].join(','));
    params.set('daily', [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_sum',
        'sunrise',
        'sunset',
        'wind_speed_10m_max'
    ].join(','));
    params.set('hourly', [
        'temperature_2m',
        'weather_code',
        'precipitation'
    ].join(','));
    return `https://api.open-meteo.com/v1/meteofrance?${params}`;
}

/** ECMWF fills days past Météo-France range + rain-probability fields. */
function buildEcmwfUrl() {
    const params = locationParams();
    params.set('models', 'ecmwf_ifs025');
    params.set('current', 'temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,apparent_temperature,precipitation,is_day');
    params.set('daily', [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_sum',
        'precipitation_probability_max',
        'sunrise',
        'sunset',
        'wind_speed_10m_max'
    ].join(','));
    params.set('hourly', [
        'temperature_2m',
        'weather_code',
        'precipitation_probability',
        'precipitation'
    ].join(','));
    return `https://api.open-meteo.com/v1/forecast?${params}`;
}

function readCache() {
    try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.fetchedAt || Date.now() - parsed.fetchedAt > CACHE_MS) return null;
        return parsed.data;
    } catch {
        return null;
    }
}

function writeCache(data) {
    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), data }));
    } catch { /* private mode etc. */ }
}

function pickDaily(mf, ecmwf, key, i) {
    const mfVal = mf?.daily?.[key]?.[i];
    if (mfVal != null) return mfVal;
    return ecmwf?.daily?.[key]?.[i] ?? null;
}

/**
 * Prefer Météo-France wherever it has data (typically days 1–4).
 * Use ECMWF for the rest of the week and for rain-probability.
 */
function mergeForecasts(mf, ecmwf) {
    const times = ecmwf?.daily?.time?.length ? ecmwf.daily.time : (mf?.daily?.time || []);
    const daily = {
        time: times,
        weather_code: [],
        temperature_2m_max: [],
        temperature_2m_min: [],
        precipitation_sum: [],
        precipitation_probability_max: [],
        sunrise: [],
        sunset: [],
        wind_speed_10m_max: [],
        source: []
    };

    times.forEach((date, i) => {
        const mfHas = mf?.daily?.weather_code?.[i] != null
            && mf?.daily?.temperature_2m_max?.[i] != null;
        const src = mfHas ? 'mf' : 'ecmwf';
        const from = mfHas ? mf : ecmwf;
        daily.weather_code.push(from?.daily?.weather_code?.[i] ?? null);
        daily.temperature_2m_max.push(from?.daily?.temperature_2m_max?.[i] ?? null);
        daily.temperature_2m_min.push(from?.daily?.temperature_2m_min?.[i] ?? null);
        daily.precipitation_sum.push(pickDaily(mf, ecmwf, 'precipitation_sum', i));
        daily.precipitation_probability_max.push(
            ecmwf?.daily?.precipitation_probability_max?.[i] ?? null
        );
        daily.sunrise.push(pickDaily(mf, ecmwf, 'sunrise', i));
        daily.sunset.push(pickDaily(mf, ecmwf, 'sunset', i));
        daily.wind_speed_10m_max.push(pickDaily(mf, ecmwf, 'wind_speed_10m_max', i));
        daily.source.push(src);
    });

    // Hourly: Météo-France first; attach ECMWF rain % by matching timestamps
    const mfHourly = mf?.hourly || {};
    const ecmwfHourly = ecmwf?.hourly || {};
    const ecmwfProbByTime = {};
    (ecmwfHourly.time || []).forEach((t, i) => {
        ecmwfProbByTime[t] = ecmwfHourly.precipitation_probability?.[i] ?? null;
    });

    const hourly = {
        time: mfHourly.time || ecmwfHourly.time || [],
        temperature_2m: mfHourly.temperature_2m || ecmwfHourly.temperature_2m || [],
        weather_code: mfHourly.weather_code || ecmwfHourly.weather_code || [],
        precipitation: mfHourly.precipitation || ecmwfHourly.precipitation || [],
        precipitation_probability: (mfHourly.time || ecmwfHourly.time || []).map(
            (t, i) => ecmwfProbByTime[t]
                ?? ecmwfHourly.precipitation_probability?.[i]
                ?? null
        )
    };

    const mfCurrentOk = mf?.current && mf.current.temperature_2m != null;
    return {
        latitude: mf?.latitude ?? ecmwf?.latitude,
        longitude: mf?.longitude ?? ecmwf?.longitude,
        elevation: mf?.elevation ?? ecmwf?.elevation ?? CHALET_LOCATION.elevation,
        timezone: mf?.timezone ?? ecmwf?.timezone,
        current: mfCurrentOk ? mf.current : ecmwf?.current,
        daily,
        hourly,
        meta: {
            primary: SOURCE_LABEL,
            filledWith: 'ECMWF'
        }
    };
}

async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
    return res.json();
}

async function fetchForecast({ force = false } = {}) {
    if (!force) {
        const cached = readCache();
        if (cached) return cached;
    }

    const [mfResult, ecmwfResult] = await Promise.allSettled([
        fetchJson(buildMeteoFranceUrl()),
        fetchJson(buildEcmwfUrl())
    ]);

    const mf = mfResult.status === 'fulfilled' ? mfResult.value : null;
    const ecmwf = ecmwfResult.status === 'fulfilled' ? ecmwfResult.value : null;

    if (!mf && !ecmwf) {
        const reason = mfResult.reason?.message || ecmwfResult.reason?.message || 'Network error';
        throw new Error(reason);
    }

    const data = mergeForecasts(mf, ecmwf);
    writeCache(data);
    return data;
}

function upcomingHours(hourly, limit = 12) {
    if (!hourly?.time?.length) return [];
    const now = Date.now();
    const rows = [];
    for (let i = 0; i < hourly.time.length; i++) {
        const t = new Date(hourly.time[i]);
        if (t.getTime() < now - 30 * 60 * 1000) continue;
        rows.push({
            time: t,
            temp: hourly.temperature_2m[i],
            code: hourly.weather_code[i],
            precipProb: hourly.precipitation_probability?.[i],
            precipMm: hourly.precipitation?.[i]
        });
        if (rows.length >= limit) break;
    }
    return rows;
}

function renderTodayHero(data) {
    const cur = data.current || {};
    const info = weatherInfo(cur.weather_code);
    const daily = data.daily || {};
    const hi = daily.temperature_2m_max?.[0];
    const lo = daily.temperature_2m_min?.[0];
    const precipProb = daily.precipitation_probability_max?.[0];
    const precipSum = daily.precipitation_sum?.[0];
    const windMax = daily.wind_speed_10m_max?.[0];
    const sunrise = daily.sunrise?.[0] ? new Date(daily.sunrise[0]) : null;
    const sunset = daily.sunset?.[0] ? new Date(daily.sunset[0]) : null;
    const loc = CHALET_LOCATION.label || 'The Chalet';

    const fmtTime = (d) => d
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '–';

    return `
    <div class="weather-hero weather-hero-${escapeHtml(info.tone)}">
        <div class="weather-hero-top">
            <div>
                <div class="weather-eyebrow">Today at ${escapeHtml(loc)}</div>
                <div class="weather-condition">${escapeHtml(info.label)}</div>
            </div>
            <div class="weather-hero-icon" aria-hidden="true"><i class="bi ${info.icon} tone-${escapeHtml(info.tone)}"></i></div>
        </div>
        <div class="weather-hero-temp">${roundTemp(cur.temperature_2m)}</div>
        <div class="weather-hero-feels">Feels like ${roundTemp(cur.apparent_temperature)} · High ${roundTemp(hi)} / Low ${roundTemp(lo)}</div>
        <div class="weather-stats">
            <div class="weather-stat">
                <i class="bi bi-droplet-half"></i>
                <div>
                    <div class="weather-stat-label">Rain chance</div>
                    <div class="weather-stat-value">${precipProb != null ? precipProb + '%' : '–'}</div>
                </div>
            </div>
            <div class="weather-stat">
                <i class="bi bi-cloud-rain"></i>
                <div>
                    <div class="weather-stat-label">Precipitation</div>
                    <div class="weather-stat-value">${precipSum != null ? precipSum.toFixed(1) + ' mm' : '–'}</div>
                </div>
            </div>
            <div class="weather-stat">
                <i class="bi bi-wind"></i>
                <div>
                    <div class="weather-stat-label">Wind</div>
                    <div class="weather-stat-value">${formatWind(cur.wind_speed_10m ?? windMax)}</div>
                </div>
            </div>
            <div class="weather-stat">
                <i class="bi bi-moisture"></i>
                <div>
                    <div class="weather-stat-label">Humidity</div>
                    <div class="weather-stat-value">${cur.relative_humidity_2m != null ? cur.relative_humidity_2m + '%' : '–'}</div>
                </div>
            </div>
            <div class="weather-stat">
                <i class="bi bi-sunrise"></i>
                <div>
                    <div class="weather-stat-label">Sunrise</div>
                    <div class="weather-stat-value">${fmtTime(sunrise)}</div>
                </div>
            </div>
            <div class="weather-stat">
                <i class="bi bi-sunset"></i>
                <div>
                    <div class="weather-stat-label">Sunset</div>
                    <div class="weather-stat-value">${fmtTime(sunset)}</div>
                </div>
            </div>
        </div>
    </div>`;
}

function renderHourly(data) {
    const hours = upcomingHours(data.hourly, 12);
    if (!hours.length) return '';

    const cells = hours.map(h => {
        const info = weatherInfo(h.code);
        const label = h.time.toLocaleTimeString([], { hour: '2-digit' });
        return `
        <div class="weather-hour">
            <div class="weather-hour-time">${escapeHtml(label)}</div>
            <i class="bi ${info.icon} weather-hour-icon tone-${escapeHtml(info.tone)}"></i>
            <div class="weather-hour-temp">${roundTemp(h.temp)}</div>
            <div class="weather-hour-rain">${h.precipProb != null ? h.precipProb + '%' : (h.precipMm > 0 ? h.precipMm.toFixed(1) + ' mm' : '')}</div>
        </div>`;
    }).join('');

    return `
    <div class="weather-panel">
        <div class="weather-panel-label">Next hours</div>
        <div class="weather-hourly">${cells}</div>
    </div>`;
}

function renderWeek(data) {
    const daily = data.daily;
    if (!daily?.time?.length) return '';

    const tiles = daily.time.map((date, i) => {
        const info = weatherInfo(daily.weather_code[i]);
        const { weekday, dayNum, month } = formatDayLabel(date);
        const isToday = i === 0;
        const precip = daily.precipitation_probability_max?.[i];
        const precipSum = daily.precipitation_sum?.[i];
        const rainLine = precip != null
            ? `<i class="bi bi-droplet-half"></i> ${precip}%`
            : (precipSum != null && precipSum > 0 ? `<i class="bi bi-droplet-half"></i> ${precipSum.toFixed(1)} mm` : '');
        return `
        <div class="weather-day ${isToday ? 'is-today' : ''}">
            <div class="weather-day-head">${escapeHtml(weekday)}</div>
            <div class="weather-day-num">${dayNum}</div>
            <div class="weather-day-month">${escapeHtml(month)}</div>
            <i class="bi ${info.icon} weather-day-icon tone-${escapeHtml(info.tone)}"></i>
            <div class="weather-day-label">${escapeHtml(info.label)}</div>
            <div class="weather-day-temps">
                <span class="hi">${roundTemp(daily.temperature_2m_max[i])}</span>
                <span class="lo">${roundTemp(daily.temperature_2m_min[i])}</span>
            </div>
            <div class="weather-day-rain">${rainLine}</div>
        </div>`;
    }).join('');

    return `
    <div class="weather-panel">
        <div class="weather-panel-label">7-day outlook · AROME then ECMWF</div>
        <div class="weather-week">${tiles}</div>
    </div>`;
}

function renderFooter(updatedAt) {
    const when = updatedAt
        ? updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '–';
    return `
    <div class="weather-footer">
        <span>Updates automatically · ${SOURCE_LABEL}</span>
        <button type="button" class="weather-refresh" id="weather-refresh-btn">
            <i class="bi bi-arrow-clockwise"></i> Refresh
        </button>
        <span class="weather-updated">Updated ${escapeHtml(when)}</span>
    </div>`;
}

function renderError(message) {
    const root = document.getElementById('weather-root');
    if (!root) return;
    root.innerHTML = `
    <div class="weather-error glass-panel rounded-5 p-5 text-center">
        <i class="bi bi-cloud-slash fs-1 text-secondary mb-3 d-block"></i>
        <h3 class="fw-bold mb-2">Couldn’t load the forecast</h3>
        <p class="text-secondary mb-4">${escapeHtml(message)}</p>
        <button type="button" class="btn btn-premium" id="weather-retry-btn">Try again</button>
    </div>`;
    document.getElementById('weather-retry-btn')?.addEventListener('click', () => loadWeather({ force: true }));
}

function renderLoading() {
    const root = document.getElementById('weather-root');
    if (!root) return;
    root.innerHTML = `
    <div class="weather-loading text-center py-5">
        <div class="spinner-border text-secondary" role="status"></div>
        <p class="text-secondary small mt-3 mb-0">Fetching the mountain forecast…</p>
    </div>`;
}

function renderAll(data) {
    const root = document.getElementById('weather-root');
    if (!root) return;
    root.innerHTML = [
        renderTodayHero(data),
        renderHourly(data),
        renderWeek(data),
        renderFooter(data.current?.time ? new Date(data.current.time) : new Date())
    ].join('');

    document.getElementById('weather-refresh-btn')?.addEventListener('click', () => loadWeather({ force: true }));
    renderHomeWidget(data);
}

function renderHomeWidget(data) {
    const el = document.getElementById('widget-weather');
    if (!el || !data?.current) return;
    const cur = data.current;
    const info = weatherInfo(cur.weather_code);
    const hi = data.daily?.temperature_2m_max?.[0];
    const lo = data.daily?.temperature_2m_min?.[0];
    el.innerHTML = `
        <div class="d-flex align-items-center gap-3">
            <i class="bi ${info.icon} fs-1 tone-${escapeHtml(info.tone)} weather-widget-icon"></i>
            <div class="lh-1">
                <div class="small fw-bold text-secondary">WEATHER</div>
                <div class="fw-bold fs-5 text-dark">${roundTemp(cur.temperature_2m)} · ${escapeHtml(info.label)}</div>
                <div class="small text-secondary">H ${roundTemp(hi)} / L ${roundTemp(lo)}</div>
            </div>
        </div>`;
}

async function loadWeather({ force = false } = {}) {
    const root = document.getElementById('weather-root');
    if (!root) return;
    if (!force && root.dataset.loaded === '1' && readCache()) return;

    if (!root.dataset.loaded) renderLoading();

    try {
        const data = await fetchForecast({ force });
        renderAll(data);
        root.dataset.loaded = '1';
    } catch (err) {
        console.warn('Weather load failed:', err);
        if (!root.dataset.loaded) renderError(err.message || 'Network error');
    }
}

/** Prefetch for home widget; full UI renders when the tab opens. */
export function initWeather() {
    loadWeather({ force: false });
}

export function refreshWeatherView() {
    const root = document.getElementById('weather-root');
    const cached = readCache();
    if (cached && root && !root.querySelector('.weather-hero')) {
        renderAll(cached);
        root.dataset.loaded = '1';
        return;
    }
    loadWeather({ force: false });
}

export function cleanupWeather() {
    // nothing to tear down — fetch is one-shot / cached
}
