export type ProviderStatus = "live" | "stale" | "unavailable";

export type ProviderResult<T> = {
  status: ProviderStatus;
  data: T;
  generatedAt: string;
  error?: string;
  publicMessage?: string;
};

export function providerLive<T>(data: T, generatedAt = new Date().toISOString()): ProviderResult<T> {
  return { status: "live", data, generatedAt };
}

export function providerStale<T>(data: T, publicMessage: string, generatedAt: string): ProviderResult<T> {
  return { status: "stale", data, generatedAt, publicMessage };
}

export function providerUnavailable<T>(data: T, error?: unknown, publicMessage = "Dados em atualização."): ProviderResult<T> {
  return {
    status: "unavailable",
    data,
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : typeof error === "string" ? error : undefined,
    publicMessage,
  };
}
