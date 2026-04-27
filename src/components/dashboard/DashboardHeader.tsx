import { Cloud, CloudFog, CloudRain, CloudSnow, CloudSun, Sun, Zap } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { greeting } from '../../utils/dateUtils';

interface WeatherData {
  temperature: number;
  weatherCode: number;
  isDay: boolean;
}

interface CachedWeather {
  data: WeatherData;
  timestamp: number;
}

type WeatherIconKind = 'clear' | 'partly-cloudy' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';

// WMO Weather interpretation codes to icon kinds and Hebrew labels
const WEATHER_MAP: Record<number, { icon: WeatherIconKind; label: string }> = {
  0: { icon: 'clear', label: 'בהיר' },
  1: { icon: 'partly-cloudy', label: 'בעיקר בהיר' },
  2: { icon: 'partly-cloudy', label: 'מעונן חלקית' },
  3: { icon: 'cloudy', label: 'מעונן' },
  45: { icon: 'fog', label: 'ערפל' },
  48: { icon: 'fog', label: 'כפור' },
  51: { icon: 'rain', label: 'טפטוף קל' },
  53: { icon: 'rain', label: 'טפטוף' },
  55: { icon: 'rain', label: 'טפטוף כבד' },
  61: { icon: 'rain', label: 'גשם קל' },
  63: { icon: 'rain', label: 'גשם' },
  65: { icon: 'rain', label: 'גשם כבד' },
  71: { icon: 'snow', label: 'שלג קל' },
  73: { icon: 'snow', label: 'שלג' },
  75: { icon: 'snow', label: 'שלג כבד' },
  77: { icon: 'snow', label: 'גרגירי שלג' },
  80: { icon: 'partly-cloudy', label: 'ממטרים קלים' },
  81: { icon: 'partly-cloudy', label: 'ממטרים' },
  82: { icon: 'rain', label: 'ממטרים כבדים' },
  85: { icon: 'snow', label: 'ממטרי שלג' },
  86: { icon: 'snow', label: 'ממטרי שלג כבדים' },
  95: { icon: 'storm', label: 'סופת רעמים' },
  96: { icon: 'storm', label: 'סופת רעמים עם ברד' },
  99: { icon: 'storm', label: 'סופת רעמים כבדה' },
};

const getWeatherInfo = (code: number): { icon: WeatherIconKind; label: string } => {
  return WEATHER_MAP[code] ?? { icon: 'partly-cloudy', label: 'לא ידוע' };
};

const WeatherIcon = ({ kind }: { kind: WeatherIconKind }) => {
  const props = {
    size: 24,
    strokeWidth: 2.4,
    color: 'var(--mustard)',
    'aria-hidden': true,
  };

  switch (kind) {
    case 'clear':
      return <Sun {...props} />;
    case 'cloudy':
      return <Cloud {...props} />;
    case 'fog':
      return <CloudFog {...props} />;
    case 'rain':
      return <CloudRain {...props} />;
    case 'snow':
      return <CloudSnow {...props} />;
    case 'storm':
      return <Zap {...props} />;
    case 'partly-cloudy':
      return <CloudSun {...props} />;
  }
};

const CACHE_KEY = 'weather_cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

const getCachedWeather = (): WeatherData | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const parsed: CachedWeather = JSON.parse(cached);
    if (Date.now() - parsed.timestamp < CACHE_DURATION) {
      return parsed.data;
    }
  } catch {
    // ignore parse errors
  }
  return null;
};

const setCachedWeather = (data: WeatherData): void => {
  try {
    const cacheEntry: CachedWeather = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheEntry));
  } catch {
    // ignore storage errors
  }
};

interface DashboardHeaderProps {
  weekNumber: number;
}

export const DashboardHeader = memo(function DashboardHeader({ weekNumber }: DashboardHeaderProps) {
  const [time, setTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [weather, setWeather] = useState<WeatherData | null>(() => getCachedWeather());
  const [weatherLoading, setWeatherLoading] = useState(!getCachedWeather());
  const [weatherError, setWeatherError] = useState(false);

  // Live clock — updates every second
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      );
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Weather fetch on mount only
  const fetchWeather = useCallback(async () => {
    // Skip if already have cached data
    if (getCachedWeather()) return;

    try {
      setWeatherError(false);
      const res = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=32.0853&longitude=34.7818&current_weather=true&hourly=relativehumidity_2m'
      );
      if (!res.ok) throw new Error('Weather fetch failed');
      const json = await res.json();
      const weatherData: WeatherData = {
        temperature: Math.round(json.current_weather.temperature),
        weatherCode: json.current_weather.weathercode,
        isDay: json.current_weather.is_day === 1,
      };
      setCachedWeather(weatherData);
      setWeather(weatherData);
    } catch {
      setWeatherError(true);
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  // Safe area padding
  const topPadding = 'max(20px, env(safe-area-inset-top, 20px))';
  const horizontalPadding =
    'max(20px, env(safe-area-inset-left, 20px)) max(20px, env(safe-area-inset-right, 20px))';

  // Get user name from localStorage
  const userName = (() => {
    try {
      const profile = localStorage.getItem('user_profile');
      if (profile) {
        const parsed = JSON.parse(profile);
        return parsed.name || parsed.displayName || null;
      }
    } catch {
      // ignore
    }
    return null;
  })();

  // Hebrew date
  const todayFull = new Date().toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // Time-based greeting
  const currentGreeting = greeting();

  // Week label
  const weekLabel = `שבוע ${String(weekNumber).padStart(2, '0')}`;

  return (
    <header
      style={{
        background: 'var(--navy)',
        paddingTop: topPadding,
        paddingLeft: horizontalPadding,
        paddingRight: horizontalPadding,
        paddingBottom: 20,
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
      aria-label="כותרת לוח הבקרה"
    >
      {/* Top row: Weather + Clock */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        {/* Weather Widget */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
          aria-label="מזג אוויר"
        >
          {weatherLoading ? (
            <div
              style={{
                width: 16,
                height: 16,
                border: '2px solid var(--bone)',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }}
              role="status"
              aria-label="טוען מזג אוויר"
            />
          ) : weatherError ? (
            <WeatherIcon kind="partly-cloudy" />
          ) : weather ? (
            <>
              <WeatherIcon kind={getWeatherInfo(weather.weatherCode).icon} />
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 20,
                  color: 'var(--bone)',
                  letterSpacing: '-0.01em',
                }}
              >
                {weather.temperature}°
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-hebrew)',
                  fontSize: 13,
                  color: 'rgba(245, 241, 235, 0.7)',
                }}
              >
                · {getWeatherInfo(weather.weatherCode).label}
              </span>
            </>
          ) : null}
        </div>

        {/* Live Clock */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 500,
            fontSize: 28,
            color: 'var(--mustard)',
            letterSpacing: '0.05em',
          }}
          aria-label={`שעון: ${time}`}
          role="timer"
        >
          {time}
        </div>
      </div>

      {/* Bottom: Greeting + Date */}
      <div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 'clamp(32px, 10vw, 64px)',
            lineHeight: 0.9,
            letterSpacing: '-0.02em',
            textTransform: 'uppercase',
            color: 'var(--bone)',
            margin: 0,
            marginBottom: 12,
          }}
        >
          {currentGreeting}
          {userName ? `, ${userName}` : ''}!
        </h1>

        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'rgba(245, 241, 235, 0.65)',
          }}
        >
          {todayFull} · {weekLabel}
        </div>
      </div>
    </header>
  );
});

export default DashboardHeader;
