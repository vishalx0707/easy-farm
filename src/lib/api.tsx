import { useAuth } from "@clerk/react";
import { useCallback } from "react";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export function useApi() {
  const { getToken } = useAuth();
  return useCallback(
    async <T,>(path: string, body?: unknown): Promise<T> => {
      const token = await getToken();
      const response = await fetch(path, {
        method: body ? "POST" : "GET",
        headers: {
          ...(token ? { Authorization: "Bearer " + token } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const result = await response.json();
      if (!response.ok)
        throw new ApiError(
          result.error || "Please try again.",
          response.status,
        );
      return result;
    },
    [getToken],
  );
}
export async function publicApi<T>(path: string): Promise<T> {
  const response = await fetch(path);
  const result = await response.json();
  if (!response.ok)
    throw new ApiError(
      result.error || "Could not load this record.",
      response.status,
    );
  return result;
}
