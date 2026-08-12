const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * Validate that a value is a safe URL for opening in an external browser.
 * Only absolute http/https URLs are accepted; everything else is rejected.
 */
export function isAllowedExternalUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return ALLOWED_PROTOCOLS.includes(url.protocol);
    } catch {
        return false;
    }
}
