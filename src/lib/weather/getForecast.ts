export interface Forecast {
  temperatureC: number;
  precipitationMm: number;
  windKph: number;
}

/**
 * Open-Meteo needs no API key, which is why the build doc picks it as the
 * low-friction default weather provider.
 */
export async function getForecast(lat: number, lon: number): Promise<Forecast | null> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat.toString());
  url.searchParams.set("longitude", lon.toString());
  url.searchParams.set("current", "temperature_2m,precipitation,wind_speed_10m");

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;

    const data = await response.json();
    const current = data.current;
    if (!current) return null;

    return {
      temperatureC: current.temperature_2m,
      precipitationMm: current.precipitation,
      windKph: current.wind_speed_10m,
    };
  } catch {
    return null;
  }
}
