import { WeatherCondition } from "./types";

// Localização da obra (Uberlândia, MG)
const LAT = -18.9186;
const LON = -48.2772;

export interface DayWeather {
  morning: WeatherCondition;
  afternoon: WeatherCondition;
  tempMin: number;
  tempMax: number;
  rainMm: number;
}

function codeToCondition(code: number, rainMm: number): WeatherCondition {
  if (code >= 95 || rainMm >= 20) return "chuva_forte";
  if (code >= 61 || (code >= 51 && rainMm >= 1)) return "chuva";
  if (code === 3) return "nublado";
  if (code === 1 || code === 2) return "parcial";
  if (code >= 45) return "nublado";
  return "sol";
}

/**
 * Busca o clima real do dia na Open-Meteo (gratuito, sem chave).
 * Funciona para hoje e datas passadas recentes (últimos ~3 meses).
 */
export async function fetchDayWeather(date: string): Promise<DayWeather | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
      `&hourly=weathercode,precipitation&daily=temperature_2m_max,temperature_2m_min,precipitation_sum` +
      `&timezone=America%2FSao_Paulo&start_date=${date}&end_date=${date}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    const codes: number[] = data?.hourly?.weathercode ?? [];
    const precip: number[] = data?.hourly?.precipitation ?? [];
    if (codes.length < 18) return null;

    // Manhã: 7h–12h · Tarde: 13h–18h
    const worst = (from: number, to: number) => {
      let maxCode = 0;
      let rain = 0;
      for (let h = from; h <= to && h < codes.length; h++) {
        if (codes[h] > maxCode) maxCode = codes[h];
        rain += precip[h] ?? 0;
      }
      return codeToCondition(maxCode, rain);
    };

    return {
      morning: worst(7, 12),
      afternoon: worst(13, 18),
      tempMin: Math.round((data?.daily?.temperature_2m_min?.[0] ?? 0) * 10) / 10,
      tempMax: Math.round((data?.daily?.temperature_2m_max?.[0] ?? 0) * 10) / 10,
      rainMm: Math.round((data?.daily?.precipitation_sum?.[0] ?? 0) * 10) / 10,
    };
  } catch {
    return null;
  }
}
