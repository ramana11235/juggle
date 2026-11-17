import {identityFromAccessToken, teamKeys} from './access';

export const localSignInCookie = 'juggle_local_email';

// The one place that works out who is making a request, so another way of
// signing in can replace Access without changing the rest of the Worker.
// SIGN_IN is "access" on Cloudflare. "local" is for development and tests,
// where Access is not in front, and takes the email from a cookie.
export async function whoIsAsking(request: Request, env: Env): Promise<{kind: 'email'; email: string} | {kind: 'nobody'}> {
	switch (env.SIGN_IN) {
		case 'access': {
			const token = request.headers.get('Cf-Access-Jwt-Assertion');
			if (!token) return {kind: 'nobody'};
			const found = await identityFromAccessToken(token, {team: env.ACCESS_TEAM, aud: env.ACCESS_AUD, keys: teamKeys(env.ACCESS_TEAM)});
			if (found.kind === 'email') return found;
			if (found.kind === 'service_token') return personForServiceToken(env.SERVICE_TOKEN_PEOPLE, found.clientId);
			return {kind: 'nobody'};
		}
		case 'local': {
			const email = cookie(request, localSignInCookie);
			return email ? {kind: 'email', email: email.toLowerCase()} : {kind: 'nobody'};
		}
		default:
			throw new Error(`SIGN_IN must be "access" or "local", not ${JSON.stringify(env.SIGN_IN)}`);
	}
}

// SERVICE_TOKEN_PEOPLE maps a service token's client id to the email of the
// test Person it signs in as. Only the beta copy names any, so the real
// Juggle never takes a script for a Person.
export function personForServiceToken(people: string, clientId: string): {kind: 'email'; email: string} | {kind: 'nobody'} {
	const named: unknown = JSON.parse(people);
	const email = typeof named === 'object' && named !== null ? (named as Record<string, unknown>)[clientId] : undefined;
	return typeof email === 'string' ? {kind: 'email', email: email.toLowerCase()} : {kind: 'nobody'};
}

function cookie(request: Request, name: string): string | undefined {
	for (const part of (request.headers.get('Cookie') ?? '').split(';')) {
		const [key, ...value] = part.trim().split('=');
		if (key === name) return decodeURIComponent(value.join('='));
	}
	return undefined;
}
