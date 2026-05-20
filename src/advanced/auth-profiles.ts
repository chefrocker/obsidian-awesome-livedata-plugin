/**
 * F-16: Reusable auth profiles for REST APIs.
 * Stores Bearer, API Key, Basic, OAuth2 profiles securely.
 */

export type AuthType = "none" | "bearer" | "apikey" | "basic" | "oauth2";

export interface AuthProfile {
    id: string;
    name: string;
    type: AuthType;
    // Bearer / API Key
    token?: string;
    // Basic
    username?: string;
    password?: string;
    // OAuth2
    clientId?: string;
    clientSecret?: string;
    tokenUrl?: string;
    scope?: string;
}

export interface AuthProfileStore {
    profiles: Record<string, AuthProfile>;
}

export function headersForProfile(profile: AuthProfile | undefined): Record<string, string> | undefined {
    if (!profile || profile.type === "none") return undefined;
    const headers: Record<string, string> = {};
    switch (profile.type) {
        case "bearer":
            headers["Authorization"] = `Bearer ${profile.token}`;
            break;
        case "apikey":
            headers["X-API-Key"] = profile.token || "";
            break;
        case "basic":
            headers["Authorization"] = "Basic " + btoa(`${profile.username}:${profile.password}`);
            break;
        case "oauth2":
            headers["Authorization"] = `Bearer ${profile.token}`;
            break;
    }
    return headers;
}
