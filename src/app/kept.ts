// What a Person has written but not yet saved, kept in this tab's session
// storage so it survives the page reloading, such as to sign in again.
// Storage can be unavailable, as in some private windows, and then nothing
// is kept.
export function keep(key: string, value: unknown) {
	try {
		if (value === undefined) sessionStorage.removeItem(key);
		else sessionStorage.setItem(key, JSON.stringify(value));
	} catch {}
}

export function kept<T>(key: string, otherwise: T): T {
	try {
		const value = sessionStorage.getItem(key);
		return value === null ? otherwise : (JSON.parse(value) as T);
	} catch {
		return otherwise;
	}
}
