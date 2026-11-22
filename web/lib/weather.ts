// Free weather from Open-Meteo (no key). Cached for 30 minutes.
export type Weather = { temp: number; code: number; wind: number; elevation: number | null; days: { date: string; max: number; min: number; code: number }[] };

export async function getWeather(lat: number, lng: number): Promise<Weather | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=Asia%2FKolkata&forecast_days=5`;
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return null;
    const j = await res.json();
    return {
      temp: Math.round(j.current?.temperature_2m), code: j.current?.weather_code ?? 0, wind: Math.round(j.current?.wind_speed_10m ?? 0),
      elevation: typeof j.elevation === 'number' ? Math.round(j.elevation) : null,
      days: (j.daily?.time || []).map((d: string, i: number) => ({ date: d, max: Math.round(j.daily.temperature_2m_max[i]), min: Math.round(j.daily.temperature_2m_min[i]), code: j.daily.weather_code[i] })),
    };
  } catch {
    return null;
  }
}

const CODES: [number[], string, string, string][] = [
  [[0], '☀️', 'Clear', 'साफ़'], [[1, 2], '🌤️', 'Partly cloudy', 'हल्के बादल'], [[3], '☁️', 'Cloudy', 'बादल'],
  [[45, 48], '🌫️', 'Fog', 'कोहरा'], [[51, 53, 55, 56, 57], '🌦️', 'Drizzle', 'बूँदाबाँदी'], [[61, 63, 65, 66, 67, 80, 81, 82], '🌧️', 'Rain', 'बारिश'],
  [[71, 73, 75, 77, 85, 86], '❄️', 'Snow', 'बर्फ़'], [[95, 96, 99], '⛈️', 'Thunderstorm', 'आँधी-तूफ़ान'],
];
export function weatherLabel(code: number, lang: 'hi' | 'en') {
  const row = CODES.find(([c]) => c.includes(code)) || CODES[0];
  return { icon: row[1], text: lang === 'hi' ? row[3] : row[2] };
}
