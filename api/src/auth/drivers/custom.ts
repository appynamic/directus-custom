import type { Accountability } from '@directus/types';
import argon2 from 'argon2';
import { Router } from 'express';
import Joi from 'joi';
import { performance } from 'perf_hooks';
import { COOKIE_OPTIONS } from '../../constants.js';
import getDatabase from '../../database/index.js';
import emitter from '../../emitter.js';
import env from '../../env.js';
import { RecordNotUniqueException } from '../../exceptions/database/record-not-unique.js';
import { 
	InvalidCredentialsException, 
	InvalidPayloadException, 
	InvalidProviderException,
	//ServiceUnavailableException,
} from '../../exceptions/index.js';
import logger from '../../logger.js';
import { respond } from '../../middleware/respond.js';
import { AuthenticationService } from '../../services/authentication.js';
import { UsersService } from '../../services/users.js';
import type { AuthDriverOptions, User } from '../../types/index.js';
import asyncHandler from '../../utils/async-handler.js';
import { getIPFromReq } from '../../utils/get-ip-from-req.js';
import { stall } from '../../utils/stall.js';
import { AuthDriver } from '../auth.js';

export class CustomAuthDriver extends AuthDriver {
	usersService: UsersService;
	config: Record<string, any>;
	
	constructor(options: AuthDriverOptions, config: Record<string, any>) {
		super(options, config);
		
		this.usersService = new UsersService({ knex: this.knex, schema: this.schema });
		this.config = config;
		
		// urlSSO: 'https://connect.rclens.club',
		
		logger.warn(config, '[CUSTOM] Config');
	}
		
	// fetch remote sso authenticate
	private async fetchAuthenticate(userName: string, password: string): Promise<string | undefined> {
		const { ssoUrl, ssoServiceId } = this.config;
		
		var headers = new Headers();
		headers.append("App-Service", ssoServiceId);
		
		const params = {
			username: userName,
			password: password, 
			type: 'user' // @todo put config here
		};
		
		const response = await fetch(ssoUrl+'/v1/auth/authenticate', {
			method: 'POST',
			body: JSON.stringify( params ),  
			cache: 'no-cache',				
			headers: headers, 
			credentials: 'include'
		});
		
		//  The property is set to true only if the response has status 200-299.
		if (!response.ok) {
			const message = `SSO - An error has occured: ${response.status}`;
			throw new InvalidPayloadException(message);
			//throw new InvalidPayloadException(error.message);
			//throw new Error(message);
		}
  
		const data = await response.json();
		return data;
	}
	
	private async fetchIsAuthenticated(userEmail?: string, userUUID?: string): Promise<string | undefined> {
		const { ssoUrl, ssoServiceId } = this.config;
					
		let url = ssoUrl+'/v1/auth/isauthenticated?serviceID='+ssoServiceId;
		if (userEmail) url += '&rescueEmail='+userEmail;
		if (userUUID) url += '&rescueUUID='+userUUID;
		
		const response = await fetch(url, {
			method: 'GET',
			cache: 'no-cache',	
			credentials: 'include'
		});
		
		//  The property is set to true only if the response has status 200-299.
		if (!response.ok) {
			const message = `SSO - isAuthenticated - An error has occured: ${response.status}`;
			throw new InvalidPayloadException(message);
			//throw new InvalidPayloadException(error.message);
		}
  
		/*
		var myHeaders = new Headers();
		//myHeaders.append("Content-Type", "text/plain");
		
		fetch(ssoUrl+'/v1/auth/isauthenticated?serviceID='+ssoServiceId, {
			method: 'GET',
			//method: 'POST',
			//body: form
			//serviceID: app.sso.serviceID
			cache: 'no-cache',
			headers: myHeaders, 
			credentials: 'include'
		}).then(resp => resp.json())
		.then(function(data) {
			//console.log(data);
			logger.warn(data, '[CUSTOM] fetch Data');
		})
		.catch(function(error) {
			//console.error(error);
			throw new InvalidPayloadException(error.message);
		});
		*/
		
		const data = await response.json();
		return data;
	}
	
	private async fetchUserId(userDn: string): Promise<string | undefined> {		
		const user = await this.knex
			.select('id')
			.from('directus_users')
			//.orWhereRaw('LOWER(??) = ?', ['external_identifier', userDn.toLowerCase()])
			.whereRaw('LOWER(??) = ?', ['external_identifier', userDn.toLowerCase()])
			.andWhereRaw('provider = ?', [this.config['provider']])
			.first();

		return user?.id;
	}		
	
	async getUserID(payload: Record<string, any>): Promise<string> {
		if (!payload['email']) {
			throw new InvalidCredentialsException();
		}

		// const { userDn, userScope, userAttribute, groupDn, groupScope, groupAttribute, defaultRoleId } = this.config;
		
		const { ssoUrl, ssoServiceId, defaultRoleId } = this.config;
		
		// check first in database (@todo add type & role constraint)
		const user = await this.knex
			.select('id, provider, external_identifier')
			.from('directus_users')
			.whereRaw('LOWER(??) = ?', ['email', payload['email'].toLowerCase()])
			.first();

		if (user) {
			// @todo sync data with sso
			
			// @todo check provider & external_identifier
			logger.warn(user, '[CUSTOM] direct local');
			
			return user.id;
		}
		
		// @todo call sso to know if email exist
		const sso_response = await this.fetchIsAuthenticated(payload['email'].toLowerCase(), payload?.uuid ?? null);
		//const sso_response = await this.fetchIsAuthenticated(payload['email'].toLowerCase(), 'ebfe3dbc225c4288957712e676d8c716');		
		logger.warn(sso_response, '[CUSTOM] fetchIsAuthenticated response');
		
		/*
		if (!user) {
			throw new InvalidCredentialsException();
		}
		*/
			
		let userRole;
		/*
		if (groupDn) {
			const userGroups = await this.fetchUserGroups(
				groupDn,
				new ldap.EqualityFilter({
					attribute: groupAttribute ?? 'member',
					value: groupAttribute?.toLowerCase() === 'memberuid' && userInfo.uid ? userInfo.uid : userInfo.dn,
				}),
				groupScope ?? 'one'
			);

			if (userGroups.length) {
				userRole = await this.knex
					.select('id')
					.from('directus_roles')
					.whereRaw(`LOWER(??) IN (${userGroups.map(() => '?')})`, [
						'name',
						...userGroups.map((group) => group.toLowerCase()),
					])
					.first();
			}
		}
		*/
		
		const userId = await this.fetchUserId(userInfo.dn);
	
		if (userId) {
			// Run hook so the end user has the chance to augment the
			// user that is about to be updated
			let updatedUserPayload = await emitter.emitFilter(
				`auth.update`,
				{},
				{ identifier: userInfo.dn, provider: this.config['provider'], providerPayload: { userInfo, userRole } },
				{ database: getDatabase(), schema: this.schema, accountability: null }
			);

			// Only sync roles if the AD groups are configured
			/*
			if (groupDn) {
				updatedUserPayload = { role: userRole?.id ?? defaultRoleId ?? null, ...updatedUserPayload };
			}
			*/

			// Update user to update properties that might have changed
			await this.usersService.updateOne(userId, updatedUserPayload);

			return userId;
		}
		
		if (!userInfo) {
			throw new InvalidCredentialsException();
		}

		const userPayload = {
			provider: this.config['provider'],
			first_name: userInfo.firstName,
			last_name: userInfo.lastName,
			email: userInfo.email,
			external_identifier: userInfo.dn,
			role: userRole?.id ?? defaultRoleId,
		};
		
		// Run hook so the end user has the chance to augment the
		// user that is about to be created
		const updatedUserPayload = await emitter.emitFilter(
			`auth.create`,
			userPayload,
			{ identifier: userInfo.dn, provider: this.config['provider'], providerPayload: { userInfo, userRole } },
			{ database: getDatabase(), schema: this.schema, accountability: null }
		);
		
		try {
			await this.usersService.createOne(updatedUserPayload);
		} catch (e) {
			if (e instanceof RecordNotUniqueException) {
				logger.warn(e, '[CUSTOM] Failed to register user. User not unique');
				throw new InvalidProviderException();
			}

			throw e;
		}

		return (await this.fetchUserId(userInfo.dn)) as string;
		
		//const d = await this.fetchAuthenticate('n.thomas@waigeo.fr','azerty62');
		//logger.warn(d, '[CUSTOM] fetchAuthenticate response');
		
		//const d2 = await this.fetchIsAuthenticated('ebfe3dbc225c4288957712e676d8c716');
		//logger.warn(d2, '[CUSTOM] fetchIsAuthenticated response');
		
		//return user.id;
	}

	async verify(user: User, password?: string): Promise<void> {
		if (!user.email || !user.external_identifier || !password) {
			throw new InvalidCredentialsException();
		}
		
		/*
		if (!user.password || !(await argon2.verify(user.password, password as string))) {
			throw new InvalidCredentialsException();
		}
		*/
		
		const d = await this.fetchAuthenticate(user.email, password);
		logger.warn(d, '[CUSTOM] fetchAuthenticate response');
	}

	override async login(user: User, payload: Record<string, any>): Promise<void> {
		await this.verify(user, payload['password']);
	}
	
	/*
	override async refresh(user: User): Promise<void> {
		await this.validateBindClient();

		const userInfo = await this.fetchUserInfo(user.external_identifier!);

		if (userInfo?.userAccountControl && userInfo.userAccountControl & INVALID_ACCOUNT_FLAGS) {
			throw new InvalidCredentialsException();
		}
	}
	*/
}

export function createCustomAuthRouter(provider: string): Router {
	const router = Router();

	const userLoginSchema = Joi.object({
		//identifier: Joi.string().required(),
		email: Joi.string().email().required(),
		password: Joi.string().required(),
		mode: Joi.string().valid('cookie', 'json'),
		otp: Joi.string(),
		uuid: Joi.string(), // optional
	}).unknown();

	router.post(
		'/',
		asyncHandler(async (req, res, next) => {
			const STALL_TIME = env['LOGIN_STALL_TIME'];
			const timeStart = performance.now();

			const accountability: Accountability = {
				ip: getIPFromReq(req),
				role: null,
			};

			const userAgent = req.get('user-agent');
			if (userAgent) accountability.userAgent = userAgent;

			const origin = req.get('origin');
			if (origin) accountability.origin = origin;

			const authenticationService = new AuthenticationService({
				accountability: accountability,
				schema: req.schema,
			});

			const { error } = userLoginSchema.validate(req.body);

			if (error) {
				await stall(STALL_TIME, timeStart);
				throw new InvalidPayloadException(error.message);
			}

			const mode = req.body.mode || 'json';

			const { accessToken, refreshToken, expires } = await authenticationService.login(
				provider,
				req.body,
				req.body?.otp
			);

			const payload = {
				data: { access_token: accessToken, expires },
			} as Record<string, Record<string, any>>;

			payload['data']!['test'] = 'nick'; // custom
			
			if (mode === 'json') {
				payload['data']!['refresh_token'] = refreshToken;
			}

			if (mode === 'cookie') {
				res.cookie(env['REFRESH_TOKEN_COOKIE_NAME'], refreshToken, COOKIE_OPTIONS);
			}

			res.locals['payload'] = payload;

			return next();
		}),
		respond
	);

	return router;
}
