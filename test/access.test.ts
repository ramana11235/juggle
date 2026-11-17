import {createLocalJWKSet, exportJWK, generateKeyPair, SignJWT} from 'jose';
import {describe, expect, it} from 'vitest';
import {identityFromAccessToken} from '../src/worker/access';

const team = 'https://team.cloudflareaccess.com';
const aud = 'juggle-audience';

async function signer() {
	const {publicKey, privateKey} = await generateKeyPair('RS256');
	const keys = createLocalJWKSet({keys: [{...(await exportJWK(publicKey)), kid: 'k', alg: 'RS256'}]});
	const sign = (claims: {iss?: string; aud?: string; email?: string; common_name?: string}) =>
		new SignJWT({email: claims.email, common_name: claims.common_name}).setProtectedHeader({alg: 'RS256', kid: 'k'}).setIssuer(claims.iss ?? team).setAudience(claims.aud ?? aud).setExpirationTime('1h').sign(privateKey);
	return {keys, sign};
}

describe('the Access token', () => {
	it('gives the email it was signed for, in lower case', async () => {
		const {keys, sign} = await signer();
		expect(await identityFromAccessToken(await sign({email: 'Someone@Example.com'}), {team, aud, keys})).toEqual({kind: 'email', email: 'someone@example.com'});
	});
	it('is refused when it is for another Access application', async () => {
		const {keys, sign} = await signer();
		expect(await identityFromAccessToken(await sign({email: 'a@example.com', aud: 'another-app'}), {team, aud, keys})).toEqual({kind: 'invalid'});
	});
	it('is refused when another team signed it', async () => {
		const {keys, sign} = await signer();
		expect(await identityFromAccessToken(await sign({email: 'a@example.com', iss: 'https://other.cloudflareaccess.com'}), {team, aud, keys})).toEqual({kind: 'invalid'});
	});
	it('is refused when signed with a key the team does not have', async () => {
		const {keys} = await signer();
		const other = await signer();
		expect(await identityFromAccessToken(await other.sign({email: 'a@example.com'}), {team, aud, keys})).toEqual({kind: 'invalid'});
	});
	it('gives the client id of a service token, which carries no email', async () => {
		const {keys, sign} = await signer();
		expect(await identityFromAccessToken(await sign({common_name: 'abc.access'}), {team, aud, keys})).toEqual({kind: 'service_token', clientId: 'abc.access'});
	});
});
