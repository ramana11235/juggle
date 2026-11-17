import {createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey} from 'jose';

export type AccessIdentity = {kind: 'email'; email: string} | {kind: 'service_token'; clientId: string} | {kind: 'invalid'};

// Cloudflare Access puts a signed token on every request it lets through.
// The Worker checks it was signed by the team, for Juggle's application, and
// takes from it who signed in: a person's email, or for a script signed in
// with a service token, that token's client id.
export async function identityFromAccessToken(
	token: string,
	expected: {team: string; aud: string; keys: JWTVerifyGetKey},
): Promise<AccessIdentity> {
	try {
		const {payload} = await jwtVerify(token, expected.keys, {issuer: expected.team, audience: expected.aud});
		if (typeof payload.email === 'string' && payload.email !== '') return {kind: 'email', email: payload.email.toLowerCase()};
		if (typeof payload.common_name === 'string' && payload.common_name !== '') return {kind: 'service_token', clientId: payload.common_name};
		return {kind: 'invalid'};
	} catch {
		return {kind: 'invalid'};
	}
}

const keysByTeam = new Map<string, JWTVerifyGetKey>();

// The team's signing keys, fetched once per Worker instance and refreshed by jose when they rotate.
export function teamKeys(team: string): JWTVerifyGetKey {
	let keys = keysByTeam.get(team);
	if (!keys) {
		keys = createRemoteJWKSet(new URL(`${team}/cdn-cgi/access/certs`));
		keysByTeam.set(team, keys);
	}
	return keys;
}
